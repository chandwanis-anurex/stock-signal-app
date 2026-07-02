# SignalFlow — Full Project Context
> Give this file to Claude at the start of any new session to restore full project context.

## Project summary
SignalFlow is a personal iOS stock signal app built by Rakesh Chandwani. It screens stocks using TradingView criteria, evaluates technical indicator rules against live market data, fires buy/sell signals, and dispatches alerts via webhook/email/SMS/push. It is NOT a broker — it signals only. The primary webhook destination is TradersPost.

The app follows a **4 independent pillars** architecture: Watchlists, Rules, Signals, and Analytics are each managed independently and then linked together (a Watchlist gets a Rule *assigned* to it; a Rule can be reused across multiple Watchlists) rather than being nested under one another.

## Current state (as of 2026-07-01)
- Backend: deployed and live on Railway, auto-deploys on push to `main`
- Mobile: TestFlight build 4 uploaded and processing (bundle ID `com.chandwanis.signalflow`)
- Auth: email/password with JWT (30-day tokens, stored in AsyncStorage)
- User account: chandwanis@gmail.com — password stored in this file previously; **rotate it and don't check credentials into git going forward**

## Repository
GitHub: `https://github.com/chandwanis-anurex/stock-signal-app`
- `main` branch → auto-deploys to Railway
- Working directory: `/Users/rakesh/projects/stock-signal-app`
- EAS project: `rakeshchandwani/stock-signal-app` (ID: `704b6240-b34b-43ee-a76e-2be8ddade1e9`)
- App Store Connect App ID: `6785635496` (in `eas.json` as `submit.production.ios.ascAppId`)
- `mobile-app/ios/` is a local native Xcode project (from `expo prebuild`, used for local Xcode/USB-tethered testing) — **intentionally untracked by git**, not committed. EAS Build uses it directly, ignoring `app.json`'s `ios.bundleIdentifier`/`buildNumber` when it's present.

## Backend (FastAPI + PostgreSQL on Railway)
**Base URL:** `https://stock-signal-app-production-912e.up.railway.app`

### Routers
| Prefix | File | Key endpoints |
|--------|------|---------------|
| `/auth` | routers/auth.py | POST /register, /login, /forgot-password, /reset-password |
| `/screener` | routers/screener.py | POST /run (preview), POST /watchlists, POST /watchlists/manual, GET /watchlists, PATCH\|DELETE /watchlists/{id}, POST /watchlists/{id}/toggle, POST /watchlists/halt-all, POST /watchlists/{id}/refresh, GET/POST /watchlists/{id}/symbols, DELETE /watchlists/{id}/symbols/{symbol}, GET/POST/PATCH/DELETE /watchlists/{id}/alert-channels(/{channel_id}), POST .../alert-channels/{id}/test |
| `/rules` | routers/rules.py | GET, POST, GET/PATCH/DELETE /{rule_id} — **standalone**, not nested under a watchlist. `legacy` router still mounts `/watchlists/{id}/rules` (GET only) for backward compat. |
| `/signals` | routers/signals.py | GET /rules, GET, DELETE /{id}, GET /rules/{id}/performance?period=daily\|weekly\|monthly\|all |

