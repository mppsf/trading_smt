import asyncio
from fastapi import FastAPI
import logging
from datetime import datetime, timezone
from typing import Dict, Any

from app.services.market_data_collector import MarketDataCollector, MarketSnapshot
from app.services.smart_money_service import SmartMoneyService
from app.core.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

class BackgroundTaskManager:
    def __init__(self, collector: MarketDataCollector, smt_service: SmartMoneyService, ws_manager: WebSocketManager):
        self.collector = collector
        self.smt_service = smt_service
        self.ws_manager = ws_manager
        self.task = None
        self.running = False
        self.last_run = None
        
    async def start(self):
        if self.running:
            return
        self.running = True
        self.task = asyncio.create_task(self._run_loop())
        logger.info("Background tasks started")
        
    async def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Background tasks stopped")
        
    async def _run_loop(self):
        while self.running:
            start_time = asyncio.get_event_loop().time()
            
            try:
                market_data = await self.collector.collect_realtime_data()
                
                if market_data:
                    signals = await self.smt_service.analyze(market_data)
                    broadcast_data = self._prepare_broadcast_data(market_data, signals)
                    
                    try:
                        await self.ws_manager.broadcast(broadcast_data)
                        logger.debug(f"Broadcasted: {len(market_data)} symbols, {len(signals)} signals")
                    except Exception as ws_error:
                        logger.error(f"WebSocket broadcast failed: {ws_error}")
                else:
                    logger.warning("No market data collected")
                
            except Exception as e:
                logger.error(f"Background task error: {e}")
                
            elapsed = asyncio.get_event_loop().time() - start_time
            sleep_time = max(0, 30 - elapsed)
            
            try:
                await asyncio.sleep(sleep_time)
            except asyncio.CancelledError:
                break
                
    def _prepare_broadcast_data(self, market_data: Dict[str, MarketSnapshot], signals: list) -> Dict[str, Any]:
        try:
            market_dict = {
                symbol: {
                    "symbol": snap.symbol,
                    "current_price": float(snap.current_price),
                    "change_percent": float(snap.change_percent),
                    "volume": int(snap.volume),
                    "timestamp": snap.timestamp,
                    "market_state": snap.market_state
                } for symbol, snap in market_data.items()
            }
            
            signals_list = [{
                "timestamp": s.timestamp if hasattr(s, 'timestamp') else datetime.now(timezone.utc).isoformat(),
                "signal_type": getattr(s, 'signal_type', 'neutral'),
                "strength": float(getattr(s, 'strength', 0)),
                "details": getattr(s, 'details', {})
            } for s in signals]
            
            return {
                "type": "market_update",
                "data": {
                    "market_data": market_dict,
                    "signals": signals_list,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Broadcast data preparation error: {e}")
            return {
                "type": "error",
                "data": {"message": "Data preparation failed", "timestamp": datetime.now(timezone.utc).isoformat()}
            }

task_manager: BackgroundTaskManager = None

async def start_background_tasks(app: FastAPI, collector: MarketDataCollector, smt_service: SmartMoneyService, ws_manager: WebSocketManager):
    global task_manager
    try:
        task_manager = BackgroundTaskManager(collector, smt_service, ws_manager)
        await task_manager.start()
        
        async def shutdown_handler():
            if task_manager:
                await task_manager.stop()
        
        app.add_event_handler("shutdown", shutdown_handler)
                
    except Exception as e:
        logger.error(f"Failed to start background tasks: {e}")
        raise

async def stop_background_tasks():
    global task_manager
    if task_manager:
        await task_manager.stop()