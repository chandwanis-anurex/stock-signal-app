"""
Pydantic request/response schemas, including the small DSLs used for:
  - screener_criteria  (translated into a tradingview_screener.Query)
  - rule conditions     (evaluated by the indicator engine against live OHLCV)

Both DSLs are intentionally simple JSON trees so the mobile app's form-based
builders can produce them without needing to know any query syntax.
"""
from typing import Any, List, Literal, Optional, Union
from pydantic import BaseModel


# ---------- Screener criteria DSL ----------

class ScreenerFilter(BaseModel):
    field: str            # e.g. "market_cap_basic", "RSI", "sector", "exchange"
    operator: Literal["gt", "gte", "lt", "lte", "eq", "neq", "in", "between"]
    value: Any            # number, string, list, or [low, high] for "between"


class ScreenerCriteria(BaseModel):
    exchanges: List[str] = ["NASDAQ", "NYSE", "AMEX"]
    filters: List[ScreenerFilter] = []
    logic: Literal["and", "or"] = "and"
    limit: int = 500


class WatchlistCreate(BaseModel):
    name: str
    criteria: ScreenerCriteria
    refresh_interval_seconds: int = 300


# ---------- Rule / indicator threshold DSL ----------

class IndicatorTerm(BaseModel):
    indicator: str               # e.g. "RSI", "MACD", "SMA", "VOLUME"
    params: dict = {}            # e.g. {"period": 14}
    operator: Literal["gt", "gte", "lt", "lte", "crosses_above", "crosses_below"]
    value: Union[float, str]     # number, or another indicator expression as string


class ConditionGroup(BaseModel):
    logic: Literal["and", "or"] = "and"
    terms: List[Union[IndicatorTerm, "ConditionGroup"]] = []


ConditionGroup.model_rebuild()


class RuleCreate(BaseModel):
    name: str
    buy_condition: Optional[ConditionGroup] = None
    sell_condition: Optional[ConditionGroup] = None


class AlertChannelCreate(BaseModel):
    channel_type: Literal["sms", "email", "push", "webhook"]
    destination: str