### DB migration approach
No Alembic. `Base.metadata.create_all()` + inline `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `main.py` lifespan function `_run_migrations()`. Add new migrations there. Current phases: Phase 1 (original columns), Phase 2 (standalone rules + watchlist rule assignment), Phase 3 (position sizing for webhook trade orders).

### Services
- **screener_service.py** — wraps `tradingview_screener` package. Probes the real match count with `.limit(1)` first, then clamps the requested `limit` to it before the real fetch — TradingView's API errors if you request more rows than actually match. Also sanitizes NaN/Infinity float values (e.g. tickers with no market cap) to `null` before returning, since Starlette's default JSON response uses `allow_nan=False` and would otherwise 500.
- **indicator_engine.py** — pure pandas, no pandas-ta. Computes RSI, SMA, EMA, MACD, MACD_SIGNAL, WILLIAMS_R, ULTIMATE_OSC, VOLUME, VOLUME_SMA, CLOSE, BB_UPPER, BB_LOWER, STOCH_K, STOCH_D. `IndicatorTerm.value` can be a literal number **or** the name of another indicator (e.g. `"MACD_SIGNAL"`) — in that case the two series are compared directly, enabling real crossovers (`crosses_above`/`crosses_below`) between two computed series, not just against a fixed number. `evaluate_symbol()` does **not** yet evaluate `take_profit_pct`/`stop_loss_pct` (see Known issues).
- **market_data.py** — `get_provider()` currently hardcodes `AlpacaProvider` (ignores any `MARKET_DATA_PROVIDER` env var despite what older docs may say). Also has a `PolygonProvider` class defined but unused by `get_provider()`.
- **alert_dispatcher.py** — `dispatch(channel, signal)`. For `channel_type == "webhook"`, `send_webhook()` computes a `quantity` field for **buy** signals only, from `channel.watchlist.position_sizing_type`/`position_sizing_value` (dollars → floored to whole shares using `signal.price_at_signal`, or shares → used directly). Sell signals send no quantity — the convention is "close the full existing position." TradersPost URLs get `{ticker, action, price, sentiment, quantity?}`; other URLs get `{symbol, side, price, fired_at, indicator_snapshot, quantity?}`. Both call `raise_for_status()` so delivery failures surface to the app.
- **analytics_service.py** — records SignalPerformance checkpoints (1d/1w/1m/current). `rule_performance_summary(db, rule_id, period)` returns `{total_signals, buy_signals, sell_signals, win_rate, avg_return_pct, best_return, worst_return}`.
- **scheduler.py** — APScheduler. `refresh_watchlists()` re-runs screener criteria on a schedule; `evaluate_rules()` walks watchlists with `rule_id` set and `rule_active=True`, evaluates the assigned rule per symbol, and fires signals on false→true transitions (state tracked in `Rule.last_state`). `_fire_signal()` dispatches to that **watchlist's** alert channels (not the rule's).

### Data model
```
User
  ├── Watchlist (screener_criteria JSON, refresh_interval_seconds,
  │              rule_id [assigned rule, nullable], rule_active,
  │              position_sizing_type "dollars"|"shares", position_sizing_value)
  │     ├── WatchlistSymbol (symbol, exchange, company_name, is_manual)
  │     └── AlertChannel (channel_type: sms|email|push|webhook, destination)
  │           — belongs to the Watchlist, not the Rule
  └── Rule (standalone; buy_condition JSON, sell_condition JSON, last_state JSON)
        └── Signal (symbol, side: buy|sell, price_at_signal, indicator_snapshot, fired_at)
              └── SignalPerformance (checkpoint: 1d|1w|1m|current, return_pct)
