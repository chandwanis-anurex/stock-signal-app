# Backend

FastAPI service: screener (tradingview-screener), indicator/signal engine, alert dispatch, analytics.

## Run locally

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your API keys
uvicorn app.main:app --reload
```

API docs at http://localhost:8000/docs once running.

## Key endpoints

- `POST /screener/run` — ad-hoc screener preview from a criteria JSON body
- `POST /screener/watchlists` — save a watchlist (auto-refreshes on a schedule)
- `GET /screener/watchlists/{id}/symbols` — current matched symbols
- `POST /watchlists/{id}/rules` — create a buy/sell rule (indicator thresholds)
- `POST /watchlists/{id}/rules/{rule_id}/alert-channels` — attach sms/email/push/webhook
- `GET /signals` — signal history, filterable by rule/symbol
- `GET /signals/rules/{rule_id}/performance` — win rate / avg return for a rule

## Notes

- `tradingview-screener` is an unofficial TradingView API wrapper — treat as discovery only.
- Swap `MARKET_DATA_PROVIDER` between `polygon`/`alpaca` in `.env`; add more providers in `app/services/market_data.py`.
- MVP scheduling uses in-process APScheduler (see `app/services/scheduler.py`); move to Celery+Redis if you scale to many users.
