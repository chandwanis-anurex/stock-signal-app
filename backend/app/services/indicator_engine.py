"""
Evaluates a ConditionGroup (see schemas.py) against fresh OHLCV data for a
symbol. Indicators are computed directly with pandas so there is no dependency
on pandas-ta (which requires numba, unsupported on Python 3.14+).

Signals only fire on a false -> true transition, which is tracked via
Rule.last_state (a dict of {symbol: {"buy": bool, "sell": bool}}), so the
same condition staying true for many cycles doesn't spam repeat alerts.
"""
from typing import Dict
import pandas as pd

from app.schemas import ConditionGroup, IndicatorTerm
from app.services.market_data import MarketDataProvider


def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0).ewm(com=period - 1, min_periods=period).mean()
    loss = (-delta.where(delta < 0, 0.0)).ewm(com=period - 1, min_periods=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def _macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line, signal_line


def _compute_indicator(df: pd.DataFrame, term: IndicatorTerm) -> pd.Series:
    name = term.indicator.upper()
    params = term.params or {}

    if name == "RSI":
        return _rsi(df["close"], period=params.get("period", 14))
    elif name == "SMA":
        return df["close"].rolling(params.get("period", 20)).mean()
    elif name == "EMA":
        return df["close"].ewm(span=params.get("period", 20), adjust=False).mean()
    elif name == "MACD":
        macd_line, _ = _macd(df["close"])
        return macd_line
    elif name == "MACD_SIGNAL":
        _, signal_line = _macd(df["close"])
        return signal_line
    elif name == "VOLUME":
        return df["volume"]
    elif name == "VOLUME_SMA":
        return df["volume"].rolling(params.get("period", 20)).mean()
    elif name == "CLOSE":
        return df["close"]
    else:
        raise ValueError(f"Unsupported indicator: {term.indicator}")


def _evaluate_term(df: pd.DataFrame, term: IndicatorTerm) -> bool:
    series = _compute_indicator(df, term)
    latest = series.iloc[-1]
    prev = series.iloc[-2] if len(series) > 1 else latest

    target = term.value
    if isinstance(target, str):
        # value references another computed series name isn't supported in this
        # minimal engine yet; treat as a literal float for now.
        target = float(target)

    if term.operator == "gt":
        return latest > target
    elif term.operator == "gte":
        return latest >= target
    elif term.operator == "lt":
        return latest < target
    elif term.operator == "lte":
        return latest <= target
    elif term.operator == "crosses_above":
        return prev <= target < latest
    elif term.operator == "crosses_below":
        return prev >= target > latest
    else:
        raise ValueError(f"Unsupported operator: {term.operator}")


def evaluate_condition(df: pd.DataFrame, condition: ConditionGroup) -> bool:
    if condition is None or not condition.terms:
        return False

    results = []
    for term in condition.terms:
        if isinstance(term, ConditionGroup):
            results.append(evaluate_condition(df, term))
        else:
            results.append(_evaluate_term(df, term))

    return all(results) if condition.logic == "and" else any(results)


def evaluate_symbol(
    provider: MarketDataProvider,
    symbol: str,
    buy_condition: ConditionGroup,
    sell_condition: ConditionGroup,
) -> Dict:
    """Returns {"buy": bool, "sell": bool, "price": float, "snapshot": dict}."""
    df = provider.get_ohlcv(symbol, lookback_days=90)
    if df.empty or len(df) < 5:
        return {"buy": False, "sell": False, "price": None, "snapshot": {}}

    buy_triggered = evaluate_condition(df, buy_condition) if buy_condition else False
    sell_triggered = evaluate_condition(df, sell_condition) if sell_condition else False
    price = float(df["close"].iloc[-1])

    return {
        "buy": buy_triggered,
        "sell": sell_triggered,
        "price": price,
        "snapshot": {"close": price, "volume": float(df["volume"].iloc[-1])},
    }
