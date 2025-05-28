import asyncio
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timezone, time, date, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
import pytz
import redis.asyncio as redis
import json

from app.core.config import settings
from app.core.settings_manager import SettingsManager
from app.services.market_data_collector import MarketSnapshot, OHLCVData

logger = logging.getLogger(__name__)

@dataclass
class SMTSignal:
    timestamp: str
    signal_type: str
    strength: float
    es_price: float
    nq_price: float
    divergence_percentage: float
    confirmation_status: bool
    details: Dict[str, Any]

@dataclass
class Fractal:
    timestamp: str
    price: float
    type: str
    index: int

class BaseAnalyzer:
    def __init__(self):
        self.settings = SettingsManager()
    
    def _ohlcv_to_df(self, data: List[OHLCVData]) -> pd.DataFrame:
        if not data:
            return pd.DataFrame()
        return pd.DataFrame([{
            'timestamp': item.timestamp,
            'open': item.open,
            'high': item.high,
            'low': item.low,
            'close': item.close,
            'volume': item.volume
        } for item in data])

class FractalDetector(BaseAnalyzer):
    def detect_fractals(self, data: List[OHLCVData], period: int = 15) -> Tuple[List[Fractal], List[Fractal]]:
        df = self._ohlcv_to_df(data)
        if len(df) < 5:
            return [], []
        
        high_fractals, low_fractals = [], []
        
        for i in range(2, len(df) - 2):
            high = df['high'].iloc[i]
            low = df['low'].iloc[i]
            
            if (high > df['high'].iloc[i-2] and high > df['high'].iloc[i-1] and 
                high > df['high'].iloc[i+1] and high > df['high'].iloc[i+2]):
                high_fractals.append(Fractal(
                    timestamp=df['timestamp'].iloc[i],
                    price=high,
                    type='high',
                    index=i
                ))
            
            if (low < df['low'].iloc[i-2] and low < df['low'].iloc[i-1] and 
                low < df['low'].iloc[i+1] and low < df['low'].iloc[i+2]):
                low_fractals.append(Fractal(
                    timestamp=df['timestamp'].iloc[i],
                    price=low,
                    type='low',
                    index=i
                ))
        
        return high_fractals[-5:], low_fractals[-5:]

class SMTDivergenceDetector(BaseAnalyzer):
    def detect_smt_divergence(self, es_data: List[OHLCVData], nq_data: List[OHLCVData]) -> List[SMTSignal]:
        try:
            fractal_detector = FractalDetector()
            es_highs, es_lows = fractal_detector.detect_fractals(es_data)
            nq_highs, nq_lows = fractal_detector.detect_fractals(nq_data)
            
            if len(es_lows) < 2 or len(nq_lows) < 2 or len(es_highs) < 2 or len(nq_highs) < 2:
                return []
            
            signals = []
            
            # Bullish divergence: ES higher low, NQ lower low
            if (es_lows[-2].price < es_lows[-1].price and 
                nq_lows[-2].price > nq_lows[-1].price):
                div_pct = abs((es_lows[-1].price / es_lows[-2].price - 1) * 100)
                signals.append(SMTSignal(
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    signal_type='smt_bullish_divergence',
                    strength=min(div_pct / 2.0, 1.0),
                    es_price=es_data[-1].close,
                    nq_price=nq_data[-1].close,
                    divergence_percentage=div_pct,
                    confirmation_status=div_pct > 0.5,
                    details={
                        'es_low_prev': es_lows[-2].price,
                        'es_low_curr': es_lows[-1].price,
                        'nq_low_prev': nq_lows[-2].price,
                        'nq_low_curr': nq_lows[-1].price
                    }
                ))
            
            # Bearish divergence: ES lower high, NQ higher high
            if (es_highs[-2].price > es_highs[-1].price and 
                nq_highs[-2].price < nq_highs[-1].price):
                div_pct = abs((es_highs[-1].price / es_highs[-2].price - 1) * 100)
                signals.append(SMTSignal(
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    signal_type='smt_bearish_divergence',
                    strength=min(div_pct / 2.0, 1.0),
                    es_price=es_data[-1].close,
                    nq_price=nq_data[-1].close,
                    divergence_percentage=div_pct,
                    confirmation_status=div_pct > 0.5,
                    details={
                        'es_high_prev': es_highs[-2].price,
                        'es_high_curr': es_highs[-1].price,
                        'nq_high_prev': nq_highs[-2].price,
                        'nq_high_curr': nq_highs[-1].price
                    }
                ))
            
            return signals
        except Exception as e:
            logger.error(f"SMT divergence error: {e}")
            return []

