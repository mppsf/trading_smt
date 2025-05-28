from pydantic import BaseSettings
from typing import List

class Settings(BaseSettings):
    LOG_LEVEL: str = "INFO"
    ALLOWED_ORIGINS: List[str] = ["*"]
    REDIS_URL: str = "redis://localhost:6379/0"
    TRADING_SYMBOLS: List[str] = ["QQQ", "SPY"]
    
    class Config:
        env_file = ".env"
        
    @property
    def allowed_origins_list(self) -> List[str]:
        return self.ALLOWED_ORIGINS if isinstance(self.ALLOWED_ORIGINS, list) else self.ALLOWED_ORIGINS.split(",")

settings = Settings()
