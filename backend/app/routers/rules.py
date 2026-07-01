from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.models import Rule, Watchlist, User
from app.schemas import RuleCreate

# Standalone rules — independent of any specific watchlist
router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("")
def list_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rules = db.query(Rule).filter(Rule.user_id == current_user.id).order_by(Rule.id).all()
    return [_rule_summary(r, db) for r in rules]


@router.post("")
def create_rule(payload: RuleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = Rule(
        user_id=current_user.id,
        name=payload.name,
        buy_condition=payload.buy_condition.model_dump() if payload.buy_condition else None,
        sell_condition=payload.sell_condition.model_dump() if payload.sell_condition else None,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_detail(rule)


@router.get("/{rule_id}")
def get_rule(rule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = _get_owned(rule_id, db, current_user)
    return _rule_detail(rule)


@router.patch("/{rule_id}")
def update_rule(rule_id: int, payload: RuleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = _get_owned(rule_id, db, current_user)
    rule.name = payload.name
    if payload.buy_condition:
        rule.buy_condition = payload.buy_condition.model_dump()
    if payload.sell_condition:
        rule.sell_condition = payload.sell_condition.model_dump()
    rule.last_state = {}  # reset state so rules re-evaluate from scratch

    # Stop all watchlists that were running this rule
    affected = db.query(Watchlist).filter(Watchlist.rule_id == rule_id, Watchlist.rule_active == True).all()  # noqa: E712
    for wl in affected:
        wl.rule_active = False
    db.commit()

    affected_names = [wl.name for wl in affected]
    return {**_rule_detail(rule), "stopped_watchlists": affected_names}


@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = _get_owned(rule_id, db, current_user)

    # Clear rule assignment from any watchlists using it
    using = db.query(Watchlist).filter(Watchlist.rule_id == rule_id).all()
    for wl in using:
        wl.rule_id = None
        wl.rule_active = False
    db.commit()

    affected_names = [wl.name for wl in using]
    db.delete(rule)
    db.commit()
    return {"deleted": rule_id, "cleared_from_watchlists": affected_names}


# ── Legacy per-watchlist rule endpoints (kept for backward compat) ──────────

legacy = APIRouter(prefix="/watchlists/{watchlist_id}/rules", tags=["rules-legacy"])


@legacy.get("")
def list_rules_legacy(watchlist_id: int, db: Session = Depends(get_db)):
    rules = db.query(Rule).filter(Rule.watchlist_id == watchlist_id).all()
    return [{"id": r.id, "name": r.name, "active": r.active} for r in rules]


@legacy.get("/{rule_id}")
def get_rule_legacy(watchlist_id: int, rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return _rule_detail(rule)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_owned(rule_id: int, db: Session, current_user: User) -> Rule:
    rule = db.query(Rule).filter(Rule.id == rule_id, Rule.user_id == current_user.id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


def _rule_summary(rule: Rule, db: Session) -> dict:
    watchlist_count = db.query(Watchlist).filter(Watchlist.rule_id == rule.id).count()
    active_count = db.query(Watchlist).filter(
        Watchlist.rule_id == rule.id, Watchlist.rule_active == True  # noqa: E712
    ).count()
    return {
        "id": rule.id,
        "name": rule.name,
        "watchlist_count": watchlist_count,
        "active_count": active_count,
        "buy_condition": rule.buy_condition,
        "sell_condition": rule.sell_condition,
    }


def _rule_detail(rule: Rule) -> dict:
    return {
        "id": rule.id,
        "name": rule.name,
        "buy_condition": rule.buy_condition,
        "sell_condition": rule.sell_condition,
    }