```
A Rule can be assigned to multiple Watchlists (many-to-one via `Watchlist.rule_id`); `AlertChannel`/`Rule` also retain now-legacy `rule_id`/`watchlist_id` FKs from the pre-redesign nested model, kept nullable for backward compatibility with existing rows.

### sell_condition JSON shape
```json
{
  "logic": "and",
  "terms": [{"indicator": "RSI", "params": {"period": 14}, "operator": "gt", "value": 70}],
  "take_profit_pct": 10.0,
  "stop_loss_pct": 5.0
}
```
`IndicatorTerm.value` can also be a string naming another indicator, e.g. `{"indicator": "MACD", "operator": "crosses_above", "value": "MACD_SIGNAL"}`.

## Mobile App (React Native / Expo SDK 54)
Working directory: `/Users/rakesh/projects/stock-signal-app/mobile-app`

### Key files
| File | Purpose |
|------|---------|
| `App.js` | Navigation (NativeStack + BottomTabs), Inter font loading, auth/onboarding gate, mounts `KeyboardDoneBar` globally |
| `theme.js` | Design tokens — colors, typography (Inter variants), layout |
| `api/client.js` | All fetch calls to backend with JWT auth |
| `data/companyNames.js` | Local fallback dict ~100 tickers for offline company name lookup |
| `components/Logo.js` | Bull icon, cropped to a true circle (`borderRadius: size/2`), no baked-in margin |
| `components/Dropdown.js` | Searchable modal dropdown (no external lib) |
| `components/KeyboardDoneBar.js` | Global floating "Done" bar that tracks `Keyboard` show/hide events directly and overlays above the keyboard on any screen. Replaces per-field `InputAccessoryView`, which is unreliable under this app's New Architecture (Fabric) setup — don't reintroduce `inputAccessoryViewID` wiring. |

### Screens
| Screen | Navigation name | Notes |
|--------|----------------|-------|
| AuthScreen | — | Sign in / Register / Forgot / Reset password |
| OnboardingScreen | — (root) / `HowItWorks` (Account stack) | "How It Works" 4-step walkthrough; also the one-time onboarding gate before first entering the app |
| HomeScreen | `Home` (tab, hidden button — reached via header logo tap) | Circular 4-pillar diagram, tiles jump directly into a pillar's stack |
| WatchlistsScreen | `Watchlists` | List + create (screener or manual) |
| CriteriaBuilderScreen | `Screener` (nested) / also standalone screener-criteria builder for creating a watchlist | TradingView-style filter builder |
| ManualWatchlistScreen | `ManualWatchlist` | Comma-separated symbol entry |
| ScreenerScreen | `Screener` | Ad-hoc screener page (Home → "Screen Stocks" tile) — filters start blank, incomplete filter rows are dropped before submitting |
| WatchlistDetailScreen | `WatchlistDetail` | Symbol list, Edit mode (name, assigned rule, **trade size**), Alert Channels managed **inline here** (not a separate screen — see below), Save/Alert Channels sections kept above the symbols list |
| RulesListScreen | `RulesList` | Standalone rule sets list |
| RuleBuilderScreen | `RuleBuilder` | Indicator terms restricted to bounded oscillators (RSI, Williams %R, Ultimate Oscillator, Stochastic %K/%D — fixed numeric threshold) plus MACD/Volume as **crossover-only** comparisons against their companion series (Signal Line / Volume SMA) — raw price-level indicators (Close/SMA/EMA/Bollinger) were removed since a fixed threshold doesn't generalize across a watchlist of differently-priced stocks |
| SignalFeedScreen | `Signals` (tab) | Swipe-left to delete; company name + date/time |
| AnalyticsScreen | `Analytics` (tab) | Select rule → Daily/Weekly/Monthly/All-Time tabs → 6 metrics |
| HelpScreen | `Help` (Account stack) | Version, build profile, usage guide (matches current pillar model + trade sizing) |
| AccountScreen | `Account` (tab) | Logo, How It Works link, Help & About link, Sign Out |
| ~~RuleDetailScreen~~ | — | **Orphaned** — not registered in `App.js`, unreachable. Left over from before the redesign (used to navigate to `AlertChannelsScreen`). Don't wire it back in without also reconciling it against `WatchlistDetailScreen`'s inline alert-channel handling. |
| ~~AlertChannelsScreen~~ | — | **Orphaned** — same as above. `WatchlistDetailScreen` has its own inline alert-channel UI (`handleAddChannel`/`promptDestination`/`registerPushChannel`) that's the live implementation. |

Push notification setup (in `WatchlistDetailScreen`) auto-registers the device via `expo-notifications` (`requestPermissionsAsync` + `getExpoPushTokenAsync`) — it does **not** ask the user to type in a token.

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
BottomTabs (5 visible tabs — Home is registered but tabBarButton: () => null,
            reached only via tapping the header logo)
  ├── Home (hidden tab button)
  ├── RulesTab (Stack)
  │     ├── RulesList
  │     └── RuleBuilder
  ├── WatchlistsTab (Stack) — tabPress listener always resets to the
  │     │                     Watchlists root, even if the stack was left
  │     │                     deeper (e.g. Home's "Screen Stocks" tile jumps
  │     │                     straight into Screener)
  │     ├── Watchlists
  │     ├── WatchlistDetail
  │     ├── ManualWatchlist
  │     └── Screener
  ├── Signals (screen, slightly larger tab icon)
  ├── Analytics (screen)
  └── Account (Stack)
        ├── AccountMain
        ├── Help
        └── HowItWorks (Onboarding screen, re-entrant)
```

