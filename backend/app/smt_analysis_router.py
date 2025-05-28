from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import logging

from app.schemas.schemas import (
    SMTAnalysisResponse, SMTSignalResponse, AnalysisStatsResponse,
    TrueOpensResponse, TrueOpenResponse, FractalsResponse, FractalPoint
)
from app.services.market_data_collector import MarketDataCollector
from app.services.smart_money_service import SmartMoneyService
from app.services.killzone_service import KillzoneService
from app.core.data_models import OHLCV
from app.utils.market_utils import get_current_market_phase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["smt-analysis"])

def convert_snapshot_to_ohlcv(snapshot_data):
    """Конвертация данных из MarketSnapshot в список OHLCV"""
    if hasattr(snapshot_data, 'ohlcv_15m'):
        return [OHLCV(
            timestamp=item.timestamp,
            open=item.open,
            high=item.high,
            low=item.low,
            close=item.close,
            volume=item.volume
        ) for item in snapshot_data.ohlcv_15m]
    return []

def get_killzone_priority(killzone_name: str) -> int:
    """Получить приоритет киллзоны по имени"""
    priority_map = {
        "Asia Open": 1,
        "London Open": 2, 
        "London Close": 3,
        "New York Open": 4,
        "New York Close": 5
    }
    return priority_map.get(killzone_name, 6)

def is_signal_in_time_window(signal_timestamp: str, time_window_minutes: int) -> bool:
    """Проверить, попадает ли сигнал в временное окно"""
    if time_window_minutes <= 0:
        return True
    
    try:
        signal_time = datetime.fromisoformat(signal_timestamp.replace('Z', '+00:00'))
        current_time = datetime.now(timezone.utc)
        time_diff = current_time - signal_time
        return time_diff <= timedelta(minutes=time_window_minutes)
    except:
        return True

