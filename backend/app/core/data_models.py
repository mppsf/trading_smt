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
class Signal:
    timestamp: str
    type: str
    strength: float
    details: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.details is None:
            self.details = {}

@dataclass
class MarketData:
    symbol: str
    current_price: float
    change_percent: float
    volume: int
    timestamp: str
    ohlcv_5m: List[OHLCV]
    ohlcv_15m: List[OHLCV]
    market_state: str

@dataclass
class TechnicalLevel:
    price: float
    level_type: str  # support, resistance, pivot
    strength: float
    timestamp: str
    touches: int = 0

@dataclass
class VolumeProfile:
    price_level: float
    volume: int
    percentage: float

@dataclass
class OrderFlow:
    timestamp: str
    bid_volume: int
    ask_volume: int
    delta: int
    cumulative_delta: int

@dataclass
class SmartMoneySignal(Signal):
    es_price: float = 0.0
    nq_price: float = 0.0
    divergence_pct: float = 0.0
    confirmed: bool = False
    killzone: Optional[str] = None

@dataclass
class VolumeSignal(Signal):
    volume_ratio: float = 0.0
    average_volume: float = 0.0
    current_volume: float = 0.0
    volume_spike: bool = False