from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import uvicorn

from app.core.settings_manager import SettingsManager
from app.schemas import MarketDataResponse, SMTAnalysisResponse, HealthResponse
from app.services.market_data_collector import MarketDataCollector
from app.services.smt_analyzer import SMTAnalyzer
from app.core.config import settings
from app.core.websocket_manager import WebSocketManager
from app.tasks.background_tasks import start_background_tasks

# Логирование
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
settings_manager = SettingsManager()

app = FastAPI(
    title="SMT Trading Analyzer",
    description="Smart Money Theory Trading Analysis",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

market_collector = MarketDataCollector()
smt_analyzer = SMTAnalyzer()
websocket_manager = WebSocketManager()

@app.on_event("startup")
async def on_startup():
    logger.info("Starting application...")
    await start_background_tasks(app, market_collector, smt_analyzer, websocket_manager)

@app.on_event("shutdown")
async def on_shutdown():
    logger.info("Shutting down...")
    await websocket_manager.disconnect_all()

@app.get("/health", response_model=HealthResponse)
async def health():
    """Проверка состояния сервиса"""
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

@app.get("/api/v1/settings")
async def get_settings():
    """Возвращает текущие динамические настройки SMT-анализаторов"""
    try:
        return settings_manager.to_dict()
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/v1/settings")
async def update_settings(payload: dict = Body(...)):
    """Обновляет любые переданные поля настроек в памяти приложения"""
    try:
        settings_manager.update(**payload)
        return settings_manager.to_dict()
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/market-data")
async def get_market_data(symbols: str = "QQQ,SPY", timeframe: str = "5m", limit: int = 100):
    """Get market data with OHLCV format matching frontend expectations"""
    try:
        symbol_list = [s.strip() for s in symbols.split(",")]
        result = []
        
        for symbol in symbol_list:
            try:
                # Get cached data first
                cached_data = await market_collector.get_symbol_data(symbol)
                
                if cached_data:
                    # Convert to frontend format
                    ohlcv_data = []
                    source_data = cached_data.ohlcv_5m if timeframe == "5m" else cached_data.ohlcv_15m
                    
                    # Ensure we have data and limit it
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
                        "ohlcv_5m": ohlcv_data,
                        "market_state": cached_data.market_state
                    })
                else:
                    # Fallback: fetch fresh data
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
                            "ohlcv_5m": ohlcv_data,
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

@app.get("/api/v1/smt-signals")
async def get_smt_signals(limit: int = 50):
    """Get SMT signals matching frontend interface"""
    try:
        signals = await smt_analyzer.get_cached_signals(limit)
        
        # Convert to frontend format
        result = []
        for signal in signals:
            # Map signal types to frontend expectations
            frontend_signal_type = signal.signal_type
            if signal.signal_type not in ['bullish_divergence', 'bearish_divergence']:
                frontend_signal_type = 'neutral'  # Default for other signal types
            
            result.append({
                "timestamp": signal.timestamp,
                "signal_type": frontend_signal_type,
                "strength": float(signal.strength),
                "nasdaq_price": float(signal.nasdaq_price),
                "sp500_price": float(signal.sp500_price),
                "divergence_percentage": float(signal.divergence_percentage),
                "confirmation_status": bool(signal.confirmation_status),
                "details": signal.details if hasattr(signal, 'details') else {}
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting SMT signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/killzones")
async def get_killzones():
    """Получение информации о торговых сессиях"""
    try:
        killzone_info = smt_analyzer.killzone_manager.get_killzone_info()
        return {
            "current": killzone_info.current,
            "time_remaining": killzone_info.time_remaining,
            "next_session": killzone_info.next_session,
            "priority": killzone_info.priority
        }
    except Exception as e:
        logger.error(f"Error getting killzones: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/market-updates")
async def ws_endpoint(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        # Send initial data
        await websocket_manager.stream_initial(websocket, market_collector, smt_analyzer)
        
        # Keep connection alive and handle ping/pong
        while True:
            try:
                # Wait for messages from client (ping/pong or other)
                data = await websocket.receive_text()
                # Echo back or handle specific commands if needed
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

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,  
        reload=True,
        log_level=settings.LOG_LEVEL.lower()
    )