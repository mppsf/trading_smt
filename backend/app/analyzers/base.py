from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple
from app.core.data_models import OHLCV, Signal
from app.core.settings_manager import SettingsManager

class BaseAnalyzer(ABC):
    def __init__(self):
        self.settings_manager = SettingsManager()
        self.settings = self.settings_manager.to_dict()
    
    @abstractmethod
    def analyze(self, *args, **kwargs) -> List[Signal]:
        pass
    
    def _get_fractals(self, data: List[OHLCV], period: int = 2) -> Tuple[List[Tuple], List[Tuple]]:
        if len(data) < period * 2 + 1:
            return [], []
        
        highs, lows = [], []
        
        for i in range(period, len(data) - period):
            # Высокие фракталы
            is_high_fractal = True
            for j in range(i - period, i + period + 1):
                if j != i and data[j].high >= data[i].high:
                    is_high_fractal = False
                    break
            
            if is_high_fractal:
                highs.append((i, data[i].high, data[i].timestamp))
            
            # Низкие фракталы
            is_low_fractal = True
            for j in range(i - period, i + period + 1):
                if j != i and data[j].low <= data[i].low:
                    is_low_fractal = False
                    break
            
            if is_low_fractal:
                lows.append((i, data[i].low, data[i].timestamp))
        
        return highs[-20:], lows[-20:]