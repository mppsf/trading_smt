from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import logging
import asyncio

logger = logging.getLogger(__name__)

class WebSocketManager:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)
        logger.info(f"WebSocket connected. Total: {len(self.connections)}")

    async def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)
            logger.info(f"WebSocket disconnected. Total: {len(self.connections)}")

    async def disconnect_all(self):
        disconnect_tasks = []
        for ws in list(self.connections):
            disconnect_tasks.append(self._safe_close(ws))
        
        if disconnect_tasks:
            await asyncio.gather(*disconnect_tasks, return_exceptions=True)
        self.connections.clear()

    async def _safe_close(self, ws: WebSocket):
        try:
            await ws.close()
        except Exception as e:
            logger.warning(f"Error closing WebSocket: {e}")

    async def broadcast(self, message: Dict[str, Any]):
        if not self.connections:
            return
        
        failed_connections = []
        tasks = []
        
        for ws in self.connections:
            tasks.append(self._safe_send(ws, message, failed_connections))
        
        await asyncio.gather(*tasks, return_exceptions=True)
        
        # Удаляем неработающие соединения
        for ws in failed_connections:
            await self.disconnect(ws)

    async def _safe_send(self, ws: WebSocket, message: Dict[str, Any], failed_list: List):
        try:
            await ws.send_json(message)
        except (WebSocketDisconnect, ConnectionResetError, Exception):
            failed_list.append(ws)

    async def stream_initial(self, ws: WebSocket, collector):
        try:
            data = await collector.get_cached_data()
            if data:
                await ws.send_json({"type": "initial_data", "data": data})
        except Exception as e:
            logger.error(f"Error streaming initial data: {e}")
            await ws.send_json({"type": "error", "message": "Failed to load initial data"})