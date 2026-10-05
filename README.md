# V-FANDEX-Front-End

팬덤 가상 거래소의 Vite + React + TypeScript 프론트엔드입니다. 기존 React Router / Zustand / Recharts를 사용합니다.

## 로컬 실행

```bash
cp .env.example .env
# .env의 VITE_API_BASE_URL에 테스트 백엔드 origin 설정
npm ci
npm run dev
```

`VITE_API_BASE_URL`에는 `/api`를 붙이지 않습니다. 미설정 시 실제 서버를 임의로 선택하지 않고 연결 설정 오류를 표시합니다. PostgreSQL/Redis/OpenAI 비밀키를 VITE 환경변수에 넣지 않습니다.

`VITE_WS_URL`을 비우면 API origin에서 `ws(s)://…/ws`를 도출합니다. native WebSocket이며 토큰은 authenticate 메시지로 전달합니다. 백엔드 CORS/Origin에는 프론트 origin을 허용해야 합니다.

## 검증

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

테스트는 네트워크/WS 경계를 mock한 계약·React 화면 테스트입니다. 실제 LLM·정리·발송·원격 배포를 실행하지 않습니다.

## 현재 계약과 인계

[구현 및 검증 인계 (2026-10-05 갱신)](docs/FRONTEND_HANDOFF_2026-10-04.md)를 확인하세요. 기준은 백엔드 migration25 (`20261002100000_ai_observations`)입니다. `docs/BACKEND_REQUIRED.md` 등 9월 프론트 분석 문서는 과거 기록이며 최신 백엔드 계약이 아닙니다.

기존 Railway 설정은 유지했습니다. 이 작업에서는 commit/push/배포를 수행하지 않았습니다.
