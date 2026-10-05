# 프론트 후속 구현 인계 — 2026-10-04 (KST)

최종 갱신 / 검증: 2026-10-05. 파일명은 최초 작성일을 유지한다.

## 기준과 실제 연결 여부

- 프론트: 기존 Vite / React 18 / TypeScript / React Router / Zustand / Recharts 유지. 작업 시작 시 git working tree는 깨끗했으며 사용자 변경을 되돌리지 않았다.
- 최종 대조한 백엔드: `V-FANDEX/V-FANDEX-Back-End`, commit `4d3c5de63d11fa77e62787459163406a4d3f7e50` (2026-10-03), migration25 `20261002100000_ai_observations`까지 확인.
- 백엔드의 `API_CONTRACT.md`, `WEBSOCKET_CONTRACT.md`, `AI_AGENT_SPEC.md`, `EVENT_ENGINE.md`, `OPERATIONS.md`, `SEASONS.md`, 관련 controller/DTO/service를 읽었다. 임시 체크아웃만 사용했으며 백엔드는 변경하지 않았다.
- 작업 초기에 읽은 공개 HEAD `7eedbc4…`는 migration15였으나, 작업 재개 후 위 최신 HEAD가 공개되어 다시 대조했다. 프론트 저장소의 동명/과거 문서로 새 계약을 추정하지 않았다.
- 기존 Render 서버 `/docs`, `/docs-json`은 초기 확인 시 200, OpenAPI 경로 63개였고 새 관측/보존 계약이 없었다. 10월 4일 재조회는 15초 timeout이었다. 이 서버가 migration25를 실행한다고 판단하지 않았다.
- **실제 최신 API 연동 검증은 완료하지 않았다.** migration25 테스트 서버 URL, 테스트 ADMIN/USER 계정, 테스트 데이터가 제공되지 않았다. `.env.example`과 기본 API fallback에서 과거 운영 서버 자동 선택을 제거했다.
- 소스에는 실제 REST/WS 호출과 UI가 연결되어 있다. 검증은 mock transport를 사용하는 계약/React 테스트이며 실서비스 성공을 의미하지 않는다.

## 연결한 화면

| 화면 | 구현 / 주요 파일 |
| --- | --- |
| 관리자 AI 계정 | `src/components/admin/AiWorkspace.tsx`: 생성/부분 수정/비활성화, 13개 성격, 관심 대상, 6개 보정 설정, agentId/accountId 구분, 수동 판단. initialCash는 생성에만 보낸다. |
| 판단 이력 | 위 파일: 계정별 cursor 목록/상세, STARTED/HOLD/ORDERS_SUBMITTED/ERROR 안내, 당시 profile/result와 현재 orders/Execution 집계 분리. Maker null은 대시로 표시. |
| 실제 시즌 성과 | `StrategyAnalysis.tsx`: 시즌과 AI profile 1~50개, LIVE/CLOSED/BASELINE_UNAVAILABLE, 외부 자본 조정, 문자열 returnPct/null, 현재 전략과 과거 판단 집계 구분. |
| 과거 가격 비교 | 같은 파일의 별도 탭: 지원 전략만 1~8개, 숫자·소수·label·UTC 정각·완료 시간/90일 검증, source/parameters/limitations, 서버 equity 곡선과 가상 거래 표. 계정 자동 적용 없음. |
| 섹터 / 종목 목록 | `SectorsPanel.tsx`, `StockListPage.tsx`: 섹터 생성/이름 수정, stock.sectorRevision으로 배정/미분류(null), 공개/관리자 page sectorId 필터. |
| 스토리라인 | `StorylinesPanel.tsx`, `utils/storyline.ts`: PAUSED 생성, 독립/명시 후속/자동 후속/2~4개 병합, 추가 대상 최대 9개, 저장 원본 기반 JSON 초안 편집·preview·규칙 검토·명시 재개. |
| 요약 / 의미 검토 | 위 화면: GET만 자동 조회, MISSING/AVAILABLE/STALE 구분과 오래된 본문 숨김, 명시 유료 POST, 보고서 revision과 서사 revision 분리, 성공 후 GET, 인용 기사/초안 단계 링크. |
| 반복 일정 / 사용량 | `SchedulesPanel.tsx`: 전역 UTC 한도와 4종 시도, revision PATCH, 일정 생성/부분 수정/필터별 page/실행 이력, 수동 실행 결과 상태 판정. 병합 옵션 없음. |
| 내부 운영 | `OperationsPanel.tsx`: 시장/워커/현재 경보, 처리 정지 주문 진단·재개·취소, 경보 이력/상세/최초 확인/관측 갱신, duration과 sampler 최신성 분리. |
| 보존 | `RetentionPanel.tsx`: 정책/자동 상태/기한 실행, preview의 종류별 items 선택 → 확인 대화상자 → cleanup, 409 재preview와 선택 해제, 배치 아카이브 목록/원문 상세. |
| 시즌 운영 | `SeasonsPanel.tsx`: UPCOMING 생성, 기본 RESET 명시 확인 / CARRY 선택, 종료. 거래 이력 삭제식 옛 reset 화면을 교체. |
| 사용자 거래 | `EngineTradePanel.tsx`, `ConditionalOrdersPage.tsx`: MARKET/LIMIT `/orders`, UUID 멱등 키, 202 접수 안내, 현재 주문/잔량/체결량 및 잔량 취소. 구형 조건 주문 생성/직접 가격 변경 호출 제거. |
| 실시간 종목 | `StockDetailPage.tsx`, `useMarketSnapshot.ts`, `services/realtime.ts`: 실제 quote/orderbook/trades/candles, native WS 인증/구독/중복 제거, backoff+jitter, 재접속/resync/REST polling, REST 응답 중 알림 재조회. |
| 자산 / 순위 / 뉴스 | `PortfolioPage.tsx`, `RankingsPage.tsx`, `ScenariosPage.tsx`: Decimal 자산 계산, 종료 시즌 자산/순위 서버 스냅샷, 공개 근거 기사 조회. `DividendsPage.tsx`는 실제 지급/청구 결과만 표시. |

