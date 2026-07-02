import os
import httpx
import pandas as pd


class MarketDataProvider:
    def get_ohlcv(self, symbol: str, lookback_days: int = 60) -> pd.DataFrame:
        raise NotImplementedError

    def get_latest_price(self, symbol: str) -> float:
        raise NotImplementedError

    def get_company_name(self, symbol: str) -> str:
        return ""


class AlpacaProvider(MarketDataProvider):
    DATA_URL = "https://data.alpaca.markets"
    BROKER_URL = "https://api.alpaca.markets"

    def __init__(self, api_key: str, secret_key: str):
        self.headers = {"APCA-API-KEY-ID": api_key, "APCA-API-SECRET-KEY": secret_key}

    def get_ohlcv(self, symbol: str, lookback_days: int = 60) -> pd.DataFrame:
        end = pd.Timestamp.utcnow().date()
        start = end - pd.Timedelta(days=lookback_days)
        url = f"{self.DATA_URL}/v2/stocks/{symbol}/bars"
        # feed=iex: this account's plan doesn't permit querying recent SIP
        # data (403 without it) — iex is real-time and what we're entitled
        # to. Applied to the whole range, not just today, so the series
        # doesn't mix feeds partway through.
        params = {"start": str(start), "end": str(end), "timeframe": "1Day", "feed": "iex"}
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
        # get_ohlcv only ever returns completed daily bars (deliberately
        # excludes today), so it's always at least a day stale for "current
        # price" purposes. Use the real-time last-trade endpoint instead.
        url = f"{self.DATA_URL}/v2/stocks/{symbol}/trades/latest"
        resp = httpx.get(url, headers=self.headers, timeout=10)
        resp.raise_for_status()
        return float(resp.json()["trade"]["p"])

    def get_company_name(self, symbol: str) -> str:
        try:
            url = f"{self.BROKER_URL}/v2/assets/{symbol.upper()}"
            resp = httpx.get(url, headers=self.headers, timeout=5)
            if resp.status_code == 200:
                return resp.json().get("name", "")
        except Exception:
            pass
        return ""


def get_provider() -> MarketDataProvider:
    api_key = os.getenv("MARKET_DATA_API_KEY", "")
    secret = os.getenv("MARKET_DATA_SECRET_KEY", "")
    return AlpacaProvider(api_key, secret)
