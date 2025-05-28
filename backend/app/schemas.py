from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class HealthResponse(BaseModel):
    redis: str

class MarketDataResponse(BaseModel):
    symbol: str
    price: float
    volume: Optional[float]
    timestamp: str

class SMTSignal(BaseModel):
    signal_type: str
    confidence: float
    details: Dict[str, Any]

class SMTAnalysisResponse(BaseModel):
    symbol: str
    signals: List[SMTSignal]
    timestamp: str