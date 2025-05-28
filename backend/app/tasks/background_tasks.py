import asyncio
from fastapi import FastAPI
import logging
from datetime import datetime, timezone
from typing import Dict, Any

from app.services.market_data_collector import MarketDataCollector, MarketSnapshot
from backend.app.services.smart_money_service import SMTAnalyzer, SMTSignal
from app.core.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

class BackgroundTaskManager:
    def __init__(self, collector: MarketDataCollector, analyzer: SMTAnalyzer, manager: WebSocketManager):
        self.collector = collector
        self.analyzer = analyzer
        self.manager = manager
        self.task = None
        self.running = False
        
    async def start(self):
        """Start background data collection and analysis"""
        if self.running:
            return
            
        self.running = True
        self.task = asyncio.create_task(self._run_loop())
        logger.info("Background tasks started")
        
    async def stop(self):
        """Stop background tasks"""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Background tasks stopped")
        
    async def _run_loop(self):
        """Main background loop"""
        while self.running:
            try:
                # Collect market data
                logger.debug("Collecting market data...")
                market_data = await self.collector.collect_realtime_data()
                
                if market_data:
                    # Analyze SMT signals
                    logger.debug("Analyzing SMT signals...")
                    smt_signals = await self.analyzer.analyze_all(market_data)
                    
                    # Get killzone info
                    killzone_info = self.analyzer.killzone_manager.get_killzone_info()
                    
                    # Prepare broadcast data
                    broadcast_data = await self._prepare_broadcast_data(
                        market_data, smt_signals, killzone_info
                    )
                    
                    # Broadcast updates via WebSocket
                    await self.manager.broadcast(broadcast_data)
                    
                    logger.info(f"Broadcasted update: {len(market_data)} symbols, {len(smt_signals)} signals")
                else:
                    logger.warning("No market data collected")
                
            except Exception as e:
                logger.error(f"Error in background task loop: {e}")
                
            # Wait before next iteration (30 seconds)
            try:
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                break
                
    async def _prepare_broadcast_data(self, market_data: Dict[str, MarketSnapshot], 
                                    smt_signals: list[SMTSignal], 
                                    killzone_info) -> Dict[str, Any]:
        """Prepare data for WebSocket broadcast"""
        try:
            # Convert market data
            market_data_dict = {}
            for symbol, snapshot in market_data.items():
                market_data_dict[symbol] = {
                    "symbol": snapshot.symbol,
                    "current_price": float(snapshot.current_price),
                    "change_percent": float(snapshot.change_percent),
                    "volume": int(snapshot.volume),
                    "timestamp": snapshot.timestamp,
                    "market_state": snapshot.market_state
                }
            
            # Convert SMT signals
            signals_list = []
            for signal in smt_signals:
                # Map signal types for frontend compatibility
                frontend_signal_type = signal.signal_type
                if signal.signal_type not in ['bullish_divergence', 'bearish_divergence']:
                    frontend_signal_type = 'neutral'
                    
                signals_list.append({
                    "timestamp": signal.timestamp,
                    "signal_type": frontend_signal_type,
                    "strength": float(signal.strength),
                    "nasdaq_price": float(signal.nasdaq_price),
                    "sp500_price": float(signal.sp500_price),
                    "divergence_percentage": float(signal.divergence_percentage),
                    "confirmation_status": bool(signal.confirmation_status),
                    "details": getattr(signal, 'details', {})
                })
            
            # Convert killzone info
            killzone_data = {
                "current": killzone_info.current,
                "time_remaining": killzone_info.time_remaining,
                "next_session": killzone_info.next_session,
                "priority": killzone_info.priority
            }
            
            return {
                "type": "market_update",
                "data": {
                    "market_data": market_data_dict,
                    "smt_signals": signals_list,
                    "killzone_info": killzone_data,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error preparing broadcast data: {e}")
            return {
                "type": "error",
                "data": {
                    "message": "Error preparing market data",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }

# Global task manager instance
task_manager: BackgroundTaskManager = None

async def start_background_tasks(app: FastAPI,
                               collector: MarketDataCollector,
                               analyzer: SMTAnalyzer,
                               manager: WebSocketManager):
    """Initialize and start background tasks"""
    global task_manager
    
    try:
        task_manager = BackgroundTaskManager(collector, analyzer, manager)
        await task_manager.start()
        
        # Add shutdown handler
        async def shutdown_handler():
            if task_manager:
                await task_manager.stop()
                
        app.add_event_handler("shutdown", shutdown_handler)
        
    except Exception as e:
        logger.error(f"Failed to start background tasks: {e}")
        raise

async def stop_background_tasks():
    """Stop background tasks"""
    global task_manager
    if task_manager:
        await task_manager.stop()