"""
Thin abstraction over the market data provider used for indicator math.

Swap providers by implementing `get_ohlcv` for a new class and pointing
MARKET_DATA_PROVIDER at it. Polygon and Alpaca are stubbed here since both
have generous US-equity coverage; Twelve Data could be added the same way if
you'd rather let the vendor compute indicators server-side instead of doing
it locally with pandas-ta.
"""
import os
import httpx
import pandas as pd


class MarketDataProvider:
    def get_ohlcv(self, symbol: str, lookback_days: int = 60) -> pd.DataFrame:
        """Returns a DataFrame indexed by date with columns: open, high, low, close, volume."""
        raise NotImplementedError

    def get_latest_price(self, symbol: str) -> float:
        raise NotImplementedError


class PolygonProvider(MarketDataProvider):
    BASE_URL = "https://api.polygon.io"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def get_ohlcv(self, symbol: str, lookback_days: int = 60) -> pd.DataFrame:
        end = pd.Timestamp.utcnow().date()
        start = end - pd.Timedelta(days=lookback_days)
        url = f"{self.BASE_URL}/v2/aggs/ticker/{symbol}/range/1/day/{start}/{end}"
        resp = httpx.get(url, params={"apiKey": self.api_key, "sort": "asc"})
        resp.raise_for_status()
        results = resp.json().get("results", [])
        df = pd.DataFrame(results)
        if df.empty:
            return df
        df["date"] = pd.to_datetime(df["t"], unit="ms")
        df = df.rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"})
        return df.set_index("date")[["open", "high", "low", "close", "volume"]]

    def get_latest_price(self, symbol: str) -> float:
        url = f"{self.BASE_URL}/v2/last/trade/{symbol}"
        resp = httpx.get(url, params={"apiKey": self.api_key})
        resp.raise_for_status()
        return resp.json()["results"]["p"]


class AlpacaProvider(MarketDataProvider):
    BASE_URL = "https://data.alpaca.markets"

    def __init__(self, api_key: str, secret_key: str):
        self.headers = {"APCA-API-KEY-ID": api_key, "APCA-API-SECRET-KEY": secret_key}

    def get_ohlcv(self, symbol: str, lookback_days: int = 60) -> pd.DataFrame:
        end = pd.Timestamp.utcnow().date() - pd.Timedelta(days=1)  # yesterday; today = real-time (paid)
        start = end - pd.Timedelta(days=lookback_days)
        url = f"{self.BASE_URL}/v2/stocks/{symbol}/bars"
        params = {"start": str(start), "end": str(end), "timeframe": "1Day"}
        resp = httpx.get(url, headers=self.headers, params=params)
        resp.raise_for_status()
        bars = resp.json().get("bars", [])
        df = pd.DataFrame(bars)
        if df.empty:
            return df
        df["date"] = pd.to_datetime(df["t"])
        df = df.rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"})
        return df.set_index("date")[["open", "high", "low", "close", "volume"]]

    def get_latest_price(self, symbol: str) -> float:
        df = self.get_ohlcv(symbol, lookback_days=2)
        return float(df["close"].iloc[-1])


def get_provider() -> MarketDataProvider:
    provider = os.getenv("MARKET_DATA_PROVIDER", "polygon")
    api_key = os.getenv("MARKET_DATA_API_KEY", "")

    if provider == "polygon":
        return PolygonProvider(api_key)
    elif provider == "alpaca":
        secret = os.getenv("MARKET_DATA_SECRET_KEY", "")
        return AlpacaProvider(api_key, secret)
    else:
        raise ValueError(f"Unsupported MARKET_DATA_PROVIDER: {provider}")
