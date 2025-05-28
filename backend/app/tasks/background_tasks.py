import asyncio
from fastapi import FastAPI
import logging

from app.services.market_data_collector import MarketDataCollector
from app.services.smt_analyzer import SMTAnalyzer
from app.core.websocket_manager import WebSocketManager
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

def start_background_tasks(app: FastAPI,
                           collector: MarketDataCollector,
                           analyzer: SMTAnalyzer,
                           manager: WebSocketManager):
    async def run():
        while True:
            try:
                # Collect market data
                market_data = await collector.collect_realtime_data()
                
                if market_data:
                    # Analyze SMT signals
                    smt_signals = await analyzer.analyze_all(market_data)
                    
                    # Broadcast updates via WebSocket
                    await manager.broadcast({
                        "type": "market_update",
                        "data": {
                            "market_data": {
                                symbol: {
                                    "symbol": snapshot.symbol,
                                    "current_price": snapshot.current_price,
                                    "change_percent": snapshot.change_percent,
                                    "volume": snapshot.volume,
                                    "timestamp": snapshot.timestamp,
                                    "market_state": snapshot.market_state
                                }
                                for symbol, snapshot in market_data.items()
                            },
                            "smt_signals": [
                                {
                                    "timestamp": signal.timestamp,
                                    "signal_type": signal.signal_type if signal.signal_type in ['bullish_divergence', 'bearish_divergence'] else 'neutral',
                                    "strength": signal.strength,
                                    "nasdaq_price": signal.nasdaq_price,
                                    "sp500_price": signal.sp500_price,
                                    "divergence_percentage": signal.divergence_percentage,
                                    "confirmation_status": signal.confirmation_status
                                }
                                for signal in smt_signals
                            ],
                            "killzone_info": {
                                kz_info := analyzer.killzone_manager.get_killzone_info()
                                and {
                                    "current": kz_info.current,
                                    "time_remaining": kz_info.time_remaining,
                                    "next_session": kz_info.next_session,
                                    "priority": kz_info.priority
                                }
                            } or {},
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                    })
                    
                    logger.info(f"Broadcasted update: {len(market_data)} market data, {len(smt_signals)} SMT signals")
                
            except Exception as e:
                logger