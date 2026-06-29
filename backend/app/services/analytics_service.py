"""
Computes performance checkpoints for fired signals so the app can show
"how would this rule have actually done" without needing real trades.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.models import Signal, SignalPerformance
from app.services.market_data import get_provider

CHECKPOINTS = {
    "1d": timedelta(days=1),
    "1w": timedelta(days=7),
    "1m": timedelta(days=30),
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
    """Run periodically: for every signal, check whether any checkpoint window
    has elapsed and hasn't been recorded yet, fetch the current price, and log it."""
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

        # always refresh "current" so open signals show live running performance
        try:
            price = provider.get_latest_price(signal.symbol)
            record_checkpoint(db, signal, "current", price)
        except Exception:
            continue


def rule_performance_summary(db: Session, rule_id: int) -> dict:
    signals = db.query(Signal).filter(Signal.rule_id == rule_id).all()
    if not signals:
        return {"win_rate": None, "avg_return_pct": None, "total_signals": 0}

    latest_returns = []
    for s in signals:
        current = next((p for p in s.performance if p.checkpoint == "current"), None)
        if current:
            latest_returns.append(current.return_pct)

    if not latest_returns:
        return {"win_rate": None, "avg_return_pct": None, "total_signals": len(signals)}

    wins = sum(1 for r in latest_returns if r > 0)
    return {
        "win_rate": wins / len(latest_returns),
        "avg_return_pct": sum(latest_returns) / len(latest_returns),
        "total_signals": len(signals),
    }
