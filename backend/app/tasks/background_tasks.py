import asyncio
from fastapi import FastAPI

from app.services.market_data_collector import MarketDataCollector
# from app.services.smt_analyzer import SMTAnalyzer
from app.core.websocket_manager import WebSocketManager
from datetime import datetime, timezone


def start_background_tasks(app: FastAPI,
                           collector: MarketDataCollector,
                        #    analyzer: SMTAnalyzer,
                           manager: WebSocketManager):
    async def run():
        while True:
            try:
                data = await collector.fetch([])  # использовать символы из настроек
                # # signals = await analyzer.analyze(data)
                # await manager.broadcast({
                #     "type": "market_update",
                #     "data": {
                #         "market_data": data,
                #         "smt_signals": signals,
                #         "timestamp": datetime.now(timezone.utc).isoformat()
                #     }
                # })
            except Exception:
                pass
            await asyncio.sleep(30)

    app.add_event_handler("startup", lambda: asyncio.create_task(run()))