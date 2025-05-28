import yfinance as yf
import pandas as pd
import redis.asyncio as redis
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Optional
from app.core.config import settings
from app.core.data_models import OHLCV, TechnicalData, MarketData
from app.utils.data_helpers import ohlcv_to_df, calculate_rsi, calculate_atr

logger = logging.getLogger(__name__)

class MarketCollector:
    def __init__(self):
        self.redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.symbols = settings.TRADING_SYMBOLS
        self.cache_ttl = 30

    async def collect_data(self) -> Dict[str, MarketData]:
        try:
            data = {}
            for symbol in self.symbols:
                ticker = yf.Ticker(symbol)
                hist_5m = ticker.history(period="2d", interval="5m")
                hist_15m = ticker.history(period="5d", interval="15m")
                
                if hist_5m.empty or hist_15m.empty:
                    continue
                
                current_price = float(hist_5m['Close'].iloc[-1])
                prev_close = float(hist_5m['Close'].iloc[-2])
                change_pct = ((current_price / prev_close) - 1) * 100
                
                data[symbol] = MarketData(
                    symbol=symbol,
                    price=current_price,
                    change_pct=change_pct,
                    volume=int(hist_5m['Volume'].iloc[-1]),
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    ohlcv_5m=self._to_ohlcv(hist_5m.tail(50)),
                    ohlcv_15m=self._to_ohlcv(hist_15m.tail(30)),
                    technical=self._calc_technical(hist_5m),
                    market_state=self._market_state()
                )
            
            await self._cache_data(data)
            return data
        except Exception as e:
            logger.error(f"Collection error: {e}")
            return {}

    def _to_ohlcv(self, df: pd.DataFrame) -> List[OHLCV]:
        return [OHLCV(
            timestamp=idx.isoformat(),
            open=float(row['Open']),
            high=float(row['High']),
            low=float(row['Low']),
            close=float(row['Close']),
            volume=int(row['Volume'])
        ) for idx, row in df.iterrows()]

    def _calc_technical(self, df: pd.DataFrame) -> TechnicalData:
        try:
            rsi = calculate_rsi(df['Close'])
            sma_20 = df['Close'].rolling(20).mean().iloc[-1]
            ema_12 = df['Close'].ewm(span=12).mean().iloc[-1]
            ema_26 = df['Close'].ewm(span=26).mean().iloc[-1]
            macd_line = ema_12 - ema_26
            macd_signal = macd_line.ewm(span=9).mean().iloc[-1]
            
            sma = df['Close'].rolling(20).mean()
            std = df['Close'].rolling(20).std()
            bb_upper = (sma + (std * 2)).iloc[-1]
            bb_lower = (sma - (std * 2)).iloc[-1]
            atr = calculate_atr(df)
            
            return TechnicalData(
                rsi=float(rsi), sma_20=float(sma_20), ema_12=float(ema_12),
                ema_26=float(ema_26), macd=float(macd_line.iloc[-1]),
                macd_signal=float(macd_signal), bollinger_upper=float(bb_upper),
                bollinger_lower=float(bb_lower), atr=float(atr)
            )
        except:
            return TechnicalData()

    def _market_state(self) -> str:
        now = datetime.now(timezone.utc)
        hour = now.hour
        return "market_hours" if 14 <= hour <= 21 else "pre_market" if hour < 14 else "after_market"

    async def _cache_data(self, data: Dict[str, MarketData]):
        try:
            cache_data = {k: v.__dict__ for k, v in data.items()}
            await self.redis.setex("market_data", self.cache_ttl, json.dumps(cache_data, default=str))
        except Exception as e:
            logger.error(f"Cache error: {e}")

    async def get_cached_data(self) -> Optional[Dict[str, MarketData]]:
        try:
            cached = await self.redis.get("market_data")
            if cached:
                data = json.loads(cached)
                result = {}
                for symbol, snapshot_data in data.items():
                    snapshot_data['ohlcv_5m'] = [OHLCV(**ohlcv) for ohlcv in snapshot_data['ohlcv_5m']]
                    snapshot_data['ohlcv_15m'] = [OHLCV(**ohlcv) for ohlcv in snapshot_data['ohlcv_15m']]
                    snapshot_data['technical'] = TechnicalData(**snapshot_data['technical'])
                    result[symbol] = MarketData(**snapshot_data)
                return result
        except Exception as e:
            logger.error(f"Cache retrieval error: {e}")
        return None