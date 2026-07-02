"""
Buy/sell position pairing: a buy Signal is "open" until something closes it
(a rule-driven sell or a manual sell from the app), tracked via
Signal.closed_at (set on the buy) and Signal.closes_signal_id (set on the
sell that closed it). This is the single place that creates Signal rows and
dispatches their alerts, used by both the scheduler and the manual-sell
endpoint.
"""
from datetime import datetime

from sqlalchemy import text

from app.models.models import Signal, AlertChannel
from app.services.alert_dispatcher import dispatch


def find_open_buy(db, watchlist_id, symbol):
    """Oldest still-open buy for this watchlist+symbol, or None."""
    return db.query(Signal).filter(
        Signal.watchlist_id == watchlist_id,
        Signal.symbol == symbol,
        Signal.side == "buy",
        Signal.closed_at.is_(None),
    ).order_by(Signal.fired_at.asc()).first()


def try_close_buy(db, buy_id) -> bool:
    """
    Atomically claim a buy for closing. Returns True iff this call won the
    race — the sole guard against a double-tap (or the scheduler and a
    manual sell) both closing the same position and firing two sell alerts.
    """
    result = db.execute(
        text("UPDATE signals SET closed_at = :now WHERE id = :id AND side = 'buy' AND closed_at IS NULL"),
        {"now": datetime.utcnow(), "id": buy_id},
    )
    db.commit()
    return result.rowcount == 1


def fire_signal(db, rule_id, watchlist_id, symbol, side, price, snapshot=None, closes=None, is_manual=False):
    """
    Creates a Signal row and dispatches it to the watchlist's active alert
    channels. If `closes` (a buy Signal) is given, atomically claims it first
    and aborts (returns None) if it's already been closed by someone else.
    Returns the created signal with a transient `.dispatched_channels` count,
    or None if the close was lost to a race.
    """
    if closes is not None and not try_close_buy(db, closes.id):
        return None

    signal = Signal(
        rule_id=rule_id,
        watchlist_id=watchlist_id,
        symbol=symbol,
        side=side,
        price_at_signal=price,
        indicator_snapshot=snapshot,
        is_manual=is_manual,
        closes_signal_id=closes.id if closes is not None else None,
    )
    db.add(signal)
    db.commit()
    db.refresh(signal)

    channels = db.query(AlertChannel).filter(
        AlertChannel.watchlist_id == watchlist_id,
        AlertChannel.active == True,  # noqa: E712
    ).all()

    dispatched = 0
    for channel in channels:
        try:
            dispatch(channel, signal)
            dispatched += 1
        except Exception:
            continue

    signal.dispatched_channels = dispatched  # transient, not a mapped column
    return signal
