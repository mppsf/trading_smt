from fastapi import APIRouter, HTTPException
import logging

from app.schemas.schemas import KillzonesResponse
from app.services.killzone_service import KillzoneService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["killzones"])

@router.get("/killzones", response_model=KillzonesResponse)
async def get_killzones():
    """Получить торговые сессии (Killzones)"""
    try:
        killzone_service = KillzoneService()
        zones = await killzone_service.get_killzones()
        return KillzonesResponse(killzones=zones)
    except Exception as e:
        logger.error(f"Error fetching killzones: {e}")
        raise HTTPException(status_code=500, detail="Unable to retrieve killzones")