from pydantic import BaseModel, Field, ValidationError
from typing import Optional, List
from datetime import datetime

class SettingsResponse(BaseModel):
    """Ответ с настройками системы"""
    smt_strength_threshold: float = Field(ge=0.0, le=1.0)
    killzone_priorities: List[int]
    refresh_interval: int = Field(ge=1000)
    max_signals_display: int = Field(ge=1, le=100)
    divergence_threshold: float = Field(default=0.5, ge=0.1, le=2.0)
    confirmation_candles: int = Field(default=3, ge=1, le=10)
    volume_multiplier: float = Field(default=1.5, ge=1.0, le=5.0)
    london_open: str = Field(default="08:00")
    ny_open: str = Field(default="13:30")
    asia_open: str = Field(default="00:00")

class SettingsUpdateRequest(BaseModel):
    """Запрос на обновление настроек с валидацией"""
    smt_strength_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    killzone_priorities: Optional[List[int]] = None
    refresh_interval: Optional[int] = Field(None, ge=1000)
    max_signals_display: Optional[int] = Field(None, ge=1, le=100)
    divergence_threshold: Optional[float] = Field(None, ge=0.1, le=2.0)
    confirmation_candles: Optional[int] = Field(None, ge=1, le=10)
    volume_multiplier: Optional[float] = Field(None, ge=1.0, le=5.0)
    london_open: Optional[str] = None
    ny_open: Optional[str] = None
    asia_open: Optional[str] = None

    def model_post_init(self, __context):
        """Дополнительная валидация после создания модели"""
        if self.killzone_priorities is not None:
            if not all(isinstance(p, int) and 1 <= p <= 5 for p in self.killzone_priorities):
                raise ValueError('killzone_priorities должны быть числами от 1 до 5')
        
        for time_field in ['london_open', 'ny_open', 'asia_open']:
            time_value = getattr(self, time_field)
            if time_value is not None:
                try:
                    datetime.strptime(time_value, '%H:%M')
                except ValueError:
                    raise ValueError(f'{time_field} должно быть в формате HH:MM')