### Local Xcode / USB-tethered testing
`mobile-app/ios/` exists locally (from `expo prebuild`) for building via Xcode when EAS build credits run out. Key gotchas learned the hard way:
- Metro must be running (`npx expo start --dev-client`) and reachable at the Mac's **current** LAN IP — if the Mac's DHCP lease changes mid-session, restart Metro.
- `Info.plist` needs `NSLocalNetworkUsageDescription` + `NSBonjourServices` or iOS silently blocks the Metro connection ("Local network prohibited").
- `app.json`'s `ios.bundleIdentifier`/`buildNumber` are **ignored** by both local Xcode builds and EAS Build whenever `ios/` is present — the native project files are the source of truth for local builds; EAS now uses **remote** version tracking instead (see Build commands).

### Build commands
```bash
# Hot reload (JS only)
cd mobile-app && npx expo start

# Build + run directly on a USB-tethered iPhone (starts Metro automatically)
npx expo run:ios --device

# Internal preview build via EAS (ad-hoc, install via URL)
eas build --profile preview --platform ios

# Production build (App Store signed) — build number auto-increments remotely
eas build --profile production --platform ios

# Submit the latest build to TestFlight
eas submit --platform ios --latest
```

## App Store / TestFlight
- **Bundle ID:** `com.chandwanis.signalflow`
- **Version:** `1.0.0` / **Build number: auto-incremented remotely by EAS** — `eas.json` sets `cli.appVersionSource: "remote"` and `build.production.ios.autoIncrement: true`. Do **not** set `ios.buildNumber` in `app.json` (ignored, and was the root cause of a rejected submission once local/native/ASC build numbers drifted out of sync).
- **App Store Connect App ID:** `6785635496` — set as `submit.production.ios.ascAppId` in `eas.json` so `eas submit --non-interactive` never needs an interactive Apple ID/2FA login.
- **App Store Connect:** appstoreconnect.apple.com
- Icon: 1024×1024 RGB PNG **no alpha** (Apple rejects alpha — fixed 2026-06-30 with Pillow flatten)

## Known issues / deferred work
1. **Sell condition TP/SL not evaluated** — `take_profit_pct` / `stop_loss_pct` are stored in the sell_condition JSON and shown/edited in the UI, but `indicator_engine.py` doesn't evaluate them against the entry price yet.
2. **TradersPost strategy must be enabled** on their side for trades to execute. Webhook fires regardless of strategy status.
3. **Company names for old watchlists** — symbols created before 2026-06-29 may have empty `company_name`; the signals API backfills from the market data provider on first load and caches the result.
4. **Orphaned screens** — `RuleDetailScreen.js` and `AlertChannelsScreen.js` are dead code (not in `App.js`'s navigators). Don't assume they're live; `WatchlistDetailScreen.js` owns alert-channel management now.
5. **Trade sizing is per-watchlist only** — one `position_sizing_type`/`value` per watchlist, applied to every symbol in it. No per-symbol sizing.
6. **`market_data.py`'s `get_provider()`** hardcodes Alpaca regardless of any `MARKET_DATA_PROVIDER` env var — if you intend to switch providers, that function needs updating, not just the env var.

## Tech choices (why)
- **Expo SDK 54** — EAS Build handles signing/provisioning automatically; local Xcode/`ios/` project used only as a fallback when EAS build credits are exhausted
- **FastAPI** — async, fast, auto-OpenAPI docs
- **APScheduler** — simple in-process scheduler, avoids need for Celery/Redis
- **Railway** — one-click Postgres + auto-deploy from GitHub, no DevOps overhead
- **TradingView screener** — unofficial package, gives access to TradingView's screener API for filtering thousands of stocks by technical/fundamental criteria. Subject to their rate limits — the two-request "probe count then fetch" pattern in `screener_service.py` is a real (if imperfect) mitigation for the "requested more rows than exist" failure mode, not a full fix for rate limiting.
- **No pandas-ta** — pure pandas indicator math to avoid binary dependency issues on Railway
- **No external dropdown library** — custom `Dropdown.js` with searchable modal to avoid version conflicts
- **Watchlist-level trade sizing, not rule-level** — rules are designed to be reused across multiple watchlists (different capital allocations), so tying position size to the rule would break that reusability
- **Global `KeyboardDoneBar` instead of `InputAccessoryView`** — per-field native accessory views don't reliably attach under this app's New Architecture (Fabric) configuration; a single `Keyboard` event listener sidesteps the native component entirely
