from abc import ABC, abstractmethod
from typing import List
from app.core.data_models import OHLCV, Signal
from app.core.settings_manager import SettingsManager
from app.utils.data_helpers import ohlcv_to_df

class BaseAnalyzer(ABC):
    def __init__(self):
        self.settings = SettingsManager()
    
    @abstractmethod
    def analyze(self, *args) -> List[Signal]:
        pass
    
    def _get_fractals(self, data: List[OHLCV], look_back: int = 2):
        df = ohlcv_to_df(data)
        if len(df) < 5:
            return [], []
        
        highs, lows = [], []
        for i in range(look_back, len(df) - look_back):
            high, low = df['high'].iloc[i], df['low'].iloc[i]
            
            if all(high > df['high'].iloc[j] for j in range(i-look_back, i+look_back+1) if j != i):
                highs.append((i, high, df['timestamp'].iloc[i]))
            
            if all(low < df['low'].iloc[j] for j in range(i-look_back, i+look_back+1) if j != i):
                lows.append((i, low, df['timestamp'].iloc[i]))
        
        return highs[-5:], lows[-5:]