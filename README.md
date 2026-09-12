# V-FANDEX-Front-End
팬덤이 움직이는 가상 거래소 'FANDEX'

## Local Development

```bash
cp .env.example .env
npm install
npm run dev
```

기본 API 서버는 `https://v-fandex-back-end.onrender.com`입니다. 다른 서버를 사용할 때는 `.env`의 `VITE_API_BASE_URL` 값을 변경합니다.

이 저장소는 현재 Next.js가 아닌 Vite 기반 React SPA입니다. 따라서 공개 환경변수는
`NEXT_PUBLIC_*`가 아니라 `VITE_API_BASE_URL`과 `VITE_WS_URL`을 사용합니다. WebSocket은
백엔드 계약이 제공되기 전까지 비워 둡니다.

## Railway

`railway.toml`이 `npm ci && npm run build` 후 `$PORT`로 정적 SPA를 실행합니다.
Railway Service Variables에 `VITE_API_BASE_URL`을 설정하고, Backend의 `CORS_ORIGIN`에는
Frontend public domain을 추가합니다.
