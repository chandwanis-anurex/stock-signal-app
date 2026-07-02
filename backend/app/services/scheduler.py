import os
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models.models import Watchlist, Rule, WatchlistSymbol
from app.schemas import ScreenerCriteria, ConditionGroup
from app.services.screener_service import run_screener
from app.services.indicator_engine import evaluate_symbol
from app.services.market_data import get_provider
from app.services.signal_service import find_open_buy, fire_signal
from app.services.analytics_service import update_due_checkpoints


def refresh_watchlists():
    """Re-run screener for each watchlist that has criteria. Preserves manually-added symbols."""
    db = SessionLocal()
    try:
        watchlists = db.query(Watchlist).filter(
            Watchlist.active == True,  # noqa: E712
            Watchlist.screener_criteria.isnot(None),
        ).all()

        for wl in watchlists:
            try:
                criteria = ScreenerCriteria(**wl.screener_criteria)
                results = run_screener(criteria)
                new_syms = {row.get("name"): row for row in results if row.get("name")}

                # Remove old screener symbols; keep is_manual ones
                db.query(WatchlistSymbol).filter(
                    WatchlistSymbol.watchlist_id == wl.id,
                    WatchlistSymbol.is_manual == False,  # noqa: E712
                ).delete()

                manual = {s.symbol for s in db.query(WatchlistSymbol).filter(
                    WatchlistSymbol.watchlist_id == wl.id
                ).all()}

                for sym, row in new_syms.items():
                    if sym not in manual:
                        db.add(WatchlistSymbol(
                            watchlist_id=wl.id,
                            symbol=sym,
                            exchange=row.get("exchange", ""),
                            company_name=row.get("description", ""),
                            is_manual=False,
                        ))

                wl.last_run_at = datetime.utcnow()
                db.commit()
            except Exception:
                db.rollback()
    finally:
        db.close()


def evaluate_rules():
    """Evaluate active rules on their watchlists and fire signals on transitions."""
    db = SessionLocal()
    try:
        provider = get_provider()

        # Only process watchlists that have an active rule assignment
        watchlists = db.query(Watchlist).filter(
            Watchlist.rule_id.isnot(None),
            Watchlist.rule_active == True,  # noqa: E712
        ).all()

        # Fetch OHLCV for every symbol across all active watchlists in one
        # batched request — per-symbol fetches were the main consumer of the
        # free plan's 200 req/min budget.
        plans = []
        all_symbols = set()
        for wl in watchlists:
            rule = db.query(Rule).filter(Rule.id == wl.rule_id).first()
            if not rule:
                continue
            symbols = [ws.symbol for ws in db.query(WatchlistSymbol).filter(
                WatchlistSymbol.watchlist_id == wl.id).all()]
            plans.append((wl, rule, symbols))
            all_symbols.update(symbols)

        if not all_symbols:
            return
        try:
            ohlcv = provider.get_ohlcv_batch(sorted(all_symbols), lookback_days=90)
        except Exception:
            return

        for wl, rule, symbols in plans:
            buy_cond = ConditionGroup(**rule.buy_condition) if rule.buy_condition else None
            sell_cond = ConditionGroup(**rule.sell_condition) if rule.sell_condition else None

            for symbol in symbols:
                try:
                    result = evaluate_symbol(ohlcv.get(symbol), buy_cond, sell_cond)
                except Exception:
                    continue

                # Position-existence gating replaces the old edge-latch: a
                # buy only fires if none is already open, and a sell only
                # fires if one is — this is itself the dedupe (no separate
                # per-symbol state to track or get stuck).
                open_buy = find_open_buy(db, wl.id, symbol)

                if result["buy"] and not open_buy:
                    fire_signal(db, rule.id, wl.id, symbol, "buy", result["price"], result["snapshot"])
                if result["sell"] and open_buy:
                    fire_signal(db, rule.id, wl.id, symbol, "sell", result["price"], result["snapshot"], closes=open_buy)
    finally:
        db.close()


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