관리자 메뉴는 기존 `/admin`에 통합했다. 시장/종목 CRUD, 사용자, 배당 관리 등 기존 화면은 유지했다. 관리자 배당 설정과 신규 화면의 숨겨진 서사 데이터는 로컬 컴포넌트 상태에만 두며 공개 Zustand 캐시에 넣지 않는다. 일반 사용자로 역할이 바뀌거나 계정이 바뀌면 관리자 화면을 제거/재마운트한다.

## 공통 구현 주의점

- `apiClient.ts`: 환경변수 base URL, Bearer, 문자열/배열 오류 메시지, 원래 요청 path. `/auth/me`의 401만 로그인 만료로 처리한다. 제공자 생성 401은 요청 문맥을 보존하며 무조건 로그아웃시키지 않는다.
- `useRemote.ts`: read abort/늦은 응답 무시, 필터 변경 시 cursor 초기화, 중복 ID 제거, null 끝 처리, 새로고침. **일반 주문 `/orders/me/page`는 `before`**, 신규 관리자/종목 page는 `cursor`다.
- 유료 생성/일정 생성/수동 실행/요약/의미 검토/일반 주문은 작업별 안정된 UUID를 사용한다. 탭 sessionStorage에는 키/경로/SHA256 요청 해시만 저장한다. 프롬프트/세계 상태/응답/토큰은 이 저장소에 넣지 않는다. 새 작업 준비는 별도 명시 동작이다. 같은 작업에서 body가 달라지면 전송을 막는다. 로그아웃 시 작업 키를 정리한다.
- 생성/유료 검토/정리 POST는 effect/GET/탭 이동에서 실행하지 않는다. 요청 중 중복 제출을 차단한다. 409 이후 최신 상태를 보여주며 비용 작업을 새 키로 자동 반복하지 않는다.
- 금액 표시 및 새 금융 화면 계산은 Decimal 문자열/decimal.js다. Recharts 좌표와 기존 대시보드 시각화용 숫자 별칭만 Number를 사용한다. 서버 금액 원문은 별도 보존하며 주문 가격은 문자열이다.
- 모든 날짜 표시는 브라우저 사용자 시간대다. datetime-local 입력은 UTC ISO로 변환하며 비교는 UTC 정각 여부도 검사한다.
- **서사 saved preview에는 stockId/marketId가 없다.** 목록의 저장 원본과 preview revision이 같을 때만 편집기를 채우며, 원본 steps/대표 대상을 보존한다. revision 불일치 시 다시 조회해야 한다.
- **정리 revision은 `preview.policy.revision`**이다. preview는 `{failedRuns:{count,items},resolvedAlerts:{count,items}}`이며 count는 문자열이다.
- 요약 revision과 의미 검토 revision을 별도로 읽는다. STALE 본문은 최신 유효 결과처럼 표시하지 않는다. semanticAccuracy/coverage/blocking 등 근거 한계를 그대로 노출한다.
- WS payload를 가격/주문 상태에 직접 덮어쓰지 않고 REST 조회를 묶어서 수행한다. envelope.id는 bounded set으로 중복 제거하고 서로 다른 종목/계정에 전역 sequence 비교를 하지 않는다. 조회 중 새 무효화가 오면 추가 스냅샷 조회한다. 실제 봉/체결만 사용한다.

