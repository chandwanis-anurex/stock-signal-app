from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.models import AlertChannel, Rule, User, Watchlist, WatchlistSymbol
from app.schemas import ScreenerCriteria, WatchlistCreate
from app.services.market_data import get_provider
from app.services.screener_service import run_screener

router = APIRouter(prefix="/screener", tags=["screener"])

MAX_WATCHLISTS = 25


# ── Screener preview ─────────────────────────────────────────────────────────

@router.post("/run")
def run(criteria: ScreenerCriteria):
    results = run_screener(criteria)
    return {"count": len(results), "results": results}


# ── Watchlist CRUD ───────────────────────────────────────────────────────────

@router.get("/watchlists")
def list_watchlists(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    watchlists = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).order_by(Watchlist.id).all()
    return [_wl_summary(wl, db) for wl in watchlists]


@router.post("/watchlists")
def create_watchlist(payload: WatchlistCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).count()
    if count >= MAX_WATCHLISTS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_WATCHLISTS} watchlists reached")

    wl = Watchlist(
        user_id=current_user.id,
        name=payload.name,
        screener_criteria=payload.criteria.model_dump() if payload.criteria else None,
        refresh_interval_seconds=payload.refresh_interval_seconds,
    )
    db.add(wl)
    db.commit()
    db.refresh(wl)

    if payload.criteria:
        try:
            results = run_screener(payload.criteria)
            for row in results:
                db.add(WatchlistSymbol(
                    watchlist_id=wl.id,
                    symbol=row.get("name"),
                    exchange=row.get("exchange", ""),
                    company_name=row.get("description", ""),
                    is_manual=False,
                ))
            wl.last_run_at = datetime.utcnow()
            db.commit()
        except Exception:
            pass

    return _wl_summary(wl, db)


@router.post("/watchlists/manual")
def create_watchlist_manual(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).count()
    if count >= MAX_WATCHLISTS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_WATCHLISTS} watchlists reached")

    name = payload.get("name", "").strip()
    symbols = [s.strip().upper() for s in payload.get("symbols", []) if s.strip()]
    if not name or not symbols:
        raise HTTPException(status_code=400, detail="name and symbols are required")

    wl = Watchlist(user_id=current_user.id, name=name, screener_criteria=None, refresh_interval_seconds=0)
    db.add(wl)
    db.commit()
    db.refresh(wl)

    provider = get_provider()
    for sym in symbols:
        company_name = provider.get_company_name(sym)
        db.add(WatchlistSymbol(watchlist_id=wl.id, symbol=sym, exchange="", company_name=company_name, is_manual=True))
    db.commit()
    return _wl_summary(wl, db)


