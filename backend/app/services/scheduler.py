"""
Wires up the periodic jobs:
  1. Re-run each active watchlist's screener on its configured interval.
  2. Evaluate each active rule against its watchlist's symbols, fire signals
     on false->true transitions, and dispatch alerts.
  3. Update signal performance checkpoints.

MVP uses APScheduler in-process. For production scale (many users / many
symbols), move this to Celery + Redis so jobs can run on separate workers
and you can control concurrency against market-data rate limits.
"""
import os
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.models import Watchlist, Rule, WatchlistSymbol, Signal
from app.schemas import ScreenerCriteria, ConditionGroup
from app.services.screener_service import run_screener
from app.services.indicator_engine import evaluate_symbol
from app.services.market_data import get_provider
from app.services.alert_dispatcher import dispatch
from app.services.analytics_service import update_due_checkpoints


def refresh_watchlists():
    db = SessionLocal()
    try:
        watchlists = db.query(Watchlist).filter(Watchlist.active == True).all()  # noqa: E712
        for wl in watchlists:
            criteria = ScreenerCriteria(**wl.screener_criteria)
            results = run_screener(criteria)

            db.query(WatchlistSymbol).filter(WatchlistSymbol.watchlist_id == wl.id).delete()
            for row in results:
                db.add(WatchlistSymbol(
                    watchlist_id=wl.id,
                    symbol=row.get("name"),
                    exchange=row.get("exchange", ""),
                ))
            wl.last_run_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


def evaluate_rules():
    db = SessionLocal()
    try:
        provider = get_provider()
        rules = db.query(Rule).filter(Rule.active == True).all()  # noqa: E712

        for rule in rules:
            symbols = db.query(WatchlistSymbol).filter(
                WatchlistSymbol.watchlist_id == rule.watchlist_id
            ).all()

            buy_cond = ConditionGroup(**rule.buy_condition) if rule.buy_condition else None
            sell_cond = ConditionGroup(**rule.sell_condition) if rule.sell_condition else None
            state = rule.last_state or {}

            for ws in symbols:
                symbol = ws.symbol
                try:
                    result = evaluate_symbol(provider, symbol, buy_cond, sell_cond)
                except Exception:
                    continue

                prev = state.get(symbol, {"buy": False, "sell": False})

                if result["buy"] and not prev["buy"]:
                    _fire_signal(db, rule, symbol, "buy", result)
                if result["sell"] and not prev["sell"]:
                    _fire_signal(db, rule, symbol, "sell", result)

                state[symbol] = {"buy": result["buy"], "sell": result["sell"]}

            rule.last_state = state
            db.commit()
    finally:
        db.close()


def _fire_signal(db, rule: Rule, symbol: str, side: str, result: dict):
    signal = Signal(
        rule_id=rule.id,
        symbol=symbol,
        side=side,
        price_at_signal=result["price"],
        indicator_snapshot=result["snapshot"],
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)

    for channel in rule.alert_channels:
        if channel.active:
            try:
                dispatch(channel, signal)
            except Exception:
                continue


def run_analytics_update():
    db = SessionLocal()
    try:
        update_due_checkpoints(db)
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    screener_interval = int(os.getenv("SCREENER_REFRESH_SECONDS", 300))
    signal_interval = int(os.getenv("SIGNAL_CHECK_SECONDS", 60))

    scheduler.add_job(refresh_watchlists, "interval", seconds=screener_interval, id="refresh_watchlists")
    scheduler.add_job(evaluate_rules, "interval", seconds=signal_interval, id="evaluate_rules")
    scheduler.add_job(run_analytics_update, "interval", minutes=30, id="analytics_update")
    scheduler.start()
    return scheduler
