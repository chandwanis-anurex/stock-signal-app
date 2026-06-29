# Stock Screener & Signal App — Architecture & Spec

## 1. What this app does

A mobile app (iOS, built cross-platform with React Native) backed by a Python service that:

1. Screens all US stock exchanges using `tradingview-screener`, filtered by criteria the user picks in the app.
2. Lets the user attach technical indicators with custom threshold logic to that list, and generates buy/sell signals when those thresholds are crossed, using live market data from a dedicated data API.
3. Delivers signals over SMS, email, iOS push notifications, and webhooks to brokers/trade automation tools (TradeStation, etc.).
4. Logs every signal with the price at the time it fired, and tracks subsequent price action so you can see how each strategy actually performed.

A native-Swift rebuild is possible later, but everything below is the same regardless of front-end framework, since the logic lives in the backend.

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile app | React Native (Expo) | One codebase targets iOS now, Android later if wanted. Avoids needing a Mac for early development; Xcode still required for final App Store build/signing. |
| Backend API | Python, FastAPI | Async, fast to build, pairs naturally with `tradingview-screener` and pandas-based indicator code. |
| Task scheduling | APScheduler (MVP) → Celery + Redis (scale) | Screener runs and indicator checks need to run on a schedule (e.g., every 1–5 min during market hours). |
| Database | PostgreSQL (SQLite for local dev) | Stores criteria, watchlists, indicator configs, signals, performance history. |
| Cache/queue | Redis | Caches screener results, queues alert dispatch jobs. |
| Screening | `tradingview-screener` (Python pkg) | Already specified — queries all US exchanges with SQL-like filters across 3000+ fields. |
| Market data (for indicators) | Twelve Data (primary candidate) or Polygon.io | Both provide US-exchange OHLCV plus computed technical indicators via API. See §7 for comparison. |
| SMS | Twilio | Industry standard, reliable delivery, simple REST API. |
| Email | Twilio SendGrid | Same vendor family as Twilio SMS, fast setup, generous free tier. |
| iOS push | Apple Push Notification service (APNs), via Firebase Cloud Messaging as the delivery layer | FCM gives one unified push API for RN apps and handles the APNs handshake for you. |
| Broker webhooks | Generic outbound HTTPS webhook + TradeStation REST API (OAuth2) | TradeStation has an official REST trading API (OAuth2 Authorization Code flow); third-party relays like TradersPost/SignalStack exist if you'd rather not implement broker auth yourself. |

## 3. System architecture

```
┌─────────────────────┐
│   React Native App   │
│  (iOS, via Expo)      │
└──────────┬───────────┘
           │ REST/WebSocket
┌──────────▼───────────────────────────────────────────────┐
│                     FastAPI Backend                        │
│                                                              │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Screener    │  │ Indicator /   │  │ Alert Dispatcher    │ │
│  │ Service     │→│ Signal Engine │→│ (SMS/Email/Push/Hook)│ │
│  │ (tradingview-│  │ (pulls market │  │                     │ │
│  │ screener)   │  │ data, evals   │  │                     │ │
│  │             │  │ thresholds)   │  │                     │ │
│  └────────────┘  └──────────────┘  └────────────────────┘ │
│         │                │                    │             │
│         ▼                ▼                    ▼             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           PostgreSQL (criteria, signals, perf)         │ │
│  └──────────────────────────────────────────────────────┘ │
│         APScheduler/Celery runs the above on a timer        │
└──────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
  Market Data API                 Twilio / SendGrid / FCM /
  (Twelve Data or Polygon)        TradeStation API / generic webhook
```

## 4. Core workflows

### 4.1 Build a stock list (Screener)

- User builds criteria in-app (e.g., market cap > $500M, RSI < 30, volume > 1M, sector = Technology, exchange in {NASDAQ, NYSE, AMEX}).
- App sends criteria as JSON to backend `/screener/run`.
- Backend translates JSON into a `tradingview-screener` `Query`, scoped to US exchanges, and returns the matching list.
- User can save this as a named "Watchlist" that re-runs automatically on a schedule.

### 4.2 Attach indicators & define signal logic

- For a given watchlist, the user picks one or more indicators (RSI, MACD, moving average crossovers, Bollinger Bands, volume spikes, etc.) and sets thresholds.
- User can combine conditions with AND/OR logic and build a "complex threshold" (e.g., `RSI < 30 AND MACD crosses above signal line AND volume > 20-day average * 1.5` → BUY).
- These rules are stored as a structured JSON config (a small rules DSL), not free-text, so the engine can evaluate them deterministically.
- On each scheduled run, the Indicator/Signal Engine pulls fresh OHLCV + indicator values for every stock in the watchlist from the market data API, evaluates each rule, and emits a BUY or SELL signal when a rule's condition transitions from false → true (to avoid repeat-firing every cycle).

### 4.3 Deliver signals

- Each user configures one or more alert channels per watchlist/rule:
  - SMS via Twilio
  - Email via SendGrid
  - Push notification (in-app, via FCM/APNs) — works even if the phone is locked, as long as the app has notification permission; does not require the app to be in the foreground.
  - Webhook — POSTs a JSON payload (symbol, side, price, indicator values, timestamp) to a URL the user provides. For TradeStation specifically, the backend can either (a) just fire a generic webhook the user points at their own automation, or (b) directly place an order via TradeStation's OAuth2 REST API if the user connects their TradeStation account.
- All channels are opt-in per rule, so a user can route "high-confidence" rules to SMS + webhook and "watch only" rules to push notification only.

### 4.4 Track performance (Analytics)

- Every signal fired is written to a `signals` table: symbol, rule id, side (buy/sell), price at signal time, timestamp, indicator snapshot.
- A background job periodically fetches the current price for open signals and computes running P&L (e.g., assuming a hypothetical position opened at the signal price), plus fixed checkpoints (+1 day, +1 week, +1 month return).
- The app's Analytics screen shows, per rule: win rate, average return, distribution of outcomes, and an equity curve if you "had taken every signal."
- This is purely informational tracking — the app does not need to place real trades for this to work, and signal accuracy is separate from whether the user (or their broker, via webhook) actually acted on it.

## 5. Data model (simplified)

- **users** — id, email, phone, push_token, created_at
- **watchlists** — id, user_id, name, screener_criteria (JSON), refresh_interval, last_run_at
- **watchlist_symbols** — watchlist_id, symbol, exchange, added_at (cache of latest screener run)
- **rules** — id, watchlist_id, name, condition_json (the indicator/threshold DSL), side_logic (separate buy and sell conditions), active
- **alert_channels** — id, rule_id, channel_type (sms/email/push/webhook), destination (phone/email/url), active
- **signals** — id, rule_id, symbol, side, price_at_signal, indicator_snapshot (JSON), fired_at
- **signal_performance** — signal_id, checkpoint (1d/1w/1m/current), price_at_checkpoint, return_pct, computed_at

## 6. App screens (React Native)

1. **Watchlists** — list of saved screeners, "+ New Watchlist" → criteria builder (form-based, not raw query syntax).
2. **Criteria Builder** — pick metric (market cap, P/E, sector, exchange, volume, price, etc.), operator, value; combine with AND/OR. Live preview of match count.
3. **Rule Builder** — per watchlist, pick indicators (dropdown with parameters, e.g., RSI(14)), thresholds, and AND/OR logic; separate builders for BUY and SELL conditions.
4. **Alert Channels** — per rule, toggle SMS/email/push/webhook and enter destination details; webhook screen includes a "Connect TradeStation" OAuth button as a shortcut.
5. **Signal Feed** — real-time/historical list of fired signals, filterable by watchlist/rule/symbol.
6. **Analytics Dashboard** — performance by rule: win rate, avg return, equity curve, best/worst symbols.
7. **Settings** — manage API keys (market data, Twilio, SendGrid), notification permissions, account.

## 7. Market data API comparison (for indicator engine)

| Provider | US coverage | Built-in indicators | Real-time | Free tier | Notes |
|---|---|---|---|---|---|
| Twelve Data | Yes, 50+ exchanges globally | 130+ indicators computed server-side | Yes (websocket on paid) | Limited calls/min | Good fit if you want the API to compute RSI/MACD/etc. for you instead of doing it locally. |
| Polygon.io | Strong, US-focused | No built-in indicators (you compute from OHLCV) | Yes, tick-level | Limited | Best raw data quality/speed; pair with `pandas-ta` or `ta-lib` for indicator math. |
| Alpaca | Good, US-focused | No | Yes | Generous (200 calls/min) | Best if you also want to place real trades through the same provider later. |

Recommendation: start with **Polygon.io or Alpaca for raw OHLCV** and compute indicators locally with `pandas-ta` — this avoids being limited to whatever indicator set a vendor happens to expose, and keeps your "complex threshold" logic fully custom.

## 8. Alerting & webhook integration details

- **SMS/Email**: straightforward REST calls to Twilio/SendGrid from the Alert Dispatcher; both have official Python SDKs.
- **Push**: register device tokens via Firebase Cloud Messaging in the RN app; backend sends to FCM, which relays to APNs for iOS delivery.
- **Webhooks**: generic — backend POSTs a JSON payload to any URL the user supplies (e.g., TradersPost or SignalStack endpoints, which already know how to translate a generic webhook into TradeStation/Tradier/Alpaca orders).
- **Direct TradeStation integration** (optional, more work): TradeStation's API uses OAuth2 Authorization Code flow; access tokens expire after 20 minutes and must be refreshed. This requires the user to authorize your app once, after which the backend can place orders directly. This is materially more engineering than firing a webhook, and carries real financial/regulatory weight (you'd be an app that can place live trades) — recommend starting with the generic webhook path and only building direct broker integration once the signal logic is validated.

## 9. Important caveats

- `tradingview-screener` is an **unofficial** wrapper around TradingView's internal API — not endorsed by TradingView, subject to their Terms of Service, and can be rate-limited or blocked if hit too aggressively. Treat it as the discovery/filtering layer only; don't depend on it for the indicator math that drives trades — that's what the dedicated market data API is for.
- This app generates *signals*, and only places real trades if you explicitly wire up direct broker order placement. Keep these concerns separated in the architecture (signal generation vs. execution) so you can test extensively before any real money risk.
- If you ever route signals to a live brokerage to actually execute trades, that introduces real financial risk and you're responsible for your own trading decisions — treat the analytics/backtest numbers as informational, not guarantees.

## 10. Build roadmap

1. **Phase 1 — Screener MVP**: backend wraps `tradingview-screener`, exposes `/screener/run`; RN app has Criteria Builder + Watchlists screen.
2. **Phase 2 — Indicator engine**: integrate market data API, build the rules DSL + evaluation engine, Rule Builder screen.
3. **Phase 3 — Alerting**: Twilio, SendGrid, FCM push, generic webhook; Alert Channels screen.
4. **Phase 4 — Analytics**: signal logging, performance checkpoint jobs, Analytics Dashboard.
5. **Phase 5 — Broker integration (optional)**: TradeStation OAuth2 + direct order placement.
6. **Phase 6 — Polish & App Store**: error handling, auth/security hardening, TestFlight, submission.
