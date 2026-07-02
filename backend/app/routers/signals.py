from datetime import timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Signal, Rule, WatchlistSymbol
from app.services.market_data import get_provider
from app.services.analytics_service import rule_performance_summary
from app.services.signal_service import fire_signal

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("/rules")
def list_all_rules(db: Session = Depends(get_db)):
    rules = db.query(Rule).filter(Rule.active == True).all()  # noqa: E712
    return [
        {
            "id": r.id,
            "name": r.name,
            "watchlist_id": r.watchlist_id,
            "buy_condition": r.buy_condition,
            "sell_condition": r.sell_condition,
        }
        for r in rules
    ]


@router.get("")
def list_signals(
    rule_id: int | None = None,
    symbol: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Signal)
    if rule_id:
        q = q.filter(Signal.rule_id == rule_id)
    if symbol:
        q = q.filter(Signal.symbol == symbol)

    signals = q.order_by(Signal.fired_at.desc()).limit(200).all()

    rule_ids = {s.rule_id for s in signals if s.rule_id}
    rules = {r.id: r.name for r in db.query(Rule).filter(Rule.id.in_(rule_ids)).all()}

    symbol_set = {s.symbol for s in signals}
    company_map = {}
    ws_rows = {ws.symbol: ws for ws in db.query(WatchlistSymbol).filter(WatchlistSymbol.symbol.in_(symbol_set)).all()}
    for sym, ws in ws_rows.items():
        if ws.company_name:
            company_map[sym] = ws.company_name

    # For any symbol still missing a name, fetch from Polygon and cache it
    missing = symbol_set - set(company_map.keys())
    if missing:
        provider = get_provider()
        for sym in missing:
            name = provider.get_company_name(sym)
            if name:
                company_map[sym] = name
                if sym in ws_rows:
                    ws_rows[sym].company_name = name
        if missing:
            db.commit()

    return [
        {
            "id": s.id,
            "symbol": s.symbol,
            "company_name": company_map.get(s.symbol, ""),
            "side": s.side,
            "price_at_signal": s.price_at_signal,
            "fired_at": s.fired_at.replace(tzinfo=timezone.utc).isoformat(),
            "rule_name": rules.get(s.rule_id, ""),
        }
        for s in signals
    ]


@router.delete("/{signal_id}")
def delete_signal(signal_id: int, db: Session = Depends(get_db)):
    signal = db.query(Signal).filter(Signal.id == signal_id).first()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    db.delete(signal)
    db.commit()
    return {"deleted": signal_id}


@router.get("/rules/{rule_id}/performance")
def rule_performance(rule_id: int, period: str = "all", db: Session = Depends(get_db)):
    return rule_performance_summary(db, rule_id, period)


def _company_name(db: Session, provider, symbol: str) -> str:
    ws = db.query(WatchlistSymbol).filter(
        WatchlistSymbol.symbol == symbol, WatchlistSymbol.company_name != ""
    ).first()
    if ws:
        return ws.company_name
    try:
        return provider.get_company_name(symbol) or ""
    except Exception:
        return ""


@router.get("/{signal_id}")
def get_signal(signal_id: int, db: Session = Depends(get_db)):
    signal = db.query(Signal).filter(Signal.id == signal_id).first()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    rule = db.query(Rule).filter(Rule.id == signal.rule_id).first()
    provider = get_provider()

    is_open = signal.side == "buy" and signal.closed_at is None
    entry_price = None
    exit_price = None
    current_price = None
    pl_abs = None
    pl_pct = None

    if signal.side == "buy":
        entry_price = signal.price_at_signal
        if is_open:
            try:
                current_price = provider.get_latest_price(signal.symbol)
            except Exception:
                current_price = None
            if current_price is not None:
                pl_abs = current_price - entry_price
                pl_pct = pl_abs / entry_price * 100
        else:
            closing_sell = db.query(Signal).filter(Signal.closes_signal_id == signal.id).first()
            if closing_sell:
                exit_price = closing_sell.price_at_signal
                pl_abs = exit_price - entry_price
                pl_pct = pl_abs / entry_price * 100
    else:  # sell
        exit_price = signal.price_at_signal
        if signal.closes_signal_id:
            entry_buy = db.query(Signal).filter(Signal.id == signal.closes_signal_id).first()
            if entry_buy:
                entry_price = entry_buy.price_at_signal
                pl_abs = exit_price - entry_price
                pl_pct = pl_abs / entry_price * 100

    return {
        "id": signal.id,
        "symbol": signal.symbol,
        "company_name": _company_name(db, provider, signal.symbol),
        "side": signal.side,
        "price_at_signal": signal.price_at_signal,
        "fired_at": signal.fired_at.replace(tzinfo=timezone.utc).isoformat(),
        "rule_name": rule.name if rule else "",
        "watchlist_id": signal.watchlist_id,
        "is_manual": signal.is_manual,
        "is_open": is_open,
        "closed_at": signal.closed_at.replace(tzinfo=timezone.utc).isoformat() if signal.closed_at else None,
        "entry_price": entry_price,
        "exit_price": exit_price,
        "current_price": current_price,
        "pl_abs": pl_abs,
        "pl_pct": pl_pct,
    }


@router.post("/{signal_id}/sell")
def sell_signal_now(signal_id: int, db: Session = Depends(get_db)):
    buy = db.query(Signal).filter(Signal.id == signal_id).first()
    if not buy:
        raise HTTPException(status_code=404, detail="Signal not found")
    if buy.side != "buy":
        raise HTTPException(status_code=400, detail="Only a buy signal can be sold")

    provider = get_provider()
    try:
        price = provider.get_latest_price(buy.symbol)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch current price: {e}")

    # fire_signal atomically claims `buy` via try_close_buy before creating
    # the sell — this is the sole gate against a double-tap (or the
    # scheduler) racing to close the same position. It returns None if the
    # claim was lost.
    sell = fire_signal(
        db, buy.rule_id, buy.watchlist_id, buy.symbol, "sell", price,
        {"manual": True}, closes=buy, is_manual=True,
    )
    if sell is None:
        raise HTTPException(status_code=409, detail="This position is already closed")

    return {
        "id": sell.id,
        "symbol": sell.symbol,
        "side": sell.side,
        "price_at_signal": sell.price_at_signal,
        "fired_at": sell.fired_at.replace(tzinfo=timezone.utc).isoformat(),
        "dispatched_channels": sell.dispatched_channels,
    }
