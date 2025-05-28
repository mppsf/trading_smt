from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

class HealthResponse(BaseModel):
    status: str
    redis: str
    timestamp: str

class MarketDataResponse(BaseModel):
    symbol: str
    price: float
    volume: Optional[float]
    timestamp: str

# Перечисление типов Smart Money сигналов
class SMTSignalType(str, Enum):
    # SMT Divergence
    SMT_BULLISH_DIVERGENCE = "smt_bullish_divergence"
    SMT_BEARISH_DIVERGENCE = "smt_bearish_divergence"
    
    # False Breaks / Stop Hunts
    FALSE_BREAK_UP = "false_break_up"
    FALSE_BREAK_DOWN = "false_break_down"
    
    # Volume Anomalies
    VOLUME_SPIKE = "volume_spike"
    VOLUME_DIVERGENCE_BULLISH = "volume_divergence_bullish"
    VOLUME_DIVERGENCE_BEARISH = "volume_divergence_bearish"
    
    # Judas Swings
    JUDAS_SWING_BULLISH = "judas_swing_bullish"
    JUDAS_SWING_BEARISH = "judas_swing_bearish"

class SMTSignalResponse(BaseModel):
    timestamp: str
    signal_type: str = Field(..., description="Тип Smart Money сигнала")
    strength: float = Field(..., ge=0.0, le=1.0, description="Сила сигнала от 0 до 1")
    nasdaq_price: float = Field(..., description="Цена NASDAQ (NQ)")
    sp500_price: float = Field(..., description="Цена S&P 500 (ES)")
    divergence_percentage: float = Field(..., description="Процент дивергенции")
    confirmation_status: bool = Field(..., description="Статус подтверждения сигнала")
    details: Dict[str, Any] = Field(..., description="Детальная информация о сигнале")

class SMTAnalysisResponse(BaseModel):
    signals: List[SMTSignalResponse]
    total_count: int
    analysis_timestamp: str
    market_phase: Optional[str] = None

class TrueOpenResponse(BaseModel):
    daily: Optional[float] = None
    weekly: Optional[float] = None
    quarterly: Optional[float] = None
    timestamp: str

class TrueOpensResponse(BaseModel):
    es_opens: TrueOpenResponse
    nq_opens: TrueOpenResponse

class FractalPoint(BaseModel):
    timestamp: str
    price: float
    type: str  # 'high' or 'low'
    index: int

class FractalsResponse(BaseModel):
    symbol: str
    high_fractals: List[FractalPoint]
    low_fractals: List[FractalPoint]
    timestamp: str

class VolumeAnomalyResponse(BaseModel):
    timestamp: str
    volume: float
    avg_volume: float
    volume_ratio: float
    anomaly_type: str
    significance: float

class KillzoneInfo(BaseModel):
    name: str
    start_time: str
    end_time: str
    description: Optional[str] = None
    is_active: Optional[bool] = False
    timezone: Optional[str] = "UTC"

class KillzonesResponse(BaseModel):
    killzones: List[KillzoneInfo]

# Схемы для фильтрации и настроек
class SMTAnalysisFilter(BaseModel):
    signal_types: Optional[List[SMTSignalType]] = None
    min_strength: Optional[float] = Field(None, ge=0.0, le=1.0)
    confirmed_only: Optional[bool] = False
    time_from: Optional[datetime] = None
    time_to: Optional[datetime] = None

class AnalysisStatsResponse(BaseModel):
    total_signals: int
    confirmed_signals: int
    signal_distribution: Dict[str, int]
    avg_strength: float
    last_analysis: str