from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
import logging
import pandas as pd
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Union
import uvicorn
from pydantic import BaseModel, Field, ValidationError

from app.core.settings_manager import SettingsManager
from app.schemas import (
    HealthResponse, SMTAnalysisResponse, SMTSignalResponse, 
    KillzonesResponse, TrueOpensResponse, TrueOpenResponse,
    FractalsResponse, FractalPoint, VolumeAnomalyResponse,
    AnalysisStatsResponse, SMTAnalysisFilter, SMTSignalType
)
from app.services.market_data_collector import MarketDataCollector
from backend.app.services.smart_money_service import SmartMoneyAnalyzer
from app.core.config import settings
from app.core.websocket_manager import WebSocketManager
from app.tasks.background_tasks import start_background_tasks
from app.services.killzone import KillzoneService

# === СХЕМЫ ДЛЯ НАСТРОЕК ===
class SettingsResponse(BaseModel):
    """Ответ с настройками системы"""
    smt_strength_threshold: float = Field(ge=0.0, le=1.0)
    killzone_priorities: List[int]
    refresh_interval: int = Field(ge=1000)
    max_signals_display: int = Field(ge=1, le=100)
    # Дополнительные параметры
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
        # Валидация приоритетов killzone
        if self.killzone_priorities is not None:
            if not all(isinstance(p, int) and 1 <= p <= 5 for p in self.killzone_priorities):
                raise ValueError('killzone_priorities должны быть числами от 1 до 5')
        
        # Валидация времени
        for time_field in ['london_open', 'ny_open', 'asia_open']:
            time_value = getattr(self, time_field)
            if time_value is not None:
                try:
                    datetime.strptime(time_value, '%H:%M')
                except ValueError:
                    raise ValueError(f'{time_field} должно быть в формате HH:MM')

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Smart Money Trading Analyzer", 
    version="2.0.0",
    description="Advanced ICT Smart Money Concepts Analysis API"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализация сервисов
settings_manager = SettingsManager()
market_collector = MarketDataCollector()
smt_analyzer = SmartMoneyAnalyzer()
websocket_manager = WebSocketManager()
killzone_service = KillzoneService()

@app.on_event("startup")
async def on_startup():
    logger.info("Starting Smart Money Trading Analyzer...")
    await start_background_tasks(app, market_collector, smt_analyzer, websocket_manager)

@app.on_event("shutdown")
async def on_shutdown():
    logger.info("Shutting down...")
    await websocket_manager.disconnect_all()

@app.get("/health", response_model=HealthResponse)
async def health():
    """Проверка состояния системы"""
    try:
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

# === НАСТРОЙКИ ===
@app.get("/api/v1/settings", response_model=SettingsResponse)
async def get_settings():
    """Получить текущие настройки системы"""
    try:
        current_settings = settings_manager.to_dict()
        
        # Обеспечиваем наличие всех обязательных полей с дефолтными значениями
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
        
        # Объединяем с текущими настройками
        merged_settings = {**default_settings, **current_settings}
        
        logger.info(f"Returning settings: {merged_settings}")
        return SettingsResponse(**merged_settings)
        
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        # Возвращаем дефолтные настройки при ошибке
        return SettingsResponse(
            smt_strength_threshold=0.7,
            killzone_priorities=[1, 2, 3],
            refresh_interval=30000,
            max_signals_display=10
        )

@app.put("/api/v1/settings", response_model=SettingsResponse)
async def update_settings(payload: SettingsUpdateRequest):
    """Обновить настройки системы с валидацией"""
    try:
        logger.info(f"Received settings update request: {payload.model_dump(exclude_none=True)}")
        
        # Преобразуем Pydantic модель в словарь, исключая None значения
        update_data = payload.model_dump(exclude_none=True)
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No valid settings provided")
        
        # Обновляем настройки через settings_manager
        settings_manager.update(**update_data)
        
        # Получаем обновленные настройки
        updated_settings = settings_manager.to_dict()
        
        logger.info(f"Settings updated successfully: {updated_settings}")
        
        # Возвращаем полный набор настроек
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

