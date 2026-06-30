# SignalFlow — Full Project Context
> Give this file to Claude at the start of any new session to restore full project context.

## Project summary
SignalFlow is a personal iOS stock signal app built by Rakesh Chandwani. It screens stocks using TradingView criteria, evaluates technical indicator rules against live Polygon price data, fires buy/sell signals, and dispatches alerts via webhook/email/SMS. It is NOT a broker — it signals only. The primary webhook destination is TradersPost.

## Current state (as of 2026-06-30)
- Backend: deployed and live on Railway, auto-deploys on push to `main`
- Mobile: in TestFlight (bundle ID `com.chandwanis.signalflow`)
- Auth: email/password with JWT (30-day tokens, stored in AsyncStorage)
- User account: chandwanis@gmail.com / StockSignal2026!

## Repository
GitHub: `https://github.com/chandwanis-anurex/stock-signal-app`
- `main` branch → auto-deploys to Railway
- Working directory: `/Users/rakesh/projects/stock-signal-app`
- EAS project: `rakeshchandwani/stock-signal-app` (ID: `704b6240-b34b-43ee-a76e-2be8ddade1e9`)

## Backend (FastAPI + PostgreSQL on Railway)
**Base URL:** `https://stock-signal-app-production-912e.up.railway.app`

### Routers
| Prefix | File | Key endpoints |
|--------|------|---------------|
| `/auth` | routers/auth.py | POST /register, POST /login |
| `/screener` | routers/screener.py | POST /watchlists, POST /watchlists/manual, GET /watchlists, DELETE /watchlists/{id}, GET /watchlists/{id}/symbols |
| `/watchlists/{id}/rules` | routers/rules.py | POST, GET, GET /{rule_id}, PATCH /alert-channels/{id}, POST /alert-channels, GET /alert-channels, POST /alert-channels/{id}/test |
| `/signals` | routers/signals.py | GET, DELETE /{id}, GET /rules, GET /rules/{id}/performance?period=daily\|weekly\|monthly\|all |

### DB migration approach
No Alembic. `Base.metadata.create_all()` + inline `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `main.py` lifespan function `_run_migrations()`. Add new migrations there.

### Services
- **screener_service.py** — wraps `tradingview_screener` package, returns `name`+`description`+`exchange` etc.
- **indicator_engine.py** — pure pandas, no pandas-ta. Supports RSI, SMA, EMA, MACD, MACD_SIGNAL, WILLIAMS_R, ULTIMATE_OSC, VOLUME, VOLUME_SMA, CLOSE, BB_UPPER, BB_LOWER
- **market_data.py** — Polygon primary (`/v2/aggs/` for OHLCV, `/v3/reference/tickers/{sym}` for company name). Also has Alpaca stub. `get_provider()` returns correct instance based on `MARKET_DATA_PROVIDER` env var.
- **alert_dispatcher.py** — `dispatch(channel, signal)`. Webhook detects TradersPost URLs and sends `{ticker, action, price, sentiment}` instead of generic payload. Calls `raise_for_status()` so errors surface to the app.
- **analytics_service.py** — records SignalPerformance checkpoints (1d/1w/1m/current). `rule_performance_summary(db, rule_id, period)` returns `{total_signals, buy_signals, sell_signals, win_rate, avg_return_pct, best_return, worst_return}`.
- **scheduler.py** — APScheduler, runs screener refresh + indicator evaluation periodically.

### Data model
```
User
  └── Watchlist (screener_criteria JSON, refresh_interval_seconds)
        ├── WatchlistSymbol (symbol, exchange, company_name)  ← company_name added 2026-06-29
        └── Rule (buy_condition JSON, sell_condition JSON, last_state JSON)
              ├── AlertChannel (channel_type: sms|email|push|webhook, destination)
              └── Signal (symbol, side: buy|sell, price_at_signal, indicator_snapshot, fired_at)
                    └── SignalPerformance (checkpoint: 1d|1w|1m|current, return_pct)
