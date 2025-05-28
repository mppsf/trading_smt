from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime

@dataclass
class OHLCV:
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: int

@dataclass
class TechnicalData:
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
    timestamp: str
    type: str
    strength: float
    es_price: float
    nq_price: float
    divergence_pct: float = 0.0
    confirmed: bool = False
    details: Dict[str, Any] = None
