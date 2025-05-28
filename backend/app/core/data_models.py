from dataclasses import dataclass
from typing import List, Dict, Any, Optional

@dataclass
class OHLCV:
    __slots__ = ('timestamp', 'open', 'high', 'low', 'close', 'volume')
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int

@dataclass
class TechnicalData:
    __slots__ = ('rsi', 'sma_20', 'ema_12', 'ema_26', 'macd', 'macd_signal', 'bollinger_upper', 'bollinger_lower', 'atr')
    rsi: float = 50.0
    sma_20: float = 0.0
    ema_12: float = 0.0
    ema_26: float = 0.0
    macd: float = 0.0
    macd_signal: float = 0.0
    bollinger_upper: float = 0.0
    bollinger_lower: float = 0.0
    atr: float = 0.0

@dataclass
class MarketData:
    __slots__ = ('symbol', 'price', 'change_pct', 'volume', 'timestamp', 'ohlcv_5m', 'ohlcv_15m', 'technical', 'market_state')
    symbol: str
    price: float
    change_pct: float
    volume: int
    timestamp: str
    ohlcv_5m: List[OHLCV]
    ohlcv_15m: List[OHLCV]
    technical: TechnicalData
    market_state: str

@dataclass
class Signal:
    __slots__ = ('timestamp', 'type', 'strength', 'es_price', 'nq_price', 'divergence_pct', 'confirmed', 'details')
    timestamp: str
    type: str
    strength: float
    es_price: float
    nq_price: float
    divergence_pct: float = 0.0
    confirmed: bool = False
    details: Optional[Dict[str, Any]] = None