## 검증 결과

테스트는 Vitest + Testing Library + jsdom이며 `fetch`/WebSocket을 명시적으로 mock한다. 실제 계정/운영 데이터/LLM을 사용하지 않는다.

| 실행 | 최종 결과 |
| --- | --- |
| `npm test` | 6개 파일, 51개 테스트 통과 |
| `npm run lint` | 통과 |
| `npm run typecheck` | 통과 |
| `npm run build` | 프로덕션 빌드 성공. 공유 차트/Three.js를 포함한 메인 청크의 500 kB 초과 경고는 남아 있음 |
| `git diff --check` | 통과 |

- `tests/contracts.test.ts`: 금액 정밀도, 숫자 범위/소수/기본값, 날짜와 UTC 정각, 병합 상호 배제, 서사 초안 worldUpdates와 추가 대상 검증.
- `tests/api.test.ts`, `tests/hooks.test.tsx`: Bearer/오류 문맥, 로그인 401과 제공자 401, 응답 유실 시 같은 키/본문 재시도, sessionStorage 복구와 민감 본문 미저장, 필터별 cursor 초기화/중복 제거/이전 계정 응답 차단, 주문 before cursor.
- `tests/screens.test.tsx`: 부분 수정, STARTED/ERROR의 현재 주문, Maker null/준비되지 않은 SWING/NOT_DUE, 실제 시즌 상태·자본 조정·문자열 수익률, 비교 변형/label/봉 부족·초과 오류, STALE 숨김/자동 생성 없음, 보고서와 서사 revision 분리, 저장 원본 대상 보존, 일정 FAILED, 정리 선택·확인·409 재preview와 자동 삭제 재시도 없음.
- `tests/access.test.tsx`, `tests/realtime.test.ts`: 관리자 진입 제한/역할 변경, 토큰 메시지 인증, 구독, 중복/묶음 갱신, 재연결/resync/REST fallback.

보존 정책에서 비활성화한 종류 및 조회/실행 중인 후보는 선택할 수 없다. 빌드 청크 경고의 성능 영향, 실제 브라우저 화면/접근성 및 아래 실서버 시나리오는 별도 확인이 필요하다. 테스트 통과는 모든 백엔드 상태 조합이나 실제 체결·제공자 응답의 검증을 의미하지 않는다.

## 외부 환경에서 이어서 검증할 항목

1. migration25가 적용된 **테스트** 백엔드 URL과 프론트 Origin/CORS/WS 허용 설정, ADMIN/USER 계정을 제공하고 `.env`의 VITE_API_BASE_URL을 설정한다. API/AI/Event/Market writer 버전을 함께 확인한다.
2. 실제 응답으로 ADMIN403/401, 대상404, 프로필 수정 재조회, 기록 없는 계정, STARTED/ERROR의 현재 주문, 두 종류의 성과/비교를 확인한다. 가격 비교에는 실제 유효 1h 봉 3~1000개를 가진 종목/기간이 필요하다.
3. 테스트 환경에서만 소액 주문의 접수/부분 체결/취소, 응답 유실 동일 키 재시도, 계정 교체, WS 네트워크 단절/Redis resync, 거래 중 스냅샷 일치를 확인한다. 물리 브라우저/장시간 네트워크 스트레스 E2E는 아직 하지 않았다.
4. 서사 생성·요약·의미 검토의 실제 제공자 호출은 자동 수행하지 않았다. 유료 검증이 필요하면 테스트 환경에서 별도로 명시 실행한다. 현재 검증은 입력·UI·전송 계약이며 모델 품질 평가가 아니다.
5. 보존 정리는 테스트용 오래된 FAILED/STALE 실행·확인된 RESOLVED 경보 fixture로만 검증한다. 운영 cleanup/자동 정책 활성화는 수행하지 않았다. 실제 DB 아카이브 저장까지의 검증은 백엔드 테스트 환경이 필요하다.
6. 실제 RESET/CARRY 전환은 전용 테스트 시즌에서만 수행하고 종료 순위·자산 동결을 확인한다.

외부 알림/웹훅/Slack 설정·발송·재시도, 자동 학습/추천, 아카이브 복구/삭제 기능을 만들지 않았다. commit/push/원격 배포도 수행하지 않았다.
