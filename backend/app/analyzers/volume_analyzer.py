from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from app.analyzers.base import BaseAnalyzer
from app.core.data_models import OHLCV, Signal
from app.utils.data_helpers import ohlcv_to_df

class VolumeAnalyzer(BaseAnalyzer):
    def analyze(self, data: List[OHLCV], custom_params: Optional[Dict[str, Any]] = None) -> List[Signal]:
        settings = self._merge_settings(custom_params)
        min_data_points = settings.get('volume_min_data_points', 20)
        
        if len(data) < min_data_points:
            return []
        
        df = ohlcv_to_df(data)
        rolling_window = settings.get('volume_rolling_window', 20)
        vol_sma = df['volume'].rolling(rolling_window).mean()
        vol_std = df['volume'].rolling(rolling_window).std()
        multiplier = settings.get('volume_multiplier', 1.5)
        min_strength = settings.get('smt_strength_threshold', 0.0)
        check_candles = settings.get('volume_check_candles', 5)
        
        signals = []
        for i in range(-check_candles, 0):
            current = df.iloc[i]
            threshold = vol_sma.iloc[i] + multiplier * vol_std.iloc[i]
            
            if current['volume'] > threshold:
                signal_type = 'volume_spike'
                strength = min((current['volume'] / vol_sma.iloc[i]) / 3.0, 1.0)
                
                if i > -len(df):
                    prev = df.iloc[i-1]
                    if current['high'] > prev['high'] and current['volume'] < prev['volume']:
                        signal_type = 'volume_divergence_bearish'
                    elif current['low'] < prev['low'] and current['volume'] < prev['volume']:
                        signal_type = 'volume_divergence_bullish'
                
                if strength >= min_strength:
                    signals.append(Signal(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        type=signal_type,
                        strength=strength,
                        es_price=current['close'],
                        nq_price=current['close'],
                        details={'volume_ratio': current['volume'] / vol_sma.iloc[i]}
                    ))
        
        return signals