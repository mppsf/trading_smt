from fastapi import APIRouter, HTTPException
from pydantic import ValidationError
import logging

from app.core.settings_manager import SettingsManager
from app.schemas.settings import SettingsResponse, SettingsUpdateRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["settings"])

@router.get("/settings", response_model=SettingsResponse)
async def get_settings():
    """Получить текущие настройки системы"""
    try:
        settings_manager = SettingsManager()
        current_settings = settings_manager.to_dict()
        
        default_settings = {
            "smt_strength_threshold": 0.7,
            "killzone_priorities": [1, 2, 3],
            "refresh_interval": 30000,
            "max_signals_display": 10,
            "divergence_threshold": 0.5,
            "confirmation_candles": 3,
            "volume_multiplier": 1.5,
            "london_open": "08:00",
            "ny_open": "13:30",
            "asia_open": "00:00"
        }
        
        merged_settings = {**default_settings, **current_settings}
        logger.info(f"Returning settings: {merged_settings}")
        return SettingsResponse(**merged_settings)
        
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        return SettingsResponse(
            smt_strength_threshold=0.7,
            killzone_priorities=[1, 2, 3],
            refresh_interval=30000,
            max_signals_display=10
        )

@router.put("/settings", response_model=SettingsResponse)
async def update_settings(payload: SettingsUpdateRequest):
    """Обновить настройки системы с валидацией"""
    try:
        logger.info(f"Received settings update request: {payload.model_dump(exclude_none=True)}")
        
        update_data = payload.model_dump(exclude_none=True)
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid settings provided")
        
        settings_manager = SettingsManager()
        settings_manager.update(**update_data)
        
        updated_settings = settings_manager.to_dict()
        logger.info(f"Settings updated successfully: {updated_settings}")
        
        return await get_settings()
        
    except ValidationError as e:
        logger.error(f"Validation error updating settings: {e}")
        raise HTTPException(status_code=422, detail=f"Validation error: {str(e)}")
    except ValueError as e:
        logger.error(f"Value error updating settings: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")