class StopHuntDetector(BaseAnalyzer):
    def detect_false_breaks(self, data: List[OHLCVData]) -> List[SMTSignal]:
        try:
            if len(data) < 20:
                return []
            
            df = self._ohlcv_to_df(data)
            signals = []
            
            # Get key levels (PDH, PDL)
            daily_high = df['high'].rolling(24).max().iloc[-2] if len(df) > 24 else df['high'].max()
            daily_low = df['low'].rolling(24).min().iloc[-2] if len(df) > 24 else df['low'].min()
            
            # Volume analysis
            avg_vol = df['volume'].rolling(20).mean().iloc[-1]
            vol_std = df['volume'].rolling(20).std().iloc[-1]
            
            for i in range(-3, -1):
                current = df.iloc[i]
                next_bar = df.iloc[i+1] if i+1 < 0 else df.iloc[-1]
                
                # False upward break
                if (current['high'] > daily_high and next_bar['close'] < daily_high and
                    current['volume'] > avg_vol + 1.5 * vol_std):
                    signals.append(SMTSignal(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        signal_type='false_break_up',
                        strength=0.8,
                        es_price=current['close'],
                        nq_price=current['close'],
                        divergence_percentage=0.0,
                        confirmation_status=True,
                        details={
                            'level': daily_high,
                            'break_high': current['high'],
                            'close_back': next_bar['close'],
                            'volume_ratio': current['volume'] / avg_vol
                        }
                    ))
                
                # False downward break
                if (current['low'] < daily_low and next_bar['close'] > daily_low and
                    current['volume'] > avg_vol + 1.5 * vol_std):
                    signals.append(SMTSignal(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        signal_type='false_break_down',
                        strength=0.8,
                        es_price=current['close'],
                        nq_price=current['close'],
                        divergence_percentage=0.0,
                        confirmation_status=True,
                        details={
                            'level': daily_low,
                            'break_low': current['low'],
                            'close_back': next_bar['close'],
                            'volume_ratio': current['volume'] / avg_vol
                        }
                    ))
            
            return signals
        except Exception as e:
            logger.error(f"Stop hunt error: {e}")
            return []

