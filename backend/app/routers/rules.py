from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import RuleCreate, AlertChannelCreate
from app.models.models import Rule, AlertChannel

router = APIRouter(prefix="/watchlists/{watchlist_id}/rules", tags=["rules"])


@router.post("")
def create_rule(watchlist_id: int, payload: RuleCreate, db: Session = Depends(get_db)):
    rule = Rule(
        watchlist_id=watchlist_id,
        name=payload.name,
        buy_condition=payload.buy_condition.model_dump() if payload.buy_condition else None,
        sell_condition=payload.sell_condition.model_dump() if payload.sell_condition else None,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return {"id": rule.id, "name": rule.name}


@router.get("")
def list_rules(watchlist_id: int, db: Session = Depends(get_db)):
    rules = db.query(Rule).filter(Rule.watchlist_id == watchlist_id).all()
    return [{"id": r.id, "name": r.name, "active": r.active} for r in rules]


@router.get("/{rule_id}")
def get_rule(watchlist_id: int, rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(Rule).filter(Rule.id == rule_id, Rule.watchlist_id == watchlist_id).first()
    if not rule:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rule not found")
    return {
        "id": rule.id,
        "name": rule.name,
        "active": rule.active,
        "buy_condition": rule.buy_condition,
        "sell_condition": rule.sell_condition,
    }


@router.get("/{rule_id}/alert-channels")
def list_alert_channels(watchlist_id: int, rule_id: int, db: Session = Depends(get_db)):
    channels = db.query(AlertChannel).filter(AlertChannel.rule_id == rule_id).all()
    return [{"id": c.id, "channel_type": c.channel_type, "destination": c.destination, "active": c.active} for c in channels]


@router.patch("/{rule_id}/alert-channels/{channel_id}")
def update_alert_channel(watchlist_id: int, rule_id: int, channel_id: int, payload: AlertChannelCreate, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    channel = db.query(AlertChannel).filter(AlertChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    channel.destination = payload.destination
    db.commit()
    return {"id": channel.id, "channel_type": channel.channel_type, "destination": channel.destination}


@router.post("/{rule_id}/alert-channels/{channel_id}/test")
def test_alert_channel(watchlist_id: int, rule_id: int, channel_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    from datetime import datetime
    from app.services.alert_dispatcher import dispatch

    channel = db.query(AlertChannel).filter(AlertChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    class MockSignal:
        symbol = "AAPL"
        side = "buy"
        price_at_signal = 195.42
        fired_at = datetime.utcnow()
        indicator_snapshot = {"rsi": 28.5, "close": 195.42}

    try:
        dispatch(channel, MockSignal())
        return {"message": "Test alert sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{rule_id}/alert-channels")
def add_alert_channel(watchlist_id: int, rule_id: int, payload: AlertChannelCreate, db: Session = Depends(get_db)):
    channel = AlertChannel(
        rule_id=rule_id,
        channel_type=payload.channel_type,
        destination=payload.destination,
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return {"id": channel.id, "channel_type": channel.channel_type}
