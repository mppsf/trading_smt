import redis.asyncio as redis
import json
import logging
from typing import List, Dict
from datetime import datetime, timezone, time
from app.core.config import settings
from app.core.settings_manager import SettingsManager
from app.core.data_models import MarketData, Signal
from app.analyzers.smt_analyzer import SMTAnalyzer
from app.analyzers.volume_analyzer import VolumeAnalyzer

logger = logging.getLogger(__name__)

class SmartMoneyService:
    def __init__(self):
        self.redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.settings = SettingsManager()
        self.smt_analyzer = SMTAnalyzer()
        self.volume_analyzer = VolumeAnalyzer()

    async def analyze(self, market_data: Dict[str, MarketData]) -> List[Signal]:
        try:
            es_data = market_data.get('ES=F')
            nq_data = market_data.get('NQ=F')
            
            if not es_data or not nq_data:
                return []

            if not self._is_active_session():
                return []

            signals = []
            signals.extend(self.smt_analyzer.analyze(es_data.ohlcv_15m, nq_data.ohlcv_15m))
            signals.extend(self.volume_analyzer.analyze(es_data.ohlcv_15m))
            signals.extend(self.volume_analyzer.analyze(nq_data.ohlcv_15m))
            
            # Filter by strength
            threshold = self.settings.get('smt_strength_threshold', 0.7)
            filtered = [s for s in signals if s.strength >= threshold]
            
            # Limit results
            max_signals = self.settings.get('max_signals_display', 10)
            final = sorted(filtered, key=lambda x: x.strength, reverse=True)[:max_signals]
            
            await self._cache_signals(final)
            return final
            
        except Exception as e:
            logger.error(f"Analysis error: {e}")
            return []

    def _is_active_session(self) -> bool:
        try:
            now = datetime.now(timezone.utc).time()
            return (time(8, 0) <= now <= time(16, 0) or  # London
                   time(13, 30) <= now <= time(22, 0) or  # NY
                   time(0, 0) <= now <= time(9, 0))       # Asia
        except:
            return True

    async def _cache_signals(self, signals: List[Signal]):
        try:
            data = [s.__dict__ for s in signals]
            await self.redis.setex("smart_money_signals", 300, json.dumps(data, default=str))
        except Exception as e:
            logger.error(f"Cache error: {e}")

    async def get_cached_signals(self, limit: int = 50) -> List[Signal]:
        try:
            cached = await self.redis.get("smart_money_signals")
            if cached:
                data = json.loads(cached)
                signals = [Signal(**s) for s in data]
                threshold = self.settings.get('smt_strength_threshold', 0.7)
                return [s for s in signals if s.strength >= threshold][:limit]
        except Exception as e:
            logger.error(f"Cache retrieval error: {e}")
        return []

    