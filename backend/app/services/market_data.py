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
        end = pd.Timestamp.utcnow().date() - pd.Timedelta(days=1)
        start = end - pd.Timedelta(days=lookback_days)
        url = f"{self.DATA_URL}/v2/stocks/{symbol}/bars"
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
