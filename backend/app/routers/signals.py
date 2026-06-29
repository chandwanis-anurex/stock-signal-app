from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Signal, Rule, WatchlistSymbol
from app.services.market_data import get_provider
from app.services.analytics_service import rule_performance_summary

router = APIRouter(prefix="/signals", tags=["signals"])


@router.get("/rules")
def list_all_rules(db: Session = Depends(get_db)):
    rules = db.query(Rule).filter(Rule.active == True).all()  # noqa: E712
    return [{"id": r.id, "name": r.name, "watchlist_id": r.watchlist_id} for r in rules]


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
            "fired_at": s.fired_at,
            "rule_name": rules.get(s.rule_id, ""),
        }
        for s in signals
    ]


@router.get("/rules/{rule_id}/performance")
def rule_performance(rule_id: int, db: Session = Depends(get_db)):
    return rule_performance_summary(db, rule_id)