# === РЫНОЧНЫЕ ДАННЫЕ ===
@app.get("/api/v1/market-data")
async def get_market_data(
    symbols: str = Query("ES=F,NQ=F", description="Символы через запятую"),
    timeframe: str = Query("5m", description="Таймфрейм: 5m, 15m, 1h, 1d"),
    limit: int = Query(100, description="Количество баров")
):
    """Получить рыночные данные для указанных символов"""
    try:
        symbol_list = [s.strip() for s in symbols.split(",")]
        result = []
        
        for symbol in symbol_list:
            try:
                cached_data = await market_collector.get_symbol_data(symbol)
                
                if cached_data:
                    # Выбор правильного таймфрейма
                    if timeframe == "5m":
                        source_data = cached_data.ohlcv_5m
                    elif timeframe == "15m":
                        source_data = cached_data.ohlcv_15m
                    elif timeframe == "1h":
                        source_data = cached_data.ohlcv_1h if hasattr(cached_data, 'ohlcv_1h') else cached_data.ohlcv_15m
                    elif timeframe == "1d":
                        source_data = cached_data.ohlcv_1d if hasattr(cached_data, 'ohlcv_1d') else cached_data.ohlcv_15m
                    else:
                        source_data = cached_data.ohlcv_5m
                    
                    ohlcv_data = []
                    if source_data:
                        limited_data = source_data[-limit:] if len(source_data) > limit else source_data
                        for item in limited_data:
                            ohlcv_data.append({
                                "timestamp": item.timestamp,
                                "Open": item.open,
                                "High": item.high,
                                "Low": item.low,
                                "Close": item.close,
                                "Volume": item.volume
                            })
                    
                    result.append({
                        "symbol": cached_data.symbol,
                        "current_price": cached_data.current_price,
                        "change_percent": cached_data.change_percent,
                        "volume": cached_data.volume,
                        "timestamp": cached_data.timestamp,
                        "ohlcv": ohlcv_data,
                        "market_state": cached_data.market_state
                    })
                else:
                    # Fallback к историческим данным
                    historical_data = await market_collector.get_historical_data(
                        symbol, period="2d", interval=timeframe
                    )
                    
                    if historical_data is not None and not historical_data.empty:
                        ohlcv_data = []
                        limited_data = historical_data.tail(limit)
                        
                        for idx, row in limited_data.iterrows():
                            ohlcv_data.append({
                                "timestamp": idx.isoformat(),
                                "Open": float(row['Open']),
                                "High": float(row['High']),
                                "Low": float(row['Low']),
                                "Close": float(row['Close']),
                                "Volume": int(row['Volume']) if not pd.isna(row['Volume']) else 0
                            })
                        
                        current_price = float(historical_data['Close'].iloc[-1])
                        prev_price = float(historical_data['Close'].iloc[-2]) if len(historical_data) > 1 else current_price
                        change_percent = ((current_price / prev_price) - 1) * 100 if prev_price != 0 else 0
                        
                        result.append({
                            "symbol": symbol,
                            "current_price": current_price,
                            "change_percent": change_percent,
                            "volume": int(historical_data['Volume'].iloc[-1]) if not pd.isna(historical_data['Volume'].iloc[-1]) else 0,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "ohlcv": ohlcv_data,
                            "market_state": "unknown"
                        })
                    else:
                        logger.warning(f"No data available for symbol: {symbol}")
                        
            except Exception as symbol_error:
                logger.error(f"Error processing symbol {symbol}: {symbol_error}")
                continue
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting market data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === SMART MONEY АНАЛИЗ ===
@app.get("/api/v1/smt-signals", response_model=SMTAnalysisResponse)
async def get_smt_signals(
    limit: int = Query(50, description="Максимальное количество сигналов"),
    signal_type: Optional[str] = Query(None, description="Фильтр по типу сигнала"),
    min_strength: Optional[float] = Query(None, ge=0.0, le=1.0, description="Минимальная сила сигнала"),
    confirmed_only: bool = Query(False, description="Только подтвержденные сигналы")
):
    """Получить Smart Money торговые сигналы"""
    try:
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
            market_phase=await _get_current_market_phase()
        )
        
    except Exception as e:
        logger.error(f"Error getting SMT signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/smt-stats", response_model=AnalysisStatsResponse)
async def get_smt_stats():
    """Получить статистику Smart Money анализа"""
    try:
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

# === TRUE OPENS ===
@app.get("/api/v1/true-opens", response_model=TrueOpensResponse)
async def get_true_opens():
    """Получить True Opens для ES и NQ"""
    try:
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

# === ФРАКТАЛЫ ===
@app.get("/api/v1/fractals", response_model=List[FractalsResponse])
async def get_fractals(
    symbols: str = Query("ES=F,NQ=F", description="Символы через запятую"),
    period: int = Query(15, description="Период для детекции фракталов")
):
    """Получить фрактальные уровни"""
    try:
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

# === KILLZONES ===
@app.get("/api/v1/killzones", response_model=KillzonesResponse)
async def get_killzones():
    """Получить торговые сессии (Killzones)"""
    try:
        zones = await killzone_service.get_killzones()
        return KillzonesResponse(killzones=zones)
    except Exception as e:
        logger.error(f"Error fetching killzones: {e}")
        raise HTTPException(status_code=500, detail="Unable to retrieve killzones")

# === WEBSOCKET ===
@app.websocket("/ws/market-updates")
async def ws_endpoint(websocket: WebSocket):
    """WebSocket для реального времени обновлений"""
    await websocket_manager.connect(websocket)
    try:
        await websocket_manager.stream_initial(websocket, market_collector, smt_analyzer)
        
        while True:
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await websocket_manager.disconnect(websocket)

# === УТИЛИТЫ ===
async def _get_current_market_phase() -> Optional[str]:
    """Определить текущую фазу рынка"""
    try:
        now = datetime.now(timezone.utc)
        quarter_start = datetime(now.year, ((now.month - 1) // 3) * 3 + 1, 1, tzinfo=timezone.utc)
        days_in_quarter = (now - quarter_start).days
        quarter_length = 90
        
        if days_in_quarter <= 0.25 * quarter_length:
            return "Q1_Accumulation"
        elif days_in_quarter <= 0.5 * quarter_length:
            return "Q2_Manipulation" 
        elif days_in_quarter <= 0.75 * quarter_length:
            return "Q3_Distribution"
        else:
            return "Q4_Rebalance"
    except:
        return None

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,  
        reload=True,
        log_level=settings.LOG_LEVEL.lower()
    )