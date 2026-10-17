// Cloudflare Workers: cf-test
// GitHub Pages: https://informin.github.io/webapps/ai-chat/
// Cloudflare Settings > Variables and secrets > Secret:
//   GEMINI_API_KEY     = your Google AI Studio API key
//   CHAT_ACCESS_TOKEN  = a long, private passphrase (NOT the Gemini API key)
// Never commit either secret value to GitHub.

const ALLOWED_ORIGIN = "https://informin.github.io";
const MODEL = "gemini-3.8-flash";
const MAX_MESSAGES = 18;
const MAX_TEXT_LENGTH = 3500;
const MAX_PAYLOAD_LENGTH = 28000;

function reply(data, status = 200, origin = "") {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin"
  });
  if (origin === ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, X-Chat-Token");
    headers.set("Access-Control-Max-Age", "600");
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("Gemini chat proxy is running.", {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
    if (url.pathname !== "/chat") return reply({ error: "찾을 수 없는 경로입니다." }, 404, origin);

    // CORS protects the browser integration; it is NOT user authentication.
    if (origin !== ALLOWED_ORIGIN) return reply({ error: "허용되지 않은 요청 출처입니다." }, 403, origin);

    if (request.method === "OPTIONS") return reply({}, 200, origin);
    if (request.method !== "POST") return reply({ error: "POST 요청만 지원합니다." }, 405, origin);
    if (!env.GEMINI_API_KEY || !env.CHAT_ACCESS_TOKEN) {
      return reply({ error: "Cloudflare Secret 설정이 필요합니다." }, 503, origin);
    }
    if (request.headers.get("X-Chat-Token") !== env.CHAT_ACCESS_TOKEN) {
      return reply({ error: "접속 암호가 올바르지 않습니다." }, 401, origin);
    }
    if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json")) {
      return reply({ error: "JSON 형식으로 보내주세요." }, 415, origin);
    }

    let messages;
    try {
      const contentLength = Number(request.headers.get("Content-Length") || 0);
      if (contentLength > MAX_PAYLOAD_LENGTH * 4) {
        return reply({ error: "요청 내용이 너무 깁니다." }, 413, origin);
      }
      const raw = await request.text();
      if (raw.length > MAX_PAYLOAD_LENGTH) return reply({ error: "요청 내용이 너무 깁니다." }, 413, origin);
      messages = JSON.parse(raw).messages;
    } catch {
      return reply({ error: "요청을 읽을 수 없습니다." }, 400, origin);
    }

    if (!Array.isArray(messages) || messages.length < 1 || messages.length > MAX_MESSAGES ||
        messages.at(-1)?.role !== "user" ||
        messages.some((m) => !m || !["user", "model"].includes(m.role) ||
          typeof m.text !== "string" || !m.text.trim() || m.text.length > MAX_TEXT_LENGTH)) {
      return reply({ error: "대화 내용이 올바르지 않습니다." }, 400, origin);
    }

    const contents = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    try {
      const googleResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: "당신은 친절하고 정확한 한국어 AI 도우미입니다. 질문 언어에 맞춰 답하고, 모르면 모른다고 하세요. 개인 정보나 비밀값을 묻지 마세요." }]
            },
            generationConfig: { maxOutputTokens: 3200, thinkingConfig: { thinkingLevel: "low" } }
          })
        }
      );

      if (!googleResponse.ok) {
        // Google's full error message is deliberately not returned to the browser.
        // It may include account- or project-specific information.
        const errorData = await googleResponse.json().catch(() => ({}));
        const providerStatus = String(errorData?.error?.status || "UNKNOWN").slice(0, 40);
        console.error("Gemini API error", googleResponse.status, providerStatus);
        if (googleResponse.status === 429) {
          return reply({ error: "Gemini API 사용량 또는 요청 횟수 한도에 도달했습니다. 잠시 후 다시 시도하세요. (429)" }, 429, origin);
        }
        if (googleResponse.status === 400) {
          const message = providerStatus === "FAILED_PRECONDITION"
            ? "Gemini API 무료 사용 가능 지역이나 결제 설정을 확인해 주세요."
            : "Gemini API 요청 형식을 확인해 주세요.";
          return reply({ error: message + " (400 / " + providerStatus + ")" }, 502, origin);
        }
        if (googleResponse.status === 404) {
          return reply({ error: "요청한 Gemini 모델을 사용할 수 없습니다. 모델 ID 또는 프로젝트의 모델 접근 권한을 확인해 주세요. (404 / " + providerStatus + ")" }, 502, origin);
        }
        if (googleResponse.status === 401 || googleResponse.status === 403) {
          return reply({ error: "Gemini API 키의 유효성, 프로젝트 접근 권한 및 API 제한 설정을 확인해 주세요. (" + googleResponse.status + " / " + providerStatus + ")" }, 502, origin);
        }
        return reply({ error: "Gemini API 서버 오류입니다. (" + googleResponse.status + " / " + providerStatus + ")" }, 502, origin);
      }

      const json = await googleResponse.json();
      const text = (json.candidates?.[0]?.content?.parts || [])
        .map((part) => typeof part.text === "string" ? part.text : "")
        .join("").trim();
      if (!text) return reply({ error: "모델에서 텍스트 답변을 받지 못했습니다." }, 502, origin);
      return reply({ answer: text, model: MODEL }, 200, origin);
    } catch (error) {
      console.error("Gemini proxy network error:", error?.name || "unknown");
      return reply({ error: "서버 연결 오류입니다. 잠시 후 다시 시도하세요." }, 502, origin);
    }
  }
};