@router.get("/smt-signals", response_model=SMTAnalysisResponse)
async def get_smt_signals(
    limit: int = Query(50, description="Максимальное количество сигналов"),
    signal_type: Optional[str] = Query(None, description="Фильтр по типу сигнала"),
    min_strength: Optional[float] = Query(None, ge=0.0, le=1.0, description="Минимальная сила сигнала"),
    confirmed_only: bool = Query(False, description="Только подтвержденные сигналы"),
    min_killzone_priority: Optional[int] = Query(None, ge=1, le=5, description="Минимальный приоритет киллзоны"),
    time_window_minutes: Optional[int] = Query(None, ge=0, description="Временное окно в минутах (0 = без ограничений)"),
    # Settings parameters
    smt_strength_threshold: Optional[float] = Query(None, ge=0.0, le=1.0, description="Порог силы SMT сигналов"),
    divergence_threshold: Optional[float] = Query(None, ge=0.0, le=5.0, description="Порог дивергенции %"),
    confirmation_candles: Optional[int] = Query(None, ge=1, le=10, description="Количество свечей для подтверждения"),
    volume_multiplier: Optional[float] = Query(None, ge=1.0, le=5.0, description="Множитель объема"),
    max_signals_display: Optional[int] = Query(None, ge=1, le=100, description="Максимум сигналов для отображения"),
    refresh_interval: Optional[int] = Query(None, ge=5000, le=300000, description="Интервал обновления мс"),
    london_open: Optional[str] = Query(None, description="Время открытия Лондона HH:MM"),
    ny_open: Optional[str] = Query(None, description="Время открытия Нью-Йорка HH:MM"),
    asia_open: Optional[str] = Query(None, description="Время открытия Азии HH:MM"),
    killzone_priorities: Optional[str] = Query(None, description="Приоритеты киллзон через запятую")
):
    try:
        # Подготовка параметров для анализа
        analysis_params = {}
        
        # Собираем только переданные параметры
        if smt_strength_threshold is not None:
            analysis_params['smt_strength_threshold'] = smt_strength_threshold
        if divergence_threshold is not None:
            analysis_params['divergence_threshold'] = divergence_threshold
        if confirmation_candles is not None:
            analysis_params['confirmation_candles'] = confirmation_candles
        if volume_multiplier is not None:
            analysis_params['volume_multiplier'] = volume_multiplier
        if max_signals_display is not None:
            analysis_params['max_signals_display'] = max_signals_display
        if refresh_interval is not None:
            analysis_params['refresh_interval'] = refresh_interval
        if london_open is not None:
            analysis_params['london_open'] = london_open
        if ny_open is not None:
            analysis_params['ny_open'] = ny_open
        if asia_open is not None:
            analysis_params['asia_open'] = asia_open
        if killzone_priorities is not None:
            try:
                priorities = [int(p.strip()) for p in killzone_priorities.split(',')]
                analysis_params['killzone_priorities'] = priorities
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid killzone_priorities format")

        # Получаем свежие рыночные данные
        market_collector = MarketDataCollector()
        es_data = await market_collector.get_symbol_data('ES=F')
        nq_data = await market_collector.get_symbol_data('NQ=F')
        
        if not es_data or not nq_data:
            raise HTTPException(status_code=404, detail="Market data not available")

        # Получаем информацию о киллзонах
        killzone_service = KillzoneService()
        killzones = await killzone_service.get_killzones()
        
        # Создаем сервис с кастомными параметрами
        smt_service = SmartMoneyService()
        
        # Если есть кастомные параметры, выполняем свежий анализ
        if analysis_params:
            # Временно обновляем настройки анализаторов
            original_smt_settings = smt_service.smt_analyzer.settings.copy()
            original_vol_settings = smt_service.volume_analyzer.settings.copy()
            
            # Применяем кастомные параметры
            smt_service.smt_analyzer.settings.update(analysis_params)
            smt_service.volume_analyzer.settings.update(analysis_params)
            
            # Выполняем свежий анализ
            market_data = {'ES=F': es_data, 'NQ=F': nq_data}
            signals = await smt_service.analyze(market_data)
            
            # Восстанавливаем оригинальные настройки
            smt_service.smt_analyzer.settings = original_smt_settings
            smt_service.volume_analyzer.settings = original_vol_settings
        else:
            # Используем кешированные сигналы
            signals = await smt_service.get_cached_signals(limit)

        # Применяем фильтры
        filtered_signals = signals
        
        if signal_type:
            filtered_signals = [s for s in filtered_signals if s.type == signal_type]
        
        if min_strength is not None:
            filtered_signals = [s for s in filtered_signals if s.strength >= min_strength]
        
        if confirmed_only:
            filtered_signals = [s for s in filtered_signals if getattr(s, 'confirmed', False)]
            
        # Фильтр по временному окну
        if time_window_minutes is not None and time_window_minutes > 0:
            filtered_signals = [s for s in filtered_signals 
                              if is_signal_in_time_window(s.timestamp, time_window_minutes)]
        
        # Фильтр по приоритету киллзоны
        if min_killzone_priority is not None:
            # Предполагаем, что в сигнале есть информация о киллзоне
            # Если нет, то определяем по времени сигнала
            current_time = datetime.now(timezone.utc).time()
            current_killzone = None
            
            for kz in killzones:
                start_time = datetime.strptime(kz.start_time, "%H:%M:%S").time()
                end_time = datetime.strptime(kz.end_time, "%H:%M:%S").time()
                
                if start_time <= current_time <= end_time:
                    current_killzone = kz.name
                    break
            
            if current_killzone:
                current_priority = get_killzone_priority(current_killzone)
                if current_priority >= min_killzone_priority:
                    # Фильтруем сигналы только если текущая киллзона имеет достаточный приоритет
                    pass
                else:
                    # Если текущая киллзона не проходит фильтр, возвращаем пустой результат
                    filtered_signals = []

        # Ограничиваем количество результатов
        final_limit = min(limit, analysis_params.get('max_signals_display', limit))
        filtered_signals = filtered_signals[:final_limit]
        
        # Преобразуем в формат ответа
        result_signals = []
        for signal in filtered_signals:
            frontend_signal_type = signal.type
            if 'bullish' in signal.type:
                frontend_signal_type = 'bullish_divergence'
            elif 'bearish' in signal.type:
                frontend_signal_type = 'bearish_divergence'
            elif 'volume' in signal.type:
                frontend_signal_type = 'volume_anomaly'
            
            result_signals.append(SMTSignalResponse(
                timestamp=signal.timestamp,
                signal_type=frontend_signal_type,
                strength=signal.strength,
                nasdaq_price=getattr(signal, 'nq_price', 0.0),
                sp500_price=getattr(signal, 'es_price', 0.0),
                divergence_percentage=getattr(signal, 'divergence_pct', 0.0),
                confirmation_status=getattr(signal, 'confirmed', False),
                details=getattr(signal, 'details', {})
            ))
        
        market_phase = await get_current_market_phase()
        
        return SMTAnalysisResponse(
            signals=result_signals,
            total_count=len(result_signals),
            analysis_timestamp=datetime.now(timezone.utc).isoformat(),
            market_phase=market_phase
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting SMT signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/smt-stats", response_model=AnalysisStatsResponse)
async def get_smt_stats():
    try:
        smt_service = SmartMoneyService()
        signals = await smt_service.get_cached_signals(1000)
        
        confirmed_signals = [s for s in signals if getattr(s, 'confirmed', False)]
        
        signal_distribution = {}
        total_strength = 0
        
        for signal in signals:
            signal_type = signal.type
            signal_distribution[signal_type] = signal_distribution.get(signal_type, 0) + 1
            total_strength += signal.strength
        
        avg_strength = total_strength / len(signals) if signals else 0
        
        return AnalysisStatsResponse(
            total_signals=len(signals),
            confirmed_signals=len(confirmed_signals),
            signal_distribution=signal_distribution,
            avg_strength=avg_strength,
            last_analysis=signals[0].timestamp if signals else datetime.now(timezone.utc).isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error getting SMT stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
