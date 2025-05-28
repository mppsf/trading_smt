from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import uvicorn

from app.core.config import settings
from app.core.websocket_manager import WebSocketManager
from app.services.market_data_collector import MarketDataCollector
from backend.app.services.smart_money_service import SmartMoneyAnalyzer
from app.tasks.background_tasks import start_background_tasks

# Импорт роутеров
from app.health_router import router as health_router
from app.settings_router import router as settings_router
from app.market_data_router import router as market_data_router
from app.smt_analysis_router import router as smt_analysis_router
from app.killzones_router import router as killzones_router
from app.websocket_router import router as websocket_router

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

# Регистрация роутеров
app.include_router(health_router)
app.include_router(settings_router)
app.include_router(market_data_router)
app.include_router(smt_analysis_router)
app.include_router(killzones_router)
app.include_router(websocket_router)

# Инициализация сервисов
market_collector = MarketDataCollector()
smt_analyzer = SmartMoneyAnalyzer()
websocket_manager = WebSocketManager()

@app.on_event("startup")
async def on_startup():
    logger.info("Starting Smart Money Trading Analyzer...")
    await start_background_tasks(app, market_collector, smt_analyzer, websocket_manager)

@app.on_event("shutdown")
async def on_shutdown():
    logger.info("Shutting down...")
    await websocket_manager.disconnect_all()

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,  
        reload=True,
        log_level=settings.LOG_LEVEL.lower()
    )