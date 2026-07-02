import os
import time

import httpx
import pandas as pd


class MarketDataProvider:
    def get_ohlcv(self, symbol: str, lookback_days: int = 60) -> pd.DataFrame:
        raise NotImplementedError

    def get_ohlcv_batch(self, symbols: list[str], lookback_days: int = 60) -> dict[str, pd.DataFrame]:
        out = {}
        for sym in symbols:
            try:
                out[sym] = self.get_ohlcv(sym, lookback_days)
            except Exception:
                continue
        return out

    def get_latest_price(self, symbol: str) -> float:
        raise NotImplementedError

    def get_latest_prices(self, symbols: list[str]) -> dict[str, float]:
        out = {}
        for sym in symbols:
            try:
                out[sym] = self.get_latest_price(sym)
            except Exception:
                continue
        return out

    def get_company_name(self, symbol: str) -> str:
        return ""


class AlpacaProvider(MarketDataProvider):
    DATA_URL = "https://data.alpaca.markets"
    BROKER_URL = "https://api.alpaca.markets"

    def __init__(self, api_key: str, secret_key: str):
        self.headers = {"APCA-API-KEY-ID": api_key, "APCA-API-SECRET-KEY": secret_key}

    def _get(self, url: str, params: dict, timeout: float = 10) -> httpx.Response:
        # The free plan is capped at 200 req/min; when a burst exhausts the
        # window, wait for the reset once (capped so an interactive request
        # can't hang the mobile app) rather than failing outright.
        resp = httpx.get(url, headers=self.headers, params=params, timeout=timeout)
        if resp.status_code == 429:
            reset = resp.headers.get("x-ratelimit-reset")
            wait = min(max(int(reset) - time.time() + 0.5, 1), 10) if reset else 3
            time.sleep(wait)
            resp = httpx.get(url, headers=self.headers, params=params, timeout=timeout)
        resp.raise_for_status()
        return resp

    def get_ohlcv(self, symbol: str, lookback_days: int = 60) -> pd.DataFrame:
        return self.get_ohlcv_batch([symbol], lookback_days).get(symbol, pd.DataFrame())

    # One request covers up to _BARS_CHUNK symbols (vs one request per symbol),
    # which is what keeps the scheduler far below the free plan's 200 req/min.
    _BARS_CHUNK = 200

    def get_ohlcv_batch(self, symbols: list[str], lookback_days: int = 60) -> dict[str, pd.DataFrame]:
        end = pd.Timestamp.utcnow().date()
        start = end - pd.Timedelta(days=lookback_days)
        out: dict[str, pd.DataFrame] = {}

        for i in range(0, len(symbols), self._BARS_CHUNK):
            chunk = symbols[i:i + self._BARS_CHUNK]
            bars_by_symbol: dict[str, list] = {}
            # feed=iex: this account's plan doesn't permit querying recent SIP
            # data (403 without it) — iex is real-time and what we're entitled
            # to. Applied to the whole range, not just today, so the series
            # doesn't mix feeds partway through.
            params = {
                "symbols": ",".join(chunk),
                "start": str(start), "end": str(end),
                "timeframe": "1Day", "feed": "iex", "limit": 10000,
            }
            while True:
                resp = self._get(f"{self.DATA_URL}/v2/stocks/bars", params, timeout=30)
                payload = resp.json()
                for sym, bars in (payload.get("bars") or {}).items():
                    bars_by_symbol.setdefault(sym, []).extend(bars)
                token = payload.get("next_page_token")
                if not token:
                    break
                params["page_token"] = token

            for sym, bars in bars_by_symbol.items():
                df = pd.DataFrame(bars)
                if df.empty:
                    out[sym] = df
                    continue
                df["date"] = pd.to_datetime(df["t"])
                df = df.rename(columns={"o": "open", "h": "high", "l": "low", "c": "close", "v": "volume"})
                out[sym] = df.set_index("date")[["open", "high", "low", "close", "volume"]]

        return out

    def get_latest_price(self, symbol: str) -> float:
        prices = self.get_latest_prices([symbol])
        if symbol not in prices:
            raise ValueError(f"No price available for {symbol}")
        return prices[symbol]

    def get_latest_prices(self, symbols: list[str]) -> dict[str, float]:
        # Two feeds, freshest trade wins. iex is real-time but a single small
        # exchange — thin symbols stop printing there at (or before) the 4pm
        # close. delayed_sip is the consolidated all-exchange tape at a
        # 15-minute delay, so it keeps moving through extended hours and
        # covers symbols iex barely trades. Comparing trade timestamps picks
        # real-time iex intraday and delayed_sip after hours automatically.
        best: dict[str, tuple[float, pd.Timestamp]] = {}
        for feed in ("iex", "delayed_sip"):
            try:
                for sym, (price, ts) in self._snapshot_prices(symbols, feed).items():
                    if sym not in best or ts > best[sym][1]:
                        best[sym] = (price, ts)
            except Exception:
                continue
        return {sym: price for sym, (price, _) in best.items()}

    def _snapshot_prices(self, symbols: list[str], feed: str) -> dict[str, tuple[float, pd.Timestamp]]:
        url = f"{self.DATA_URL}/v2/stocks/snapshots"
        params = {"symbols": ",".join(symbols), "feed": feed}
        resp = self._get(url, params)
        out = {}
        for sym, snap in resp.json().items():
            if not isinstance(snap, dict):
                continue
            # Quotes are skipped on purpose: after-hours iex quotes can carry
            # absurd spreads (observed $30 wide on AAPL), so a mid-price is
            # less trustworthy than an older trade or bar close.
            candidates = [
                (snap.get("latestTrade") or {}).get("p"),
                (snap.get("minuteBar") or {}).get("c"),
                (snap.get("dailyBar") or {}).get("c"),
                (snap.get("prevDailyBar") or {}).get("c"),
            ]
            timestamps = [
                (snap.get("latestTrade") or {}).get("t"),
                (snap.get("minuteBar") or {}).get("t"),
                (snap.get("dailyBar") or {}).get("t"),
                (snap.get("prevDailyBar") or {}).get("t"),
            ]
            for price, ts in zip(candidates, timestamps):
                if price:
                    out[sym] = (float(price), pd.Timestamp(ts))
                    break
        return out

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
