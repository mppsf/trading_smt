from typing import List, Dict, Any
import threading

class SettingsManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self._settings = {
                "min_divergence_threshold": 0.5,
                "lookback_period": 20,
                "swing_threshold": 0.5,
                "lookback_swings": 5,
                "min_block_size": 0.3,
                "volume_threshold": 1.5,
                "min_fvg_gap_size": 0.2,
                "quarterly_months": [1, 4, 7, 10],
                "monthly_bias_days": [1, 2, 3],
                "divergence_threshold": 0.5,  # Для совместимости с анализаторами
                "confirmation_candles": 3,
                "volume_multiplier": 1.5
            }
            self._initialized = True

    def get(self, key: str, default=None):
        return self._settings.get(key, default)

    def to_dict(self) -> Dict[str, Any]:
        return self._settings.copy()

    def update(self, **kwargs):
        with self._lock:
            self._settings.update(kwargs)