# 다음 작업용 Codex 프롬프트

V-FANDEX frontend 저장소에서 현재 구조와 브랜드를 유지하며 후속 작업을 진행하라. 먼저 `docs/FRONTEND_ANALYSIS.md`와 `docs/BACKEND_REQUIRED.md`를 읽고 실제 Backend 최신 계약을 다시 확인하라. Git commit/push는 요청받지 않으면 하지 마라.

우선순위:

1. Backend에 주문 원장 API가 추가되었는지 확인하고, 실제 계약이 있을 때만 MARKET/LIMIT 주문과 `/orders` 목록/취소를 구현한다. submit 중복 방지와 Idempotency-Key를 연결한다.
2. Backend WebSocket 계약이 추가되었을 때만 종목 단위 subscribe/unsubscribe client를 구현한다. 단일 연결, 중복 구독 방지, cleanup, exponential backoff, LIVE/RECONNECTING/OFFLINE UI와 sequence gap 복구를 테스트한다.
3. 실제 order book과 공개 최근 체결 API가 생겼다면 Stock 상세의 빈 상태를 실제 컴포넌트로 교체한다.
4. market index/overview API가 생겼다면 프론트 집계 없이 `/markets`와 dashboard를 완성한다.
5. 기존 number 기반 money mapper를 decimal-safe 표현 계층으로 점진 이전한다. 큰 decimal string을 무조건 Number로 변환하지 않는다.
6. Vitest + React Testing Library를 추가해 API 오류, empty state, 주문 중복 클릭, halted 비활성화, WebSocket reconnect/cleanup을 테스트한다.
7. Next.js 전환이 제품 결정으로 확정된 경우에만 별도 마이그레이션 계획을 작성한다. 이번 Vite 앱을 이유 없이 전체 재작성하지 않는다.

금지: 가짜 가격/차트/order book/trade, 프론트 order matching/AI 판단, hardcoded localhost production URL, Backend에 없는 endpoint 가정.
