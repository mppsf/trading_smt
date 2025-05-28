from typing import List
from datetime import datetime, timezone
from app.analyzers.base import BaseAnalyzer
from app.core.data_models import OHLCV, Signal
from app.utils.data_helpers import ohlcv_to_df

class VolumeAnalyzer(BaseAnalyzer):
    def analyze(self, data: List[OHLCV]) -> List[Signal]:
        if len(data) < 20:
            return []
        
        df = ohlcv_to_df(data)
        vol_sma = df['volume'].rolling(20).mean()
        vol_std = df['volume'].rolling(20).std()
        multiplier = self.settings.get('volume_multiplier', 1.5)
        
        signals = []
        for i in range(-5, 0):
            current = df.iloc[i]
            threshold = vol_sma.iloc[i] + multiplier * vol_std.iloc[i]
            
            if current['volume'] > threshold:
                signal_type = 'volume_spike'
                if i > -len(df):
                    prev = df.iloc[i-1]
                    if current['high'] > prev['high'] and current['volume'] < prev['volume']:
                        signal_type = 'volume_divergence_bearish'
                    elif current['low'] < prev['low'] and current['volume'] < prev['volume']:
                        signal_type = 'volume_divergence_bullish'
                
                signals.append(Signal(
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    type=signal_type,
                    strength=min((current['volume'] / vol_sma.iloc[i]) / 3.0, 1.0),
                    es_price=current['close'],
                    nq_price=current['close'],
                    details={'volume_ratio': current['volume'] / vol_sma.iloc[i]}
                ))
        
        return signals