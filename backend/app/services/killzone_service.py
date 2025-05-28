from typing import List
from backend.app.schemas.schemas import KillzoneInfo

class KillzoneService:
    def __init__(self):
        self._killzones = [
            {"name": "Asia Open", "start_time": "23:00:00", "end_time": "02:00:00", "description": "Liquidity buildup before London"},
            {"name": "London Open", "start_time": "07:00:00", "end_time": "10:00:00", "description": "High volatility in European session"},
            {"name": "London Close", "start_time": "11:30:00", "end_time": "12:30:00", "description": "Profit taking & transition to NY session"},
            {"name": "New York Open", "start_time": "13:30:00", "end_time": "16:00:00", "description": "Volatility spike and news releases"},
            {"name": "New York Close", "start_time": "19:00:00", "end_time": "21:00:00", "description": "Final liquidity sweep of the day"}
        ]

    async def get_killzones(self) -> List[KillzoneInfo]:
        return [KillzoneInfo(**kz) for kz in self._killzones]