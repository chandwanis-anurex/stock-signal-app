from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.models import User, Watchlist, WatchlistSymbol
from app.schemas import ScreenerCriteria, WatchlistCreate
from app.services.screener_service import run_screener
from app.services.market_data import get_provider

router = APIRouter(prefix="/screener", tags=["screener"])


@router.post("/run")
def run(criteria: ScreenerCriteria):
    """Run criteria ad-hoc without saving a watchlist (used by the live preview in the app's Criteria Builder)."""
    results = run_screener(criteria)
    return {"count": len(results), "results": results}


@router.post("/watchlists")
def create_watchlist(payload: WatchlistCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wl = Watchlist(
        user_id=current_user.id,
        name=payload.name,
        screener_criteria=payload.criteria.model_dump(),
        refresh_interval_seconds=payload.refresh_interval_seconds,
    )
    db.add(wl)
    db.commit()
    db.refresh(wl)

    # Run the screener immediately so symbols are available right away
    try:
        results = run_screener(payload.criteria)
        for row in results:
            db.add(WatchlistSymbol(
                watchlist_id=wl.id,
                symbol=row.get("name"),
                exchange=row.get("exchange", ""),
                company_name=row.get("description", ""),
            ))
        wl.last_run_at = datetime.utcnow()
        db.commit()
    except Exception:
        pass  # screener failure doesn't block watchlist creation

    return {"id": wl.id, "name": wl.name}


@router.post("/watchlists/manual")
def create_watchlist_manual(payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = payload.get("name", "").strip()
    symbols = [s.strip().upper() for s in payload.get("symbols", []) if s.strip()]
    if not name or not symbols:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="name and symbols are required")
    wl = Watchlist(user_id=current_user.id, name=name, screener_criteria=None, refresh_interval_seconds=0)
    db.add(wl)
    db.commit()
    db.refresh(wl)
    provider = get_provider()
    for sym in symbols:
        company_name = provider.get_company_name(sym)
        db.add(WatchlistSymbol(watchlist_id=wl.id, symbol=sym, exchange="", company_name=company_name))
    db.commit()
    return {"id": wl.id, "name": wl.name}


@router.get("/watchlists")
def list_watchlists(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    watchlists = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).all()
    return [{"id": w.id, "name": w.name, "last_run_at": w.last_run_at, "screener_criteria": w.screener_criteria} for w in watchlists]


@router.delete("/watchlists/{watchlist_id}")
def delete_watchlist(watchlist_id: int, db: Session = Depends(get_db)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not wl:
        return {"error": "not found"}
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
    db.commit()
    return {"id": wl.id, "name": wl.name}


@router.get("/watchlists/{watchlist_id}/symbols")
def get_watchlist_symbols(watchlist_id: int, db: Session = Depends(get_db)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not wl:
        return {"error": "not found"}
    return [{"symbol": s.symbol, "exchange": s.exchange, "company_name": getattr(s, "company_name", "")} for s in wl.symbols]


@router.delete("/watchlists/{watchlist_id}/symbols/{symbol}")
def delete_watchlist_symbol(watchlist_id: int, symbol: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    wl = db.query(Watchlist).filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id).first()
    if not wl:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    sym = db.query(WatchlistSymbol).filter(WatchlistSymbol.watchlist_id == watchlist_id, WatchlistSymbol.symbol == symbol.upper()).first()
    if sym:
        db.delete(sym)
        db.commit()
    return {"deleted": symbol}
