from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timezone
import logging

from backend.app.schemas.schemas import (
    SMTAnalysisResponse, SMTSignalResponse, AnalysisStatsResponse,
    TrueOpensResponse, TrueOpenResponse, FractalsResponse, FractalPoint
)
from app.services.market_data_collector import MarketDataCollector
from backend.app.services.smart_money_service import SmartMoneyAnalyzer
from app.utils import get_current_market_phase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["smt-analysis"])

@router.get("/smt-signals", response_model=SMTAnalysisResponse)
async def get_smt_signals(
    limit: int = Query(50, description="Максимальное количество сигналов"),
    signal_type: Optional[str] = Query(None, description="Фильтр по типу сигнала"),
    min_strength: Optional[float] = Query(None, ge=0.0, le=1.0, description="Минимальная сила сигнала"),
    confirmed_only: bool = Query(False, description="Только подтвержденные сигналы")
):
    """Получить Smart Money торговые сигналы"""
    try:
        smt_analyzer = SmartMoneyAnalyzer()
        signals = await smt_analyzer.get_cached_signals(limit)
        
        # Применение фильтров
        filtered_signals = signals
        
        if signal_type:
            filtered_signals = [s for s in filtered_signals if s.signal_type == signal_type]
        
        if min_strength is not None:
            filtered_signals = [s for s in filtered_signals if s.strength >= min_strength]
        
        if confirmed_only:
            filtered_signals = [s for s in filtered_signals if s.confirmation_status]
        
        # Преобразование в API формат
        result_signals = []
        for signal in filtered_signals:
            # Маппинг для обратной совместимости
            frontend_signal_type = signal.signal_type
            if 'bullish' in signal.signal_type:
                frontend_signal_type = 'bullish_divergence'
            elif 'bearish' in signal.signal_type:
                frontend_signal_type = 'bearish_divergence'
            elif 'false_break' in signal.signal_type:
                frontend_signal_type = 'false_break'
            elif 'volume' in signal.signal_type:
                frontend_signal_type = 'volume_anomaly'
            elif 'judas' in signal.signal_type:
                frontend_signal_type = 'judas_swing'
            
            result_signals.append(SMTSignalResponse(
                timestamp=signal.timestamp,
                signal_type=frontend_signal_type,
                strength=signal.strength,
                nasdaq_price=signal.nq_price,
                sp500_price=signal.es_price,
                divergence_percentage=signal.divergence_percentage,
                confirmation_status=signal.confirmation_status,
                details=signal.details
            ))
        
        return SMTAnalysisResponse(
            signals=result_signals,
            total_count=len(result_signals),
            analysis_timestamp=datetime.now(timezone.utc).isoformat(),
            market_phase=await get_current_market_phase()
        )
        
    except Exception as e:
        logger.error(f"Error getting SMT signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/smt-stats", response_model=AnalysisStatsResponse)
async def get_smt_stats():
    """Получить статистику Smart Money анализа"""
    try:
        smt_analyzer = SmartMoneyAnalyzer()
        signals = await smt_analyzer.get_cached_signals(1000)  # Большая выборка для статистики
        
        confirmed_signals = [s for s in signals if s.confirmation_status]
        
        signal_distribution = {}
        total_strength = 0
        
        for signal in signals:
            signal_type = signal.signal_type
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

@router.get("/true-opens", response_model=TrueOpensResponse)
async def get_true_opens():
    """Получить True Opens для ES и NQ"""
    try:
        market_collector = MarketDataCollector()
        smt_analyzer = SmartMoneyAnalyzer()
        
        # Получаем рыночные данные
        market_data = {}
        for symbol in ['ES=F', 'NQ=F']:
            cached_data = await market_collector.get_symbol_data(symbol)
            if cached_data:
                market_data[symbol] = cached_data
        
        if not market_data.get('ES=F') or not market_data.get('NQ=F'):
            raise HTTPException(status_code=404, detail="Market data not available")
        
        # Вычисляем True Opens
        es_opens = smt_analyzer.true_open_calc.get_true_opens(market_data['ES=F'].ohlcv_1d)
        nq_opens = smt_analyzer.true_open_calc.get_true_opens(market_data['NQ=F'].ohlcv_1d)
        
        timestamp = datetime.now(timezone.utc).isoformat()
        
        return TrueOpensResponse(
            es_opens=TrueOpenResponse(
                daily=es_opens.get('daily'),
                weekly=es_opens.get('weekly'),
                quarterly=es_opens.get('quarterly'),
                timestamp=timestamp
            ),
            nq_opens=TrueOpenResponse(
                daily=nq_opens.get('daily'),
                weekly=nq_opens.get('weekly'),
                quarterly=nq_opens.get('quarterly'),
                timestamp=timestamp
            )
        )
        
    except Exception as e:
        logger.error(f"Error getting True Opens: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/fractals", response_model=List[FractalsResponse])
async def get_fractals(
    symbols: str = Query("ES=F,NQ=F", description="Символы через запятую"),
    period: int = Query(15, description="Период для детекции фракталов")
):
    """Получить фрактальные уровни"""
    try:
        market_collector = MarketDataCollector()
        smt_analyzer = SmartMoneyAnalyzer()
        
        symbol_list = [s.strip() for s in symbols.split(",")]
        result = []
        
        for symbol in symbol_list:
            cached_data = await market_collector.get_symbol_data(symbol)
            if not cached_data:
                continue
            
            high_fractals, low_fractals = smt_analyzer.smt_detector.detect_fractals(
                cached_data.ohlcv_15m, period
            )
            
            result.append(FractalsResponse(
                symbol=symbol,
                high_fractals=[
                    FractalPoint(
                        timestamp=f.timestamp,
                        price=f.price,
                        type=f.type,
                        index=f.index
                    ) for f in high_fractals
                ],
                low_fractals=[
                    FractalPoint(
                        timestamp=f.timestamp,
                        price=f.price,
                        type=f.type,
                        index=f.index
                    ) for f in low_fractals
                ],
                timestamp=datetime.now(timezone.utc).isoformat()
            ))
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting fractals: {e}")
        raise HTTPException(status_code=500, detail=str(e))