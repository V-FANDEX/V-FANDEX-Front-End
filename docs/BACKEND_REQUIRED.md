# V-FANDEX Backend 요구사항

확인 기준: `V-FANDEX/V-FANDEX-Back-End` `main` (`c70ce35`, 2026-09-12 확인).

프론트엔드는 현재 존재하는 REST 계약만 호출합니다. 아래 항목이 구현되기 전까지 화면에는 빈 상태를 표시하며 가격, 호가, 체결, 주문 상태를 생성하지 않습니다.

현재 Backend의 scenario apply 및 market simulation은 가격을 직접 변경하는 기존 모델입니다. 목표 아키텍처에서는 Event가 가격을 직접 바꾸지 않고 참여자의 주문과 Market Engine 체결을 통해서만 가격이 형성되도록 Backend 도메인 변경이 필요합니다.

## 현재 연결된 REST API

- `GET /markets`, `GET /markets/:id`, `GET /markets/:marketId/stocks`
- `GET /stocks`, `GET /stocks/quotes`, `GET /stocks/:id`, `GET /stocks/:id/chart`
- `POST /trades/buy`, `POST /trades/sell`, `GET /trades/me`
- `GET /portfolio/me`
- `POST /conditional-orders`, `GET /conditional-orders/me`, `PATCH /conditional-orders/:id/cancel`
- `GET /scenarios`, `GET /rankings`, `GET /rankings/season/:seasonId`, `GET /rankings/me`
- 인증, 관심 종목, 배당, 시즌 및 기존 Admin API

## 필요한 REST API

### 시장 집계와 지수

- `GET /markets/overview`: 전체 거래대금, 자금 흐름, 상승/하락/거래량/거래대금 상위
- `GET /markets/:marketId/index`: 지수, 전일 종가, 등락률, 거래대금, 산출 시각
- `GET /markets/:marketId/index/candles`: 실제 시장 지수 시계열
- Market 응답에 `status: OPEN | CLOSED | HALTED`를 명확히 제공

### 주문과 체결

- `GET /stocks/:stockId/orderbook`: bids/asks, price, quantity, cumulativeQuantity, sequence, updatedAt
- `GET /stocks/:stockId/trades`: 공개 최근 체결 시각, 가격, 수량, 선택적 aggressor side
- `POST /orders`: BUY/SELL, MARKET/LIMIT, quantity, LIMIT price. `Idempotency-Key` 지원 권장
- `GET /orders/me`: PENDING/OPEN/PARTIALLY_FILLED/FILLED/CANCELED/REJECTED 상태와 체결/잔여 수량
- `DELETE /orders/:orderId` 또는 취소 전용 명시적 endpoint

현재 `POST /trades/buy|sell`은 주문 원장이 아니라 요청 즉시 현재가로 거래를 생성합니다. DTO의 `LIMIT` enum에는 limit price 필드가 없어 실제 지정가 주문으로 사용할 수 없습니다.

### Candle

현재 차트는 PriceHistory를 분/시간/일로 bucket 처리하지만 거래량과 표준 candle 계약이 완전하지 않습니다. 다음 필드가 필요합니다.

`timestamp`, `open`, `high`, `low`, `close`, `volume` (decimal은 JSON string 권장)

지원 interval은 명시적으로 문서화해야 합니다. 후보: `1m`, `5m`, `15m`, `1h`, `1d`.

### Portfolio와 이벤트

- Portfolio 응답에 총 자산, 현금, 주식 평가액, 평가 손익, 실현 손익 및 `asOf`
- 자산 변화 그래프용 `GET /portfolio/me/history`
- 공개 뉴스/이벤트 API: 제목, 내용, 발생 시각, 관련 Market/Stock, `OFFICIAL | RUMOR | UNVERIFIED`
- 공개 응답에서 `sentiment`, `importance`, `surprise`, 내부 impact score 제외

### AI Agent

- 공개 `GET /agents`: 이름, 공개 투자 스타일, 주요 Market, 총 자산, 수익률, 순위
- 사용자/AI/전체/시즌 랭킹 filter 계약 명시
- 내부 프롬프트, 계산식, risk hidden value는 제외

## 필요한 WebSocket 계약

현재 Backend에는 WebSocket gateway와 관련 패키지/endpoint가 없습니다. 구현 시 다음을 문서화해야 합니다.

- 연결 URL, 인증 방식, heartbeat, reconnect 시 resume/sequence 정책
- stock subscribe/unsubscribe request와 acknowledgement
- quote, trade, order book, market index, public event, user order, portfolio 갱신 payload
- 이벤트 이름은 Backend가 확정하며 프론트에서 예시 이름을 강제하지 않음
- order book snapshot/delta 구분과 sequence gap 복구 방식

프론트 구현 조건: 현재 보고 있는 종목만 구독, 중복 연결/구독 방지, cleanup, exponential backoff, LIVE/RECONNECTING/OFFLINE 상태.

## 현재 막힌 화면

- Stock 상세의 실제 호가창과 공개 최근 체결
- MARKET/LIMIT 통합 주문과 일반 주문 내역/취소
- 실시간 push 갱신과 연결 상태
- Market 지수/자금 흐름/시장 시계열
- Portfolio 자산 히스토리
- 공식/루머 구분이 있는 뉴스
- AI 투자 스타일과 주요 활동 Market

## 배포 연동

Frontend Railway 변수는 `VITE_API_BASE_URL`이며 WebSocket 제공 후 `VITE_WS_URL`을 설정합니다. Backend는 frontend public domain을 `CORS_ORIGIN` 허용 목록에 추가해야 합니다. CORS를 프론트 proxy로 우회하지 않습니다.
