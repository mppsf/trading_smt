from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple, Optional
from app.core.data_models import OHLCV, Signal
from app.core.settings_manager import SettingsManager

class BaseAnalyzer(ABC):
    def __init__(self):
        self.settings_manager = SettingsManager()
        self.settings = self.settings_manager.to_dict()
    
    @abstractmethod
    def analyze(self, *args, **kwargs) -> List[Signal]:
        pass
    
    def _merge_settings(self, custom_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Объединить базовые настройки с кастомными параметрами"""
        merged_settings = self.settings.copy()
        if custom_params:
            merged_settings.update(custom_params)
        return merged_settings
    
    def _get_fractals(self, data: List[OHLCV], period: int = None, custom_params: Optional[Dict[str, Any]] = None) -> Tuple[List[Tuple], List[Tuple]]:
        settings = self._merge_settings(custom_params)
        if period is None:
            period = settings.get('fractal_period', 2)
            
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
            
            # Низкие фракtalы
            is_low_fractal = True
            for j in range(i - period, i + period + 1):
                if j != i and data[j].low <= data[i].low:
                    is_low_fractal = False
                    break
            
            if is_low_fractal:
                lows.append((i, data[i].low, data[i].timestamp))
        
        fractal_limit = settings.get('fractal_limit', 20)
        return highs[-fractal_limit:], lows[-fractal_limit:]