```

### sell_condition JSON shape
```json
{
  "logic": "and",
  "terms": [{"indicator": "RSI", "params": {"period": 14}, "operator": "gt", "value": 70}],
  "take_profit_pct": 10.0,
  "stop_loss_pct": 5.0
}
```

## Mobile App (React Native / Expo SDK 54)
Working directory: `/Users/rakesh/projects/stock-signal-app/mobile-app`

### Key files
| File | Purpose |
|------|---------|
| `App.js` | Navigation (NativeStack + BottomTabs), Inter font loading, auth gate |
| `theme.js` | Design tokens — colors, typography (Inter variants), layout |
| `api/client.js` | All fetch calls to backend with JWT auth |
| `data/companyNames.js` | Local fallback dict ~100 tickers for offline company name lookup |
| `components/Logo.js` | Bull icon image shown top-right on every screen |
| `components/Dropdown.js` | Searchable modal dropdown (no external lib) |

### Screens
| Screen | Navigation name | Notes |
|--------|----------------|-------|
| AuthScreen | — | Sign in / Register toggle |
| WatchlistsScreen | Watchlists | Long-press to delete, + button shows action sheet (Screener / Enter Symbols) |
| CriteriaBuilderScreen | CriteriaBuilder | 30+ TradingView fields, live preview count |
| ManualWatchlistScreen | ManualWatchlist | Comma-separated symbols, chip preview |
| WatchlistDetailScreen | WatchlistDetail | Symbol grid, rule list, tap rule → RuleDetail |
| RuleBuilderScreen | RuleBuilder | Indicator + operator + value terms, Take Profit %, Stop Loss % |
| RuleDetailScreen | RuleDetail | View conditions, navigate to AlertChannels or Edit |
| AlertChannelsScreen | AlertChannels | Webhook/Email/SMS/Push; test button greys when URL unsaved; stays on page after save |
| SignalFeedScreen | Signals (tab) | Swipe-left to delete; shows company name + date + time |
| AnalyticsScreen | Analytics (tab) | Select rule → Daily/Weekly/Monthly/All-Time tabs → 6 metrics |
| HelpScreen | Help | Version, build profile, usage guide |
| AccountScreen | Account (tab) | Logo, Sign Out, Help & About link |

### Design system
```js
colors.bg = "#0a0a0f"          // near-black
colors.card = "#13131a"
colors.accent = "#FF9F0A"      // orange — primary actions
colors.buy = "#00c805"         // green
colors.sell = "#ff3b30"        // red
colors.textPrimary = "#ffffff"
colors.textSecondary = "#8a8a9a"

// Fonts — always use fontFamily, never raw fontWeight
"Inter_400Regular"
"Inter_600SemiBold"
"Inter_700Bold"
"Inter_800ExtraBold"
```

### Navigation structure
```
BottomTabs
  ├── WatchlistsTab (Stack)
  │     ├── Watchlists
  │     ├── CriteriaBuilder
  │     ├── ManualWatchlist
  │     ├── WatchlistDetail
  │     ├── RuleBuilder
  │     ├── RuleDetail
  │     └── AlertChannels
  ├── Signals (screen)
  ├── Analytics (screen)
  └── Account (Stack)
        ├── AccountMain
        └── Help
```

### Build commands
```bash
# Hot reload (JS only — no native modules)
cd mobile-app && npx expo start

# Internal preview build (ad-hoc, install via URL)
eas build --profile preview --platform ios

# Production build (App Store signed)
eas build --profile production --platform ios

# Submit to TestFlight
eas submit --platform ios
```

## App Store / TestFlight
- **Bundle ID:** `com.chandwanis.signalflow`
- **Version:** `1.0.0` / Build `1` (increment `buildNumber` in app.json for each TestFlight upload)
- **App Store Connect:** appstoreconnect.apple.com
- Icon: 1024×1024 RGB PNG **no alpha** (Apple rejects alpha — fixed 2026-06-30 with Pillow flatten)

## Known issues / deferred work
1. **Edit Rule** — RuleBuilderScreen pre-fills from `existingRule` but save still calls `createRule` (creates a new rule). Backend needs `PATCH /watchlists/{id}/rules/{rule_id}` and the screen needs to call it when `existingRule` is set.
2. **Push notifications** — `expo-notifications` removed from Expo Go in SDK 53+. Works in production EAS build only. Toggle in AlertChannels is wired but push won't fire in preview builds.
3. **TradersPost strategy must be enabled** on their side for trades to execute. Webhook fires regardless of strategy status.
4. **Company names for old watchlists** — symbols created before 2026-06-29 have empty `company_name`. The signals API now backfills from Polygon on first load and caches the result. Recreating watchlists also fixes it permanently.
5. **Sell condition TP/SL not evaluated** — `take_profit_pct` / `stop_loss_pct` are stored in the sell_condition JSON and shown in the UI but the indicator engine doesn't yet evaluate them against entry price.

## Tech choices (why)
- **Expo SDK 54** — EAS Build handles signing/provisioning automatically; no Xcode needed
- **FastAPI** — async, fast, auto-OpenAPI docs
- **APScheduler** — simple in-process scheduler, avoids need for Celery/Redis
- **Railway** — one-click Postgres + auto-deploy from GitHub, no DevOps overhead
- **Polygon.io** — free tier covers OHLCV history + ticker reference (company names)
- **TradingView screener** — unofficial package, gives access to TradingView's screener API for filtering thousands of stocks by technical/fundamental criteria
- **No pandas-ta** — pure pandas indicator math to avoid binary dependency issues on Railway
- **No external dropdown library** — custom `Dropdown.js` with searchable modal to avoid version conflicts
