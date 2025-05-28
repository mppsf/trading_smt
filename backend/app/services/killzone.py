from typing import List
from app.schemas import KillzoneInfo

class KillzoneService:
    def __init__(self):
        # Можно подтягивать их из настроек или конфига
        self._killzones = [
            {"name": "London Open", "start_time": "07:00:00", "end_time": "10:00:00", "description": "European session start"},
            {"name": "New York Open", "start_time": "13:30:00", "end_time": "16:00:00", "description": "US session start"},
        ]

    async def get_killzones(self) -> List[KillzoneInfo]:
        return [KillzoneInfo(**kz) for kz in self._killzones]