from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional
import uvicorn

from app.schemas import MarketDataResponse, SMTAnalysisResponse, HealthResponse
from app.services.market_data_collector import MarketDataCollector
# from app.services.smt_analyzer import SMTAnalyzer
from app.core.config import settings
from app.core.websocket_manager import WebSocketManager
from app.tasks.background_tasks import start_background_tasks

# Логирование
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
# smt_analyzer = SMTAnalyzer()
websocket_manager = WebSocketManager()

@app.on_event("startup")
async def on_startup():
    logger.info("Starting application...")
    # start_background_tasks(app, market_collector, smt_analyzer, websocket_manager)
    start_background_tasks(app, market_collector, websocket_manager)

@app.on_event("shutdown")
async def on_shutdown():
    logger.info("Shutting down...")
    await websocket_manager.disconnect_all()

@app.get("/health", response_model=HealthResponse)
async def health():
    """Проверка состояния сервиса"""
    # Получаем расширенный статус здоровья сервиса
    health = await market_collector.health_check()
    # Извлекаем статус Redis из результатов проверки
    redis_status = health.get("checks", {}).get("redis", health.get("status", "unknown"))
    return HealthResponse(redis=redis_status)


@app.get("/api/v1/market-data", response_model=List[MarketDataResponse])
async def get_market_data(symbols: str = "QQQ,SPY"):
    data = await market_collector.fetch(symbols.split(","))
    return data

# @app.get("/api/v1/smt-signals", response_model=List[SMTAnalysisResponse])
# async def get_signals(limit: int = 50, signal_type: Optional[str] = None):
#     signals = await smt_analyzer.analyze_all()
#     if signal_type:
#         signals = [s for s in signals if s.signal_type == signal_type]
#     return signals[:limit]
@app.get("/api/v1/killzones")
async def get_killzones():
    """Получение информации о торговых сессиях"""
    # killzone_info = smt_analyzer.killzone_manager.get_killzone_info()
    return killzone_info

@app.websocket("/ws/market-updates")
async def ws_endpoint(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        await websocket_manager.stream_initial(websocket, market_collector)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
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