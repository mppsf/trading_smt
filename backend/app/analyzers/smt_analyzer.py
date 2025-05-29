from typing import List, Dict, Optional, Any
from datetime import datetime, timezone
from app.analyzers.base import BaseAnalyzer
from app.core.data_models import OHLCV, Signal

class SMTAnalyzer(BaseAnalyzer):
    def analyze(self, es_data: List[OHLCV], nq_data: List[OHLCV], custom_params: Optional[Dict[str, Any]] = None) -> List[Signal]:
        settings = self._merge_settings(custom_params)
        
        es_highs, es_lows = self._get_fractals(es_data, custom_params=custom_params)
        nq_highs, nq_lows = self._get_fractals(nq_data, custom_params=custom_params)
        
        if len(es_lows) < 2 or len(nq_lows) < 2 or len(es_highs) < 2 or len(nq_highs) < 2:
            return []
        
        signals = []
        threshold = settings.get('divergence_threshold', 0.5)
        min_strength = settings.get('smt_strength_threshold', 0.0)
        
        # Bullish: ES higher low, NQ lower low
        if es_lows[-2][1] < es_lows[-1][1] and nq_lows[-2][1] > nq_lows[-1][1]:
            div_pct = abs((es_lows[-1][1] / es_lows[-2][1] - 1) * 100)
            if div_pct >= threshold:
                strength = min(div_pct / 2.0, 1.0)
                if strength >= min_strength:
                    signals.append(Signal(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        type='smt_bullish_divergence',
                        strength=strength,
                        es_price=es_data[-1].close,
                        nq_price=nq_data[-1].close,
                        divergence_pct=div_pct,
                        confirmed=self._check_confirmation(es_data, nq_data, 'bullish', custom_params),
                        details={'threshold': threshold}
                    ))
        
        # Bearish: ES lower high, NQ higher high
        if es_highs[-2][1] > es_highs[-1][1] and nq_highs[-2][1] < nq_highs[-1][1]:
            div_pct = abs((es_highs[-1][1] / es_highs[-2][1] - 1) * 100)
            if div_pct >= threshold:
                strength = min(div_pct / 2.0, 1.0)
                if strength >= min_strength:
                    signals.append(Signal(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        type='smt_bearish_divergence',
                        strength=strength,
                        es_price=es_data[-1].close,
                        nq_price=nq_data[-1].close,
                        divergence_pct=div_pct,
                        confirmed=self._check_confirmation(es_data, nq_data, 'bearish', custom_params),
                        details={'threshold': threshold}
                    ))
        
        return signals
    
    def _check_confirmation(self, es_data: List[OHLCV], nq_data: List[OHLCV], direction: str, custom_params: Optional[Dict[str, Any]] = None) -> bool:
        settings = self._merge_settings(custom_params)
        conf_candles = settings.get('confirmation_candles', 3)
        
        if len(es_data) < conf_candles or len(nq_data) < conf_candles:
            return False
        
        recent_es = es_data[-conf_candles:]
        recent_nq = nq_data[-conf_candles:]
        
        if direction == 'bullish':
            return all(bar.close >= bar.open for bar in recent_es[-2:] + recent_nq[-2:])
        else:
            return all(bar.close <= bar.open for bar in recent_es[-2:] + recent_nq[-2:])