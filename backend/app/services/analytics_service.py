from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.models import Signal, SignalPerformance
from app.services.market_data import get_provider

CHECKPOINTS = {
    "1d": timedelta(days=1),
    "1w": timedelta(days=7),
    "1m": timedelta(days=30),
}

PERIOD_CONFIG = {
    "daily":   {"window": timedelta(days=1),  "checkpoint": "1d"},
    "weekly":  {"window": timedelta(days=7),  "checkpoint": "1w"},
    "monthly": {"window": timedelta(days=30), "checkpoint": "1m"},
    "all":     {"window": None,               "checkpoint": "current"},
}


def record_checkpoint(db: Session, signal: Signal, checkpoint: str, current_price: float):
    direction = 1 if signal.side == "buy" else -1
    return_pct = direction * (current_price - signal.price_at_signal) / signal.price_at_signal * 100

    perf = SignalPerformance(
        signal_id=signal.id,
        checkpoint=checkpoint,
        price_at_checkpoint=current_price,
        return_pct=return_pct,
        computed_at=datetime.utcnow(),
    )
    db.add(perf)
    db.commit()
    return perf


def update_due_checkpoints(db: Session):
    provider = get_provider()
    signals = db.query(Signal).all()

    for signal in signals:
        existing = {p.checkpoint for p in signal.performance}
        for label, window in CHECKPOINTS.items():
            if label in existing:
                continue
            if datetime.utcnow() >= signal.fired_at + window:
                try:
                    price = provider.get_latest_price(signal.symbol)
                    record_checkpoint(db, signal, label, price)
                except Exception:
                    continue

        try:
            price = provider.get_latest_price(signal.symbol)
            record_checkpoint(db, signal, "current", price)
        except Exception:
            continue


def rule_performance_summary(db: Session, rule_id: int, period: str = "all") -> dict:
    config = PERIOD_CONFIG.get(period, PERIOD_CONFIG["all"])
    q = db.query(Signal).filter(Signal.rule_id == rule_id)
    if config["window"]:
        since = datetime.utcnow() - config["window"]
        q = q.filter(Signal.fired_at >= since)
    signals = q.all()

    buy_count = sum(1 for s in signals if s.side == "buy")
    base = {
        "total_signals": len(signals),
        "buy_signals": buy_count,
        "sell_signals": len(signals) - buy_count,
    }

    if not signals:
        return {**base, "win_rate": None, "avg_return_pct": None, "best_return": None, "worst_return": None}

    checkpoint_key = config["checkpoint"]
    returns = []
    for s in signals:
        chk = next((p for p in s.performance if p.checkpoint == checkpoint_key), None)
        if chk:
            returns.append(chk.return_pct)

    if not returns:
        return {**base, "win_rate": None, "avg_return_pct": None, "best_return": None, "worst_return": None}

    wins = sum(1 for r in returns if r > 0)
    return {
        **base,
        "win_rate": wins / len(returns),
        "avg_return_pct": sum(returns) / len(returns),
        "best_return": max(returns),
        "worst_return": min(returns),
    }
