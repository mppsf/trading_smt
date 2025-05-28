from fastapi import APIRouter
from datetime import datetime, timezone
import logging

from backend.app.schemas.schemas import HealthResponse
from app.services.market_data_collector import MarketDataCollector

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])

@router.get("/health", response_model=HealthResponse)
async def health():
    """Проверка состояния системы"""
    try:
        market_collector = MarketDataCollector()
        health = await market_collector.health_check()
        redis_status = health.get("checks", {}).get("redis", health.get("status", "unknown"))
        return HealthResponse(
            status=health.get("status", "unknown"),
            redis=redis_status,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            redis="unknown",
            timestamp=datetime.now(timezone.utc).isoformat()
        )