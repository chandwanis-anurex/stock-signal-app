# Handoff Notes — Stock Screener & Signal App

Context for picking this project back up in a fresh session (Claude Code, another Cowork session, or a human teammate). The full design reasoning lives in `stock_signal_app_spec.md` — this file is the "why we chose what we chose" companion to it.

## What this project is

An iOS app (React Native/Expo) + Python backend (FastAPI) that: screens all US exchanges via `tradingview-screener`, lets the user attach indicator-based buy/sell rules to a watchlist, fires alerts over SMS/email/push/webhook, and tracks signal performance over time. Full spec: `stock_signal_app_spec.md`.

## Key decisions and why

- **React Native (Expo), not native Swift.** User chose cross-platform deliberately, partly because building/testing native iOS requires Xcode on a Mac, which wasn't guaranteed to be readily available during early development. Expo Go lets you test on a real iPhone with zero Xcode setup; Xcode only becomes mandatory at final App Store build time (`eas build`).
- **`tradingview-screener` is discovery-only, not the data source for signals.** It's an unofficial wrapper around TradingView's internal API — not affiliated with TradingView, subject to their ToS, and can be rate-limited/blocked if hit too hard. We use it purely to build the candidate stock list. All indicator math pulls fresh OHLCV from a dedicated market data API instead, so the signal engine doesn't depend on an unofficial API for anything that drives an actual buy/sell decision.
- **Market data provider: Polygon.io or Alpaca, not Twelve Data.** Twelve Data computes 130+ indicators server-side, which sounds convenient, but it locks you into whatever indicator set the vendor exposes. Polygon/Alpaca give raw OHLCV; we compute indicators locally with `pandas-ta`, so the "complex threshold" logic stays fully custom and isn't capped by a vendor's feature set. `app/services/market_data.py` has a clean provider abstraction if you want to add Twelve Data or swap later.
- **Alerting: Twilio (SMS) + SendGrid (email) + Expo push (not raw APNs) + generic webhooks.** Expo's push service handles the APNs handshake for you — no manual Apple Push certificate wrangling needed for MVP. Webhooks are generic POSTs so they work with TradersPost/SignalStack relays or your own broker integration, without forcing you into TradeStation's OAuth2 flow on day one.
- **Direct TradeStation order placement was deliberately deferred (Phase 5 in the roadmap), not built.** It requires OAuth2 Authorization Code flow, 20-minute access tokens needing refresh, and — more importantly — turns the app into something that can place live trades, which is a much bigger responsibility than generating signals. Recommendation discussed: validate signal quality via the generic webhook path first.
- **Signals only fire on a false→true transition**, tracked via `Rule.last_state` in the DB (see `indicator_engine.py` / `scheduler.py`). This was a deliberate choice to avoid spamming the same alert every scheduler cycle while a condition stays true.
- **Scheduling: in-process APScheduler for MVP, not Celery.** Simpler to run locally; the README/spec flag Celery+Redis as the upgrade path once you have many users or need jobs on separate workers.

## What's built vs. stubbed

| Component | Status |
|---|---|
| Screener service (`screener_service.py`) | Real, wraps `tradingview-screener` |
| Indicator engine (`indicator_engine.py`) | Real logic (RSI, SMA, EMA, MACD, volume), evaluated against live OHLCV |
| Market data providers (`market_data.py`) | Real Polygon + Alpaca HTTP calls, but **you need to supply your own API key** — untested against a live key in this session |
| Alert dispatcher (`alert_dispatcher.py`) | Real Twilio/SendGrid/FCM/webhook calls, but **no keys configured, never actually sent a live alert** |
| Analytics (`analytics_service.py`) | Real checkpoint logic (1d/1w/1m/current returns, win rate) |
| Backend API + DB models | Verified end-to-end with a local SQLite test (create watchlist → rule → alert channel → list signals → performance) — all wiring confirmed working |
| Mobile app screens | All 7 screens written and verified to parse correctly via Babel/JSX; **never actually run in Expo Go or a simulator** — UI layout/UX not visually verified |
| TradeStation direct integration | Not built — webhook-only path exists; spec section 8 has the OAuth2 notes if you build it later |

## Known gaps / open questions

- No user auth yet — `user_id=1` is hardcoded in the screener router as a placeholder.
- No tests beyond the manual end-to-end smoke test described above.
- `pandas-ta`'s latest release requires Python 3.12+; if you're on 3.10/3.11, pin `pandas-ta==0.3.14b0` in `requirements.txt` (noted inline in the file already).
- The rules DSL's `crosses_above`/`crosses_below` only compares against a literal number, not against another indicator's series (e.g., true MACD-crosses-signal-line requires comparing two computed series, not a series vs. a constant) — `indicator_engine.py`'s `_evaluate_term` has a TODO-shaped gap here if you want indicator-vs-indicator crossovers.
- Push notification destination registration (Expo push token) happens client-side in `AlertChannelsScreen.js` but there's no device-token refresh/cleanup logic if a user reinstalls the app.
- No deployment config yet (Dockerfile, etc.) — currently designed for local `uvicorn` + `expo start` only.

## Suggested next steps, in order

1. Get a free Polygon.io or Alpaca API key, drop it in `backend/.env`, and confirm `get_ohlcv`/`get_latest_price` actually return real data for a known symbol (e.g. AAPL).
2. Run the backend, hit `/screener/run` via `/docs`, confirm real TradingView data comes back.
3. Run the mobile app in Expo Go, walk through Watchlist → Rule → Alert Channel creation against the running backend.
4. Add Twilio/SendGrid keys and confirm one real SMS/email actually arrives end-to-end from a manually triggered signal.
5. Only then worry about TradeStation/broker integration, deployment, or polish.
