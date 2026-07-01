"""
Wraps the `tradingview-screener` package to turn a ScreenerCriteria DSL
object into a live list of US-listed symbols.

NOTE: tradingview-screener is an unofficial wrapper around TradingView's
internal API. It is not affiliated with TradingView and is subject to their
rate limits / Terms of Service. Use it for discovery only; the indicator
engine pulls its actual price data from the dedicated market data provider,
not from this package.
"""
from typing import List, Dict
from app.schemas import ScreenerCriteria

try:
    from tradingview_screener import Query, Column, And, Or
except ImportError:
    Query = Column = And = Or = None


_OPERATOR_MAP = {
    "gt": lambda col, v: col > v,
    "gte": lambda col, v: col >= v,
    "lt": lambda col, v: col < v,
    "lte": lambda col, v: col <= v,
    "eq": lambda col, v: col == v,
    "neq": lambda col, v: col != v,
    "in": lambda col, v: col.isin(v),
    "between": lambda col, v: col.between(v[0], v[1]),
}


def run_screener(criteria: ScreenerCriteria) -> List[Dict]:
    """
    Executes the screener against TradingView and returns a list of
    {symbol, exchange, ...selected fields} dicts.
    """
    if Query is None:
        raise RuntimeError(
            "tradingview-screener is not installed. Run `pip install tradingview-screener`."
        )

    query = (
        Query()
        .select("name", "description", "close", "volume", "market_cap_basic", "sector", "exchange")
        .where(Column("exchange").isin(criteria.exchanges))
    )

    conditions = []
    for f in criteria.filters:
        col = Column(f.field)
        op_fn = _OPERATOR_MAP[f.operator]
        conditions.append(op_fn(col, f.value))

    if conditions:
        if criteria.logic == "and":
            query = query.where(*conditions)        # where() AND's multiple args natively
        else:
            query = query.where2(Or(*conditions))   # OR requires where2() + Or() combinator

    # TradingView's API errors out if the requested range exceeds the number
    # of matching rows, so probe the real total first and clamp to it.
    total_count, _ = query.limit(1).get_scanner_data()
    _, df = query.limit(min(criteria.limit, total_count)).get_scanner_data()

    return df.to_dict(orient="records")
