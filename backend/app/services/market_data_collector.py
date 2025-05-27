# app/services/market_data_collector.py
import yfinance as yf
import pandas as pd
import redis.asyncio as redis
import json
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

@dataclass
class OHLCVData:
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    
@dataclass 
class TechnicalIndicators:
    rsi: float
    sma_20: float
    ema_12: float
    ema_26: float
    macd: float
    macd_signal: float
    bollinger_upper: float
    bollinger_lower: float
    atr: float

@dataclass
class MarketSnapshot:
    symbol: str
    current_price: float
    change_percent: float
    volume: int
    timestamp: str
    ohlcv_5m: List[OHLCVData]
    ohlcv_15m: List[OHLCVData]
    technical_indicators: TechnicalIndicators
    market_state: str  # "pre_market", "market_hours", "after_market"

class MarketDataCollector:
    def __init__(self):
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.symbols = settings.TRADING_SYMBOLS
        self.timeframes = ["5m", "15m", "1h"]
        self.cache_duration = 30  # секунды
        
    async def collect_realtime_data(self) -> Dict[str, MarketSnapshot]:
        """Сбор real-time данных с Yahoo Finance"""
        try:
            data = {}
            
            for symbol in self.symbols:
                logger.info(f"Collecting data for {symbol}")
                
                # Получение данных через yfinance
                ticker = yf.Ticker(symbol)
                
                # История за последние 2 дня с интервалом 5м
                hist_5m = ticker.history(period="2d", interval="5m")
                hist_15m = ticker.history(period="5d", interval="15m")
                
                if hist_5m.empty or hist_15m.empty:
                    logger.warning(f"No data received for {symbol}")
                    continue
                
                # Текущая цена и изменение
                current_price = float(hist_5m['Close'].iloc[-1])
                prev_close = float(hist_5m['Close'].iloc[-2])
                change_percent = ((current_price / prev_close) - 1) * 100
                current_volume = int(hist_5m['Volume'].iloc[-1])
                
                # Преобразование в OHLCV структуры
                ohlcv_5m = self._convert_to_ohlcv(hist_5m.tail(50))
                ohlcv_15m = self._convert_to_ohlcv(hist_15m.tail(30))
                
                # Расчет технических индикаторов
                technical_indicators = self._calculate_technical_indicators(hist_5m)
                
                # Определение состояния рынка
                market_state = self._get_market_state()
                
                # Создание снапшота
                snapshot = MarketSnapshot(
                    symbol=symbol,
                    current_price=current_price,
                    change_percent=change_percent,
                    volume=current_volume,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    ohlcv_5m=ohlcv_5m,
                    ohlcv_15m=ohlcv_15m,
                    technical_indicators=technical_indicators,
                    market_state=market_state
                )
                
                data[symbol] = snapshot
            
            # Кэширование данных
            await self._cache_data(data)
            
            logger.info(f"Successfully collected data for {len(data)} symbols")
            return data
            
        except Exception as e:
            logger.error(f"Error collecting market data: {e}")
            return {}
    
    def _convert_to_ohlcv(self, df: pd.DataFrame) -> List[OHLCVData]:
        """Преобразование DataFrame в список OHLCV"""
        ohlcv_list = []
        
        for idx, row in df.iterrows():
            ohlcv = OHLCVData(
                timestamp=idx.isoformat(),
                open=float(row['Open']),
                high=float(row['High']),
                low=float(row['Low']),
                close=float(row['Close']),
                volume=int(row['Volume'])
            )
            ohlcv_list.append(ohlcv)
        
        return ohlcv_list
    
    def _calculate_technical_indicators(self, df: pd.DataFrame) -> TechnicalIndicators:
        """Расчет технических индикаторов"""
        try:
            # RSI
            rsi = self._calculate_rsi(df['Close'], 14)
            
            # Moving Averages
            sma_20 = df['Close'].rolling(20).mean().iloc[-1]
            ema_12 = df['Close'].ewm(span=12).mean().iloc[-1]
            ema_26 = df['Close'].ewm(span=26).mean().iloc[-1]
            
            # MACD
            macd_line = ema_12 - ema_26
            macd_signal = macd_line.ewm(span=9).mean().iloc[-1]
            macd = macd_line.iloc[-1]
            
            # Bollinger Bands
            bb_period = 20
            bb_std = 2
            sma = df['Close'].rolling(bb_period).mean()
            std = df['Close'].rolling(bb_period).std()
            bollinger_upper = (sma + (std * bb_std)).iloc[-1]
            bollinger_lower = (sma - (std * bb_std)).iloc[-1]
            
            # ATR (Average True Range)
            atr = self._calculate_atr(df, 14)
            
            return TechnicalIndicators(
                rsi=float(rsi),
                sma_20=float(sma_20),
                ema_12=float(ema_12),
                ema_26=float(ema_26),
                macd=float(macd),
                macd_signal=float(macd_signal),
                bollinger_upper=float(bollinger_upper),
                bollinger_lower=float(bollinger_lower),
                atr=float(atr)
            )
            
        except Exception as e:
            logger.error(f"Error calculating technical indicators: {e}")
            # Возвращаем дефолтные значения при ошибке
            return TechnicalIndicators(
                rsi=50.0, sma_20=0.0, ema_12=0.0, ema_26=0.0,
                macd=0.0, macd_signal=0.0, bollinger_upper=0.0,
                bollinger_lower=0.0, atr=0.0
            )
    
    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        """Расчет RSI"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return float(rsi.iloc[-1])
    
    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> float:
        """Расчет Average True Range"""
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr = true_range.rolling(window=period).mean()
        
        return float(atr.iloc[-1])
    
    def _get_market_state(self) -> str:
        """Определение состояния рынка (до открытия, торги, после закрытия)"""
        now = datetime.now(timezone.utc)
        
        # Время работы NYSE (14:30 - 21:00 UTC)
        market_open = now.replace(hour=14, minute=30, second=0, microsecond=0)
        market_close = now.replace(hour=21, minute=0, second=0, microsecond=0)
        
        if market_open <= now <= market_close:
            return "market_hours"
        elif now < market_open:
            return "pre_market"
        else:
            return "after_market"
    
    async def _cache_data(self, data: Dict[str, MarketSnapshot]):
        """Кэширование данных в Redis"""
        try:
            # Преобразование в JSON-сериализуемый формат
            cache_data = {}
            for symbol, snapshot in data.items():
                cache_data[symbol] = asdict(snapshot)
            
            await self.redis_client.setex(
                "market_data",
                self.cache_duration,
                json.dumps(cache_data, default=str)
            )
            
            # Отдельное кэширование для каждого символа
            for symbol, snapshot in data.items():
                await self.redis_client.setex(
                    f"market_data:{symbol}",
                    self.cache_duration,
                    json.dumps(asdict(snapshot), default=str)
                )
                
        except Exception as e:
            logger.error(f"Error caching data: {e}")
    
    async def get_cached_data(self) -> Optional[Dict[str, MarketSnapshot]]:
        """Получение кэшированных данных"""
        try:
            cached = await self.redis_client.get("market_data")
            if cached:
                data = json.loads(cached)
                # Преобразование обратно в MarketSnapshot объекты
                result = {}
                for symbol, snapshot_data in data.items():
                    # Восстановление вложенных объектов
                    ohlcv_5m = [OHLCVData(**ohlcv) for ohlcv in snapshot_data['ohlcv_5m']]
                    ohlcv_15m = [OHLCVData(**ohlcv) for ohlcv in snapshot_data['ohlcv_15m']]
                    technical_indicators = TechnicalIndicators(**snapshot_data['technical_indicators'])
                    
                    snapshot_data['ohlcv_5m'] = ohlcv_5m
                    snapshot_data['ohlcv_15m'] = ohlcv_15m
                    snapshot_data['technical_indicators'] = technical_indicators
                    
                    result[symbol] = MarketSnapshot(**snapshot_data)
                
                return result
                
        except Exception as e:
            logger.error(f"Error getting cached data: {e}")
        
        return None
    
    async def get_symbol_data(self, symbol: str) -> Optional[MarketSnapshot]:
        """Получение данных для конкретного символа"""
        try:
            cached = await self.redis_client.get(f"market_data:{symbol}")
            if cached:
                data = json.loads(cached)
                
                # Восстановление объектов
                ohlcv_5m = [OHLCVData(**ohlcv) for ohlcv in data['ohlcv_5m']]
                ohlcv_15m = [OHLCVData(**ohlcv) for ohlcv in data['ohlcv_15m']]
                technical_indicators = TechnicalIndicators(**data['technical_indicators'])
                
                data['ohlcv_5m'] = ohlcv_5m
                data['ohlcv_15m'] = ohlcv_15m
                data['technical_indicators'] = technical_indicators
                
                return MarketSnapshot(**data)
                
        except Exception as e:
            logger.error(f"Error getting cached data for {symbol}: {e}")
        
        return None
    
    async def get_historical_data(self, symbol: str, period: str = "1mo", interval: str = "5m") -> Optional[pd.DataFrame]:
        """Получение исторических данных"""
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period, interval=interval)
            
            if not hist.empty:
                return hist
                
        except Exception as e:
            logger.error(f"Error getting historical data for {symbol}: {e}")
        
        return None
    
    async def health_check(self) -> Dict[str, Any]:
        """Проверка работоспособности сервиса"""
        health_status = {
            "service": "market_data_collector",
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {}
        }
        
        # Проверка Redis
        try:
            await self.redis_client.ping()
            health_status["checks"]["redis"] = "healthy"
        except Exception as e:
            health_status["checks"]["redis"] = f"unhealthy: {e}"
            health_status["status"] = "degraded"
        
        # Проверка Yahoo Finance API
        try:
            test_ticker = yf.Ticker("SPY")
            test_data = test_ticker.history(period="1d", interval="5m")
            if not test_data.empty:
                health_status["checks"]["yahoo_finance"] = "healthy"
            else:
                health_status["checks"]["yahoo_finance"] = "no_data"
                health_status["status"] = "degraded"
        except Exception as e:
            health_status["checks"]["yahoo_finance"] = f"unhealthy: {e}"
            health_status["status"] = "degraded"
        
        return health_status