# Gemini AI 채팅

GitHub Pages 프런트엔드 + Cloudflare Worker + Gemini API로 구성한 개인용 채팅 실험 앱입니다.

- 웹앱: https://informin.github.io/webapps/ai-chat/
- Cloudflare Worker: https://cf-test.mws-5ee.workers.dev/
- 서버 소스: [worker.js](./worker.js)
- 기본 모델: gemini-3.8-flash (2026년 10월 현재 Google 권장 3.8 Flash; 응답의 thinkingLevel=low)

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

## 모델 업데이트와 API 오류

- 2026년 9월부터 신규 프로젝트의 Gemini 2.5 접근이 제한되어 404 NOT_FOUND가 발생할 수 있습니다. 공식 권장 신규 모델인 `gemini-3.8-flash`로 변경했습니다.
- 400 오류는 요청 형식이나 결제 설정, 404 오류는 모델/프로젝트 접근 문제, 401/403은 API 키/권한 문제일 수 있습니다. Worker는 상태 코드와 안전한 범주의 원인을 표시하지만 Google의 원문 오류나 비밀값을 그대로 브라우저로 전달하지 않습니다.
- **GitHub의 `worker.js` 수정은 Cloudflare에 자동 배포되지 않습니다.** 변경된 전체 소스를 Cloudflare의 `cf-test` > Edit code에 붙여넣고 Deploy해야 합니다.
- Google AI Studio의 사용량 및 과금 설정을 확인하세요. 3.8 Flash는 무료 API 요청이 제공되는지 프로젝트 별 확인이 필요하며, 유료 호출 시 비용이 발생할 수 있습니다.

## Cloudflare 진단 로그로 Gemini API 오류 확인

1. 최신 `worker.js`를 Cloudflare `cf-test` > **Edit code**에 전체 붙여넣고 **Deploy**합니다. (GitHub 수정만으로는 Worker가 업데이트되지 않습니다.)
2. `cf-test`의 **Observability > Logs**에서 로그를 열거나 **Logs > Live**를 선택합니다. 실시간 로그를 보려면 수집이 활성화되어 있어야 합니다.
3. 새 탭에서 [AI 채팅](https://informin.github.io/webapps/ai-chat/)에 짧은 질문을 한 번 전송합니다.
4. 로그에서 `Gemini API diagnostic` 항목을 확인합니다. `httpStatus`, `googleStatus`, `googleMessage`가 표시됩니다. `googleMessage`는 Google 오류 설명에서 키/이메일/URL/긴 숫자를 가린 최대 500글자입니다.
5. Cloudflare 로그에는 접속 시각 및 요청 정보가 함께 나타날 수 있습니다. 로그 전체를 공유하지 말고 해당 진단 항목에서 민감 정보가 없는지 확인한 뒤 필요한 부분만 공유하세요.

일반 사용자에게 반환되는 응답에는 이 Google 오류 원문을 포함하지 않습니다. 사용 종료 후에는 상세 진단 로그가 필요한지만 검토하세요.
