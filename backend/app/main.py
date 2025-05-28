from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
import logging
import pandas as pd
from datetime import datetime, timezone
import uvicorn

from app.core.settings_manager import SettingsManager
from app.schemas import HealthResponse
from app.services.market_data_collector import MarketDataCollector
from app.services.smt_analyzer import SmartMoneyAnalyzer
from app.core.config import settings
from app.core.websocket_manager import WebSocketManager
from app.tasks.background_tasks import start_background_tasks
from app.services.killzone import KillzoneService
from app.schemas import KillzonesResponse

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="SMT Trading Analyzer", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings_manager = SettingsManager()
market_collector = MarketDataCollector()
smt_analyzer = SmartMoneyAnalyzer()
websocket_manager = WebSocketManager()

killzone_service = KillzoneService()

@app.get("/api/v1/killzones", response_model=KillzonesResponse)
async def get_killzones():
    try:
        zones = await killzone_service.get_killzones()
        return KillzonesResponse(killzones=zones)
    except Exception as e:
        logger.error(f"Error fetching killzones: {e}")
        raise HTTPException(status_code=500, detail="Unable to retrieve killzones")
    
    
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
    try:
        return settings_manager.to_dict()
    except Exception as e:
        logger.error(f"Error getting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/v1/settings")
async def update_settings(payload: dict = Body(...)):
    try:
        settings_manager.update(**payload)
        return settings_manager.to_dict()
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/market-data")
async def get_market_data(symbols: str = "QQQ,SPY", timeframe: str = "5m", limit: int = 100):
    try:
        symbol_list = [s.strip() for s in symbols.split(",")]
        result = []
        
        for symbol in symbol_list:
            try:
                cached_data = await market_collector.get_symbol_data(symbol)
                
                if cached_data:
                    source_data = cached_data.ohlcv_5m if timeframe == "5m" else cached_data.ohlcv_15m
                    
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
                        "ohlcv_5m": ohlcv_data,
                        "market_state": cached_data.market_state
                    })
                else:
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
    try:
        signals = await smt_analyzer.get_cached_signals(limit)
        
        result = []
        for signal in signals:
            # Маппинг типов сигналов для фронтенда
            frontend_signal_type = signal.signal_type
            if 'bullish' in signal.signal_type:
                frontend_signal_type = 'bullish_divergence'
            elif 'bearish' in signal.signal_type:
                frontend_signal_type = 'bearish_divergence'
            else:
                frontend_signal_type = 'neutral'
            
            result.append({
                "timestamp": signal.timestamp,
                "signal_type": frontend_signal_type,
                "strength": float(signal.strength),
                "nasdaq_price": float(signal.nq_price),  # Маппинг nq_price -> nasdaq_price
                "sp500_price": float(signal.es_price),   # Маппинг es_price -> sp500_price
                "divergence_percentage": float(signal.divergence_percentage),
                "confirmation_status": bool(signal.confirmation_status),
                "details": signal.details
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting SMT signals: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/ws/market-updates")
async def ws_endpoint(websocket: WebSocket):
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

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,  
        reload=True,
        log_level=settings.LOG_LEVEL.lower()
    )