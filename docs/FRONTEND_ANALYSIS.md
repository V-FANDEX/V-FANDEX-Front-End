> 과거 프론트 기록입니다. 2026-10-04 현재 구현·검증 기준은 [최신 인계 문서](FRONTEND_HANDOFF_2026-10-04.md)를 확인하세요. 이 문서를 최신 백엔드 API 계약으로 사용하지 마세요.

# Frontend 분석 결과

확인일: 2026-09-12

- Framework: Next.js가 아니라 React 18.3 + Vite 6.0 SPA
- Router: React Router 6 (`BrowserRouter`), App/Pages Router 해당 없음
- Language: TypeScript 5.6
- State: Zustand 5 단일 store
- API: `src/services/apiClient.ts` 중앙 fetch client, JWT Bearer token은 localStorage
- Styling: 단일 `src/styles.css`; Tailwind/UI framework 없음
- Chart: Recharts 2.13
- Visual: Three.js 랜딩 배경, Lucide icons, 기존 V-FANDEX SVG/PNG 자산
- WebSocket: Backend와 frontend 모두 미구현
- Deploy: 기존 Railway 전용 설정 없음. 이번 작업에서 `railway.toml`과 PORT 호환 start script 추가

## 기존 화면

소개, 대시보드, Market 목록/상세, Stock 상세, 조건 주문, 포트폴리오, 배당, 랭킹, 시나리오/뉴스, Admin이 구현되어 있었습니다. Admin은 `user.role === 'admin'`일 때만 route와 navigation이 노출됩니다.

## 이번 정리의 기준

현재 구조와 브랜드를 유지하고 Next.js 마이그레이션은 하지 않았습니다. Backend에 없는 order book, 공개 체결, 일반 주문, WebSocket은 구현된 것처럼 가정하지 않습니다. 기존의 프론트 생성 종목/시장/자산 시계열과 가격 방향 추론 UI는 제거했습니다.

금액 모델은 기존 화면 호환 때문에 아직 대부분 `number` mapper를 사용합니다. 신규 market-engine 계약용 타입은 decimal string을 유지하도록 추가했으며, 전면 decimal-safe 마이그레이션은 후속 작업입니다.
