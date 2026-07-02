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


def _williams_r(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high = df["high"].rolling(period).max()
    low = df["low"].rolling(period).min()
    return -100 * (high - df["close"]) / (high - low)


def _ultimate_oscillator(df: pd.DataFrame) -> pd.Series:
    prev_close = df["close"].shift(1)
    bp = df["close"] - df[["low", prev_close]].min(axis=1)
    tr = df[["high", prev_close]].max(axis=1) - df[["low", prev_close]].min(axis=1)
    avg7 = bp.rolling(7).sum() / tr.rolling(7).sum()
    avg14 = bp.rolling(14).sum() / tr.rolling(14).sum()
    avg28 = bp.rolling(28).sum() / tr.rolling(28).sum()
    return 100 * (4 * avg7 + 2 * avg14 + avg28) / 7


def _bollinger(series: pd.Series, period: int = 20):
    mid = series.rolling(period).mean()
    std = series.rolling(period).std()
    return mid + 2 * std, mid - 2 * std


def _stochastic(df: pd.DataFrame, k_period: int = 14, d_period: int = 3):
    low_min = df["low"].rolling(k_period).min()
    high_max = df["high"].rolling(k_period).max()
    percent_k = 100 * (df["close"] - low_min) / (high_max - low_min)
    percent_d = percent_k.rolling(d_period).mean()
    return percent_k, percent_d


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
    elif name == "WILLIAMS_R":
        return _williams_r(df, period=params.get("period", 14))
    elif name == "ULTIMATE_OSC":
        return _ultimate_oscillator(df)
    elif name == "BB_UPPER":
        upper, _ = _bollinger(df["close"], period=params.get("period", 20))
        return upper
    elif name == "BB_LOWER":
        _, lower = _bollinger(df["close"], period=params.get("period", 20))
        return lower
    elif name == "STOCH_K":
        k, _ = _stochastic(df, k_period=params.get("period", 14))
        return k
    elif name == "STOCH_D":
        _, d = _stochastic(df, k_period=params.get("period", 14))
        return d
    else:
        raise ValueError(f"Unsupported indicator: {term.indicator}")


def _evaluate_term(df: pd.DataFrame, term: IndicatorTerm) -> bool:
    series = _compute_indicator(df, term)
    latest = series.iloc[-1]
    prev = series.iloc[-2] if len(series) > 1 else latest

    if isinstance(term.value, str):
        # value names another indicator (e.g. MACD vs MACD_SIGNAL, VOLUME vs
        # VOLUME_SMA) — compare the two series directly instead of a literal.
        target_term = IndicatorTerm(indicator=term.value, params={}, operator=term.operator, value=0)
        target_series = _compute_indicator(df, target_term)
        target_latest = target_series.iloc[-1]
        target_prev = target_series.iloc[-2] if len(target_series) > 1 else target_latest
    else:
        target_latest = target_prev = term.value

    if term.operator == "gt":
        return latest > target_latest
    elif term.operator == "gte":
        return latest >= target_latest
    elif term.operator == "lt":
        return latest < target_latest
    elif term.operator == "lte":
        return latest <= target_latest
    elif term.operator == "crosses_above":
        return prev <= target_prev and latest > target_latest
    elif term.operator == "crosses_below":
        return prev >= target_prev and latest < target_latest
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
    df: pd.DataFrame,
    buy_condition: ConditionGroup,
    sell_condition: ConditionGroup,
) -> Dict:
    """Evaluates conditions against a symbol's OHLCV frame (fetched by the
    caller, typically in one batched request for a whole watchlist).

    Returns {"buy": bool, "sell": bool, "price": float, "snapshot": dict}."""
    if df is None or df.empty or len(df) < 5:
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
