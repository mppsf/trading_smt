import os

# Настройки приложения через переменные окружения
class Settings:
    def __init__(self):
        # Уровень логирования (DEBUG, INFO, WARNING, ERROR)
        self.LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
        # Разрешенные источники для CORS, разделенные запятой
        self.ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "*").split(",")
        # URL Redis для кеширования и pub/sub
        self.REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Экземпляр настроек
settings = Settings()

# Список символов для трейдинга, через запятую или из окружения
# Формат: "AAPL,GOOG,MSFT"
default_symbols = os.getenv("TRADING_SYMBOLS", "QQQ,SPY").split(",")
settings.TRADING_SYMBOLS = default_symbols
