from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

from app.core.websocket_manager import WebSocketManager
from app.services.market_data_collector import MarketDataCollector
from backend.app.services.smart_money_service import SmartMoneyAnalyzer

logger = logging.getLogger(__name__)
router = APIRouter()

@router.websocket("/ws/market-updates")
async def ws_endpoint(websocket: WebSocket):
    """WebSocket для реального времени обновлений"""
    websocket_manager = WebSocketManager()
    market_collector = MarketDataCollector()
    smt_analyzer = SmartMoneyAnalyzer()
    
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