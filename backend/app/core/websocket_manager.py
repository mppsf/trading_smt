from fastapi import WebSocket
from typing import List, Dict, Any

class WebSocketManager:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    async def disconnect(self, ws: WebSocket):
        self.connections.remove(ws)

    async def disconnect_all(self):
        for ws in list(self.connections):
            await ws.close()
        self.connections.clear()

    async def broadcast(self, message: Dict[str, Any]):
        for ws in self.connections:
            await ws.send_json(message)

    async def stream_initial(self, ws: WebSocket, collector):
        # Try to fetch cached market data; fall back if method name changed
        try:
            data = await collector.get_cached_data()
        except AttributeError:
            data = None
        if data:
            await ws.send_json({"type": "initial_data", "data": data})