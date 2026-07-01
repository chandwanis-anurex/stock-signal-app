from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON, Text
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    push_token = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reset_code = Column(String, nullable=True)
    reset_code_expiry = Column(Float, nullable=True)

    watchlists = relationship("Watchlist", back_populates="user")


class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    screener_criteria = Column(JSON, nullable=True)
    refresh_interval_seconds = Column(Integer, default=300)
    last_run_at = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)
    # Rule assigned to this watchlist (one rule per watchlist)
    rule_id = Column(Integer, ForeignKey("rules.id"), nullable=True)
    rule_active = Column(Boolean, default=False)

    user = relationship("User", back_populates="watchlists")
    symbols = relationship("WatchlistSymbol", back_populates="watchlist", cascade="all, delete-orphan")
    # Legacy: rules that list this watchlist as owner (old model)
    legacy_rules = relationship("Rule", foreign_keys="Rule.watchlist_id", back_populates="legacy_watchlist")
    # New: the assigned rule
    rule = relationship("Rule", foreign_keys=[rule_id], post_update=True)
    alert_channels = relationship("AlertChannel", foreign_keys="AlertChannel.watchlist_id",
                                  back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistSymbol(Base):
    __tablename__ = "watchlist_symbols"

    id = Column(Integer, primary_key=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"))
    symbol = Column(String, nullable=False)
    exchange = Column(String, nullable=False, default="")
    company_name = Column(String, nullable=False, default="")
    is_manual = Column(Boolean, default=False)
    added_at = Column(DateTime, default=datetime.utcnow)

    watchlist = relationship("Watchlist", back_populates="symbols")


class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True)
    # user who owns this rule (standalone rules)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # legacy: watchlist that owns this rule (old model, nullable going forward)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=True)
    name = Column(String, nullable=False)
    buy_condition = Column(JSON, nullable=True)
    sell_condition = Column(JSON, nullable=True)
    active = Column(Boolean, default=True)
    last_state = Column(JSON, default=dict)

    legacy_watchlist = relationship("Watchlist", foreign_keys=[watchlist_id], back_populates="legacy_rules")
    # Legacy alert channels (old model — channels were on rules)
    legacy_alert_channels = relationship("AlertChannel", foreign_keys="AlertChannel.rule_id",
                                         back_populates="legacy_rule", cascade="all, delete-orphan")
    signals = relationship("Signal", back_populates="rule", cascade="all, delete-orphan")


class AlertChannel(Base):
    __tablename__ = "alert_channels"

    id = Column(Integer, primary_key=True)
    # New: channels belong to a watchlist
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=True)
    # Legacy: channels belonged to a rule
    rule_id = Column(Integer, ForeignKey("rules.id"), nullable=True)
    channel_type = Column(String, nullable=False)  # sms | email | push | webhook
    destination = Column(String, nullable=False)
    active = Column(Boolean, default=True)

    watchlist = relationship("Watchlist", foreign_keys=[watchlist_id], back_populates="alert_channels")
    legacy_rule = relationship("Rule", foreign_keys=[rule_id], back_populates="legacy_alert_channels")


class Signal(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True)
    rule_id = Column(Integer, ForeignKey("rules.id"))
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False)  # buy | sell
    price_at_signal = Column(Float, nullable=False)
    indicator_snapshot = Column(JSON, nullable=True)
    fired_at = Column(DateTime, default=datetime.utcnow)

    rule = relationship("Rule", back_populates="signals")
    performance = relationship("SignalPerformance", back_populates="signal", cascade="all, delete-orphan")


class SignalPerformance(Base):
    __tablename__ = "signal_performance"

    id = Column(Integer, primary_key=True)
    signal_id = Column(Integer, ForeignKey("signals.id"))
    checkpoint = Column(String, nullable=False)  # 1d | 1w | 1m | current
    price_at_checkpoint = Column(Float, nullable=False)
    return_pct = Column(Float, nullable=False)
    computed_at = Column(DateTime, default=datetime.utcnow)

    signal = relationship("Signal", back_populates="performance")
