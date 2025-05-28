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
    time_window_minutes: Optional[int] = Query(None, ge=0, description="Временное окно в минутах (0 = без ограничений)")
):
    try:
        # DEBUG: Получаем данные и проверяем их наличие
        market_collector = MarketDataCollector()
        
        # Проверяем health статус коллектора
        health_status = await market_collector.health_check()
        logger.info(f"Market collector health: {health_status}")
        
        # Пробуем получить cached данные
        cached_data = await market_collector.get_cached_data()
        logger.info(f"Cached data available: {cached_data is not None}")
        if cached_data:
            logger.info(f"Cached symbols: {list(cached_data.keys())}")
        
        # Получаем данные по символам
        es_data = await market_collector.get_symbol_data('ES=F')
        nq_data = await market_collector.get_symbol_data('NQ=F')
        
        logger.info(f"ES data available: {es_data is not None}")
        logger.info(f"NQ data available: {nq_data is not None}")
        
        if es_data:
            logger.info(f"ES current price: {es_data.current_price}, timestamp: {es_data.timestamp}")
            logger.info(f"ES OHLCV 15m length: {len(es_data.ohlcv_15m) if es_data.ohlcv_15m else 0}")
        
        if nq_data:
            logger.info(f"NQ current price: {nq_data.current_price}, timestamp: {nq_data.timestamp}")
            logger.info(f"NQ OHLCV 15m length: {len(nq_data.ohlcv_15m) if nq_data.ohlcv_15m else 0}")
        
        # Если нет cached данных, пробуем собрать свежие
        if not es_data or not nq_data:
            logger.warning("No cached data, attempting fresh collection...")
            fresh_data = await market_collector.collect_realtime_data()
            logger.info(f"Fresh data collected for symbols: {list(fresh_data.keys())}")
            
            es_data = fresh_data.get('ES=F')
            nq_data = fresh_data.get('NQ=F')
            
            if es_data:
                logger.info(f"Fresh ES data: price={es_data.current_price}")
            if nq_data:
                logger.info(f"Fresh NQ data: price={nq_data.current_price}")
        
        if not es_data or not nq_data:
            # Последняя попытка - прямое обращение к Yahoo Finance
            logger.warning("Attempting direct Yahoo Finance fallback...")
            try:
                import yfinance as yf
                es_ticker = yf.Ticker('ES=F')
                nq_ticker = yf.Ticker('NQ=F')
                
                es_hist = es_ticker.history(period="1d", interval="15m")
                nq_hist = nq_ticker.history(period="1d", interval="15m")
                
                logger.info(f"Direct YF - ES data length: {len(es_hist) if not es_hist.empty else 0}")
                logger.info(f"Direct YF - NQ data length: {len(nq_hist) if not nq_hist.empty else 0}")
                
                if not es_hist.empty and not nq_hist.empty:
                    logger.info("Using direct Yahoo Finance data as fallback")
                    # Создаем минимальные mock объекты для анализа
                    from app.services.market_data_collector import MarketSnapshot, OHLCVData, TechnicalIndicators
                    
                    # Простой fallback без full snapshot
                    return SMTAnalysisResponse(
                        signals=[],
                        total_count=0,
                        analysis_timestamp=datetime.now(timezone.utc).isoformat(),
                        market_phase="fallback_mode"
                    )
                    
            except Exception as yf_error:
                logger.error(f"Yahoo Finance fallback failed: {yf_error}")
            
            raise HTTPException(
                status_code=404, 
                detail=f"Market data not available. Health: {health_status}"
            )

        # Если данные есть, продолжаем с анализом
        killzone_service = KillzoneService()
        killzones = await killzone_service.get_killzones()
        
        smt_service = SmartMoneyService()
        market_data = {'ES=F': es_data, 'NQ=F': nq_data}
        signals = await smt_service.analyze(market_data)
        
        logger.info(f"Generated {len(signals)} signals")
        
        # Применяем фильтры
        filtered_signals = signals
        
        if signal_type:
            filtered_signals = [s for s in filtered_signals if s.type == signal_type]
        
        if min_strength is not None:
            filtered_signals = [s for s in filtered_signals if s.strength >= min_strength]
        
        if confirmed_only:
            filtered_signals = [s for s in filtered_signals if getattr(s, 'confirmed', False)]
            
        if time_window_minutes is not None and time_window_minutes > 0:
            filtered_signals = [s for s in filtered_signals 
                              if is_signal_in_time_window(s.timestamp, time_window_minutes)]
        
        filtered_signals = filtered_signals[:limit]
        
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
        logger.error(f"Error getting SMT signals: {e}", exc_info=True)
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