class TrueOpenCalculator(BaseAnalyzer):
    def get_true_opens(self, data: List[OHLCVData]) -> Dict[str, float]:
        try:
            df = self._ohlcv_to_df(data)
            if df.empty:
                return {}
            
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.set_index('timestamp')
            
            now = datetime.now(timezone.utc)
            opens = {}
            
            # Daily True Open (00:00 CME)
            daily_start = now.replace(hour=6, minute=0, second=0, microsecond=0)  # CME midnight = UTC 6:00
            daily_data = df[df.index >= daily_start]
            if not daily_data.empty:
                opens['daily'] = daily_data['open'].iloc[0]
            
            # Weekly True Open (Monday 18:00 CME)
            week_start = now - timedelta(days=now.weekday())
            week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)  # Monday CME 18:00 = Tuesday UTC 00:00
            weekly_data = df[df.index >= week_start]
            if not weekly_data.empty:
                opens['weekly'] = weekly_data['open'].iloc[0]
            
            # Quarterly True Open (first Monday of quarter)
            quarter_month = ((now.month - 1) // 3) * 3 + 1
            quarter_start = datetime(now.year, quarter_month, 1, tzinfo=timezone.utc)
            quarterly_data = df[df.index >= quarter_start]
            if not quarterly_data.empty:
                opens['quarterly'] = quarterly_data['open'].iloc[0]
            
            return opens
        except Exception as e:
            logger.error(f"True Open error: {e}")
            return {}

class VolumeAnomalyDetector(BaseAnalyzer):
    def detect_volume_anomalies(self, data: List[OHLCVData]) -> List[SMTSignal]:
        try:
            if len(data) < 20:
                return []
            
            df = self._ohlcv_to_df(data)
            vol_sma = df['volume'].rolling(20).mean()
            vol_std = df['volume'].rolling(20).std()
            
            signals = []
            
            for i in range(-5, 0):
                current = df.iloc[i]
                vol_threshold = vol_sma.iloc[i] + 0.5 * vol_std.iloc[i]
                
                # Volume spike
                if current['volume'] > vol_threshold:
                    # Volume divergence check
                    prev_high = df['high'].iloc[i-1] if i > -len(df) else current['high']
                    prev_low = df['low'].iloc[i-1] if i > -len(df) else current['low']
                    prev_vol = df['volume'].iloc[i-1] if i > -len(df) else current['volume']
                    
                    if current['high'] > prev_high and current['volume'] < prev_vol:
                        signal_type = 'volume_divergence_bearish'
                    elif current['low'] < prev_low and current['volume'] < prev_vol:
                        signal_type = 'volume_divergence_bullish'
                    else:
                        signal_type = 'volume_spike'
                    
                    signals.append(SMTSignal(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        signal_type=signal_type,
                        strength=min((current['volume'] / vol_sma.iloc[i]) / 3.0, 1.0),
                        es_price=current['close'],
                        nq_price=current['close'],
                        divergence_percentage=0.0,
                        confirmation_status=current['volume'] > vol_threshold * 2,
                        details={
                            'volume': current['volume'],
                            'avg_volume': vol_sma.iloc[i],
                            'volume_ratio': current['volume'] / vol_sma.iloc[i]
                        }
                    ))
            
            return signals
        except Exception as e:
            logger.error(f"Volume anomaly error: {e}")
            return []

class ManipulationPhaseDetector(BaseAnalyzer):
    def detect_manipulation_phase(self, data: List[OHLCVData]) -> List[SMTSignal]:
        try:
            if len(data) < 100:
                return []
            
            df = self._ohlcv_to_df(data)
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            
            # Quarterly cycle detection (simplified)
            now = datetime.now(timezone.utc)
            quarter_start = datetime(now.year, ((now.month - 1) // 3) * 3 + 1, 1, tzinfo=timezone.utc)
            days_in_quarter = (now - quarter_start).days
            quarter_length = 90  # approximate
            
            # Q2 phase detection (25% - 50% of quarter)
            if 0.25 * quarter_length <= days_in_quarter <= 0.5 * quarter_length:
                # Look for Judas Swing
                q1_end_idx = int(len(df) * 0.75)  # Q1 period
                q1_high = df['high'].iloc[:q1_end_idx].max()
                q1_low = df['low'].iloc[:q1_end_idx].min()
                
                recent_data = df.iloc[-10:]  # Last 10 bars
                
                for i in range(len(recent_data) - 2):
                    current = recent_data.iloc[i]
                    next_bar = recent_data.iloc[i + 1]
                    
                    # Judas Swing up then down
                    if (current['high'] > q1_high and next_bar['close'] < q1_high):
                        return [SMTSignal(
                            timestamp=datetime.now(timezone.utc).isoformat(),
                            signal_type='judas_swing_bearish',
                            strength=0.9,
                            es_price=current['close'],
                            nq_price=current['close'],
                            divergence_percentage=0.0,
                            confirmation_status=True,
                            details={
                                'q1_high': q1_high,
                                'break_high': current['high'],
                                'return_close': next_bar['close'],
                                'quarter_phase': 'Q2'
                            }
                        )]
                    
                    # Judas Swing down then up
                    if (current['low'] < q1_low and next_bar['close'] > q1_low):
                        return [SMTSignal(
                            timestamp=datetime.now(timezone.utc).isoformat(),
                            signal_type='judas_swing_bullish',
                            strength=0.9,
                            es_price=current['close'],
                            nq_price=current['close'],
                            divergence_percentage=0.0,
                            confirmation_status=True,
                            details={
                                'q1_low': q1_low,
                                'break_low': current['low'],
                                'return_close': next_bar['close'],
                                'quarter_phase': 'Q2'
                            }
                        )]
            
            return []
        except Exception as e:
            logger.error(f"Manipulation phase error: {e}")
            return []

class SmartMoneyAnalyzer:
    def __init__(self):
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.smt_detector = SMTDivergenceDetector()
        self.stop_hunt_detector = StopHuntDetector()
        self.true_open_calc = TrueOpenCalculator()
        self.volume_detector = VolumeAnomalyDetector()
        self.manipulation_detector = ManipulationPhaseDetector()

    async def analyze_all(self, market_data: Dict[str, MarketSnapshot]) -> List[SMTSignal]:
        try:
            es_data = market_data.get('ES=F')
            nq_data = market_data.get('NQ=F')
            
            if not es_data or not nq_data:
                logger.warning("Missing ES or NQ futures data")
                return []

            all_signals = []
            
            # SMT Divergence detection
            all_signals.extend(self.smt_detector.detect_smt_divergence(
                es_data.ohlcv_15m, nq_data.ohlcv_15m))
            
            # Stop Hunt / False Breaks
            all_signals.extend(self.stop_hunt_detector.detect_false_breaks(es_data.ohlcv_15m))
            all_signals.extend(self.stop_hunt_detector.detect_false_breaks(nq_data.ohlcv_15m))
            
            # Volume Anomalies
            all_signals.extend(self.volume_detector.detect_volume_anomalies(es_data.ohlcv_15m))
            all_signals.extend(self.volume_detector.detect_volume_anomalies(nq_data.ohlcv_15m))
            
            # Manipulation Phase
            all_signals.extend(self.manipulation_detector.detect_manipulation_phase(es_data.ohlcv_1d))
            
            # True Open filtering
            es_opens = self.true_open_calc.get_true_opens(es_data.ohlcv_1d)
            nq_opens = self.true_open_calc.get_true_opens(nq_data.ohlcv_1d)
            
            filtered_signals = self._filter_by_true_open(all_signals, es_opens, nq_opens)
            
            await self._cache_signals(filtered_signals)
            logger.info(f"Generated {len(filtered_signals)} Smart Money signals")
            return filtered_signals
            
        except Exception as e:
            logger.error(f"Smart Money analysis error: {e}")
            return []

    def _filter_by_true_open(self, signals: List[SMTSignal], es_opens: Dict, nq_opens: Dict) -> List[SMTSignal]:
        if not es_opens.get('daily') or not nq_opens.get('daily'):
            return signals
        
        filtered = []
        for signal in signals:
            daily_to = (es_opens['daily'] + nq_opens['daily']) / 2
            current_price = (signal.es_price + signal.nq_price) / 2
            
            # Long signals below True Open, Short signals above True Open
            if ('bullish' in signal.signal_type and current_price < daily_to) or \
               ('bearish' in signal.signal_type and current_price > daily_to):
                signal.details['true_open_filter'] = 'passed'
                signal.details['daily_to'] = daily_to
                filtered.append(signal)
            else:
                signal.details['true_open_filter'] = 'failed'
                signal.strength *= 0.5  # Reduce strength but keep signal
                filtered.append(signal)
        
        return filtered

    async def get_cached_signals(self, limit: int = 50) -> List[SMTSignal]:
        try:
            cached = await self.redis_client.get("smart_money_signals")
            if cached:
                data = json.loads(cached)
                return [SMTSignal(**s) for s in data][:limit]
        except Exception as e:
            logger.error(f"Cache error: {e}")
        return []

    async def _cache_signals(self, signals: List[SMTSignal]):
        try:
            data = [asdict(s) for s in signals]
            await self.redis_client.setex("smart_money_signals", 300, json.dumps(data, default=str))
        except Exception as e:
            logger.error(f"Cache error: {e}")

# Legacy compatibility
SMTAnalyzer = SmartMoneyAnalyzer