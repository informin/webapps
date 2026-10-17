# Gemini AI 채팅

GitHub Pages 프런트엔드 + Cloudflare Worker + Gemini API로 구성한 개인용 채팅 실험 앱입니다.

- 웹앱: https://informin.github.io/webapps/ai-chat/
- Cloudflare Worker: https://cf-test.mws-5ee.workers.dev/
- 서버 소스: [worker.js](./worker.js)
- 기본 모델: gemini-2.5-flash

## 처음 설정하는 방법

1. Cloudflare 대시보드 > Workers & Pages > cf-test > Settings > Variables and secrets에 **Secret** 2개를 추가합니다.
   - `GEMINI_API_KEY`: Google AI Studio에서 발급한 Gemini API 키
   - `CHAT_ACCESS_TOKEN`: Gemini API 키와는 **다른** 충분히 길고 무작위인 접속 암호
   - Secret **값**은 GitHub, HTML, 채팅 메시지에 절대로 넣지 마세요.
2. Cloudflare > cf-test > **Edit code**에서 기존 테스트 코드를 모두 `worker.js` 내용으로 교체한 뒤 **Deploy**합니다.
3. Worker 루트 URL을 열면 `Gemini chat proxy is running.`라고 나와야 합니다.
4. 웹앱에 접속해 **접속 암호**에 `CHAT_ACCESS_TOKEN` 값을 입력합니다. 이 입력란은 **Gemini API 키 입력란이 아닙니다.**
5. 질문을 전송해 Gemini 답변이 오는지 확인합니다.

## 보안과 제한

- Gemini 키는 Cloudflare Worker Secret으로만 제공되며 웹브라우저로 전달하지 않습니다.
- CORS는 GitHub Pages 출처만 허용하지만, CORS는 API 남용 방지나 인증 수단이 아닙니다. 별도로 `CHAT_ACCESS_TOKEN`을 확인합니다.
- 이 구성은 **개인 테스트용**입니다. 대규모 공개 서비스 전에는 Cloudflare Rate Limiting, 추가 인증, 사용량 제한, 비용 알림 등을 별도로 설정하세요.
- 브라우저는 대화 내용을 새로고침 후 보존하지 않습니다. 대화 입력은 Gemini API에 전송됩니다.
- Gemini API 가격·제한은 사용자의 Google 프로젝트 과금 및 모델 정책에 따릅니다.
- `TEST_SECRET`은 이 앱에서 사용하지 않습니다.

## API 연결 설명

`POST /chat`에 다음 형식을 전송합니다.

```json
{"messages":[{"role":"user","text":"안녕하세요?"}]}
```

헤더에는 `Content-Type: application/json`과 `X-Chat-Token: <CHAT_ACCESS_TOKEN>`을 사용합니다.