@router.delete("/watchlists/{watchlist_id}")
def delete_watchlist(watchlist_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    db.delete(wl)
    db.commit()
    return {"deleted": watchlist_id}


@router.patch("/watchlists/{watchlist_id}")
def update_watchlist(watchlist_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    if "name" in payload:
        wl.name = payload["name"]
    if "criteria" in payload:
        wl.screener_criteria = payload["criteria"]
    if "rule_id" in payload:
        rule_id = payload["rule_id"]
        if rule_id is not None:
            rule = db.query(Rule).filter(Rule.id == rule_id).first()
            if not rule:
                raise HTTPException(status_code=404, detail="Rule not found")
        wl.rule_id = rule_id
        wl.rule_active = False  # always stop when changing rule
    if "position_sizing_type" in payload:
        sizing_type = payload["position_sizing_type"]
        if sizing_type not in ("dollars", "shares"):
            raise HTTPException(status_code=400, detail="position_sizing_type must be 'dollars' or 'shares'")
        wl.position_sizing_type = sizing_type
    if "position_sizing_value" in payload:
        sizing_value = payload["position_sizing_value"]
        if not isinstance(sizing_value, (int, float)) or sizing_value <= 0:
            raise HTTPException(status_code=400, detail="position_sizing_value must be a positive number")
        wl.position_sizing_value = sizing_value
    db.commit()
    return _wl_summary(wl, db)


# ── Rule toggle / halt ───────────────────────────────────────────────────────

@router.post("/watchlists/{watchlist_id}/toggle")
def toggle_rule(watchlist_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    if not wl.rule_id:
        raise HTTPException(status_code=400, detail="No rule assigned to this watchlist")
    wl.rule_active = not wl.rule_active
    db.commit()
    return {"watchlist_id": watchlist_id, "rule_active": wl.rule_active}


@router.post("/watchlists/halt-all")
def halt_all(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    watchlists = db.query(Watchlist).filter(
        Watchlist.user_id == current_user.id,
        Watchlist.rule_active == True,  # noqa: E712
    ).all()
    for wl in watchlists:
        wl.rule_active = False
    db.commit()
    return {"halted": len(watchlists)}


# ── Screener refresh ─────────────────────────────────────────────────────────

@router.post("/watchlists/{watchlist_id}/refresh")
def refresh_watchlist(watchlist_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    if not wl.screener_criteria:
        raise HTTPException(status_code=400, detail="This watchlist has no screener criteria")

    from app.schemas import ScreenerCriteria
    criteria = ScreenerCriteria(**wl.screener_criteria)
    results = run_screener(criteria)
    new_symbols = {row.get("name"): row for row in results if row.get("name")}

    # Remove old screener symbols (keep is_manual=True ones)
    db.query(WatchlistSymbol).filter(
        WatchlistSymbol.watchlist_id == watchlist_id,
        WatchlistSymbol.is_manual == False,  # noqa: E712
    ).delete()

    # Get existing manual symbols to avoid duplicates
    manual_syms = {s.symbol for s in db.query(WatchlistSymbol).filter(
        WatchlistSymbol.watchlist_id == watchlist_id
    ).all()}

    for sym, row in new_symbols.items():
        if sym not in manual_syms:
            db.add(WatchlistSymbol(
                watchlist_id=watchlist_id,
                symbol=sym,
                exchange=row.get("exchange", ""),
                company_name=row.get("description", ""),
                is_manual=False,
            ))

    wl.last_run_at = datetime.utcnow()
    db.commit()
    return {"refreshed": True, "symbol_count": len(new_symbols)}


# ── Symbol management ────────────────────────────────────────────────────────

@router.get("/watchlists/{watchlist_id}/symbols")
def get_watchlist_symbols(watchlist_id: int, db: Session = Depends(get_db)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return [
        {"symbol": s.symbol, "exchange": s.exchange, "company_name": s.company_name, "is_manual": s.is_manual}
        for s in wl.symbols
    ]


@router.post("/watchlists/{watchlist_id}/symbols")
def add_symbol(watchlist_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    symbol = payload.get("symbol", "").strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="symbol required")
    exists = db.query(WatchlistSymbol).filter(
        WatchlistSymbol.watchlist_id == watchlist_id,
        WatchlistSymbol.symbol == symbol,
    ).first()
    if exists:
        return {"symbol": symbol, "already_exists": True}
    provider = get_provider()
    company_name = provider.get_company_name(symbol)
    db.add(WatchlistSymbol(watchlist_id=watchlist_id, symbol=symbol, exchange="", company_name=company_name, is_manual=True))
    db.commit()
    return {"symbol": symbol, "company_name": company_name, "is_manual": True}


@router.delete("/watchlists/{watchlist_id}/symbols/{symbol}")
def delete_watchlist_symbol(watchlist_id: int, symbol: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    sym = db.query(WatchlistSymbol).filter(
        WatchlistSymbol.watchlist_id == watchlist_id,
        WatchlistSymbol.symbol == symbol.upper(),
    ).first()
    if sym:
        db.delete(sym)
        db.commit()
    return {"deleted": symbol}


# ── Alert channels (watchlist-level) ─────────────────────────────────────────

@router.get("/watchlists/{watchlist_id}/alert-channels")
def list_alert_channels(watchlist_id: int, db: Session = Depends(get_db)):
    channels = db.query(AlertChannel).filter(AlertChannel.watchlist_id == watchlist_id).all()
    return [_channel_dict(c) for c in channels]


@router.post("/watchlists/{watchlist_id}/alert-channels")
def add_alert_channel(watchlist_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    ch = AlertChannel(
        watchlist_id=watchlist_id,
        channel_type=payload.get("channel_type"),
        destination=payload.get("destination", ""),
    )
    db.add(ch)
    db.commit()
    db.refresh(ch)
    return _channel_dict(ch)


@router.patch("/watchlists/{watchlist_id}/alert-channels/{channel_id}")
def update_alert_channel(watchlist_id: int, channel_id: int, payload: dict, db: Session = Depends(get_db)):
    ch = db.query(AlertChannel).filter(AlertChannel.id == channel_id, AlertChannel.watchlist_id == watchlist_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    if "destination" in payload:
        ch.destination = payload["destination"]
    if "channel_type" in payload:
        ch.channel_type = payload["channel_type"]
    db.commit()
    return _channel_dict(ch)


@router.delete("/watchlists/{watchlist_id}/alert-channels/{channel_id}")
def delete_alert_channel(watchlist_id: int, channel_id: int, db: Session = Depends(get_db)):
    ch = db.query(AlertChannel).filter(AlertChannel.id == channel_id, AlertChannel.watchlist_id == watchlist_id).first()
    if ch:
        db.delete(ch)
        db.commit()
    return {"deleted": channel_id}


@router.post("/watchlists/{watchlist_id}/alert-channels/{channel_id}/test")
def test_alert_channel(watchlist_id: int, channel_id: int, db: Session = Depends(get_db)):
    from datetime import datetime as dt
    from app.services.alert_dispatcher import dispatch

    ch = db.query(AlertChannel).filter(AlertChannel.id == channel_id, AlertChannel.watchlist_id == watchlist_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")

    class MockSignal:
        symbol = "AAPL"
        side = "buy"
        price_at_signal = 195.42
        fired_at = dt.utcnow()
        indicator_snapshot = {"rsi": 28.5, "close": 195.42}

    try:
        dispatch(ch, MockSignal())
        return {"message": "Test alert sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Helpers ──────────────────────────────────────────────────────────────────

def _wl_summary(wl: Watchlist, db: Session) -> dict:
    rule_name = None
    if wl.rule_id:
        rule = db.query(Rule).filter(Rule.id == wl.rule_id).first()
        if rule:
            rule_name = rule.name
    return {
        "id": wl.id,
        "name": wl.name,
        "last_run_at": wl.last_run_at.replace(tzinfo=timezone.utc).isoformat() if wl.last_run_at else None,
        "screener_criteria": wl.screener_criteria,
        "rule_id": wl.rule_id,
        "rule_active": wl.rule_active,
        "rule_name": rule_name,
        "position_sizing_type": wl.position_sizing_type,
        "position_sizing_value": wl.position_sizing_value,
    }


def _channel_dict(ch: AlertChannel) -> dict:
    return {"id": ch.id, "channel_type": ch.channel_type, "destination": ch.destination, "active": ch.active}
