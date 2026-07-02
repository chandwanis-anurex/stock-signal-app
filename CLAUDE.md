# SignalFlow — CLAUDE.md

## What this project is
SignalFlow is an iOS stock signal app. Users create watchlists of stocks (via TradingView screener criteria or manual symbol entry), define buy/sell rules using technical indicators, receive alerts via webhook/email/SMS/push, and track signal performance over time. It is NOT a brokerage — it fires signals only.

## Repo layout
```
stock-signal-app/
├── backend/                  FastAPI backend, deployed on Railway
│   └── app/
│       ├── main.py           Entry point, lifespan, DB migration
│       ├── auth.py           JWT auth, bcrypt
│       ├── database.py       SQLAlchemy engine + session
│       ├── schemas.py        Pydantic models + DSL definitions
│       ├── models/models.py  SQLAlchemy ORM models
│       ├── routers/
│       │   ├── auth.py       POST /auth/register, /auth/login
│       │   ├── screener.py   POST /screener/watchlists, /watchlists/manual, GET /watchlists
│       │   ├── rules.py      CRUD for rules + alert channels
│       │   └── signals.py    GET /signals, DELETE /signals/{id}, performance
│       └── services/
│           ├── screener_service.py   TradingView screener wrapper
│           ├── indicator_engine.py   Pure pandas indicator math (RSI, MACD, SMA, EMA, Williams %R, UO, BB)
│           ├── market_data.py        Polygon / Alpaca OHLCV + company name lookup
│           ├── alert_dispatcher.py   Webhook (TradersPost aware), email, SMS, push
│           ├── analytics_service.py  Signal performance checkpoints (1d/1w/1m/current)
│           └── scheduler.py          APScheduler — runs screener + indicator checks periodically
└── mobile-app/               React Native / Expo SDK 54
    ├── App.js                Navigation (stack + bottom tabs), font loading
    ├── theme.js              Design tokens — colors, typography (Inter), layout
    ├── api/client.js         All API calls to backend
    ├── data/companyNames.js  Local fallback dictionary (~100 common tickers)
    ├── components/
    │   ├── Logo.js           Bull icon shown in every screen header (top right)
    │   └── Dropdown.js       Reusable searchable modal dropdown
    ├── screens/
    │   ├── AuthScreen.js
    │   ├── WatchlistsScreen.js
    │   ├── WatchlistDetailScreen.js
    │   ├── CriteriaBuilderScreen.js   TradingView screener filter builder
    │   ├── ManualWatchlistScreen.js   Comma-separated symbol entry
    │   ├── RuleBuilderScreen.js       Indicator condition builder + Take Profit / Stop Loss %
    │   ├── RuleDetailScreen.js        View rule + navigate to Alert Channels / Edit
    │   ├── AlertChannelsScreen.js     Webhook / Email / SMS / Push config + Send Test
    │   ├── SignalFeedScreen.js         Swipe-to-delete, company name, date+time
    │   ├── AnalyticsScreen.js         Daily/Weekly/Monthly/All-Time period tabs
    │   └── HelpScreen.js              Version info + usage guide
    └── assets/
        ├── icon.png          1024×1024 RGB (no alpha) — bull logo on dark bg
        └── splash.png        2048×2048 — same bull centered on dark bg
```

## Infrastructure
| Service | Platform | Notes |
|---------|----------|-------|
| Backend API | Railway | Auto-deploys on push to `main` |
| Database | PostgreSQL on Railway | SQLAlchemy create_all + inline ALTER TABLE migrations in main.py lifespan |
| Mobile | EAS Build (Expo) | `preview` profile = ad-hoc internal; `production` profile = App Store |
| Market data | Polygon.io | OHLCV + ticker reference (company names). Key: `MARKET_DATA_API_KEY` env var |
| Alerts — webhook | httpx POST | TradersPost-aware: detects URL and sends `{ticker, action, price, sentiment}` |
| Alerts — email | SendGrid | Key: `SENDGRID_API_KEY`, `ALERT_FROM_EMAIL` |
| Alerts — SMS | Twilio WhatsApp | Keys: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM/TO` |

## Key env vars (Railway)
```
DATABASE_URL
JWT_SECRET
MARKET_DATA_PROVIDER=polygon
MARKET_DATA_API_KEY=
SENDGRID_API_KEY=
ALERT_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
TWILIO_WHATSAPP_TO=
```

## Running locally
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Mobile
cd mobile-app
npm install
npx expo start          # Expo Go (JS changes only)
eas build --profile preview --platform ios   # full native build
eas build --profile production --platform ios # App Store build
eas submit --platform ios                     # upload to TestFlight
```

## App Store / TestFlight
- Bundle ID: `com.chandwanis.signalflow`
- Build number: auto-incremented remotely by EAS on every `eas build --profile production` (see `eas.json`: `cli.appVersionSource: "remote"`, `build.production.ios.autoIncrement: true`) — don't set `ios.buildNumber` in `app.json`, it's ignored
- App Store Connect: appstoreconnect.apple.com
- EAS project ID: `704b6240-b34b-43ee-a76e-2be8ddade1e9`
- EAS owner: `rakeshchandwani`
- Icon must be RGB PNG (no alpha) — enforced, was fixed 2026-06-30

## Data model (condensed)
```
User → Watchlist → WatchlistSymbol (symbol, company_name)
                 → Rule → AlertChannel (webhook/email/sms/push)
                        → Signal → SignalPerformance (1d/1w/1m/current checkpoints)
```

## Indicator engine
Supported indicators (all computed with pandas from Polygon OHLCV):
`RSI`, `SMA`, `EMA`, `MACD`, `MACD_SIGNAL`, `WILLIAMS_R`, `ULTIMATE_OSC`, `VOLUME`, `VOLUME_SMA`, `CLOSE`, `BB_UPPER`, `BB_LOWER`

Operators: `gt`, `gte`, `lt`, `lte`, `crosses_above`, `crosses_below`

Sell condition also supports `take_profit_pct` and `stop_loss_pct` fields (% from entry, stored in sell_condition JSON).

## Design system
- Dark theme: bg `#0a0a0f`, card `#13131a`, accent `#FF9F0A` (orange)
- Buy: `#00c805` (green), Sell: `#ff3b30` (red)
- Font: Inter (400/600/700/800) loaded via `@expo-google-fonts/inter`
- All typography goes through `theme.js` — never use raw `fontWeight` strings, always `fontFamily: "Inter_700Bold"` etc.

## Known deferred items
- Edit Rule saves as new rule (no backend PATCH for rules yet — update endpoint missing)
- Push notifications require production EAS build (not Expo Go)
- TradersPost strategy must be active on their side to execute trades (webhook fires regardless)
