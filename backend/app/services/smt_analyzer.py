import asyncio
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timezone, time, date
from typing import Dict, List, Optional, Any
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
    signal_type: str  # 'bullish_divergence', 'bearish_divergence', 'mss_break', 'order_block', 'fvg', 'quarterly_shift'
    strength: float
    nasdaq_price: float
    sp500_price: float
    divergence_percentage: float
    confirmation_status: bool
    details: Dict[str, Any]

@dataclass
class KillzoneInfo:
    current: Optional[str]
    time_remaining: str
    next_session: str
    priority: str  # 'high', 'medium', 'low'

class KillzoneManager:
    KILLZONES = {
        'asia': {'start': time(20, 0), 'end': time(23, 59), 'priority': 'low'},
        'london': {'start': time(2, 0), 'end': time(5, 0), 'priority': 'high'},
        'ny_am': {'start': time(14, 30), 'end': time(16, 0), 'priority': 'high'},
        'ny_lunch': {'start': time(17, 0), 'end': time(18, 0), 'priority': 'medium'},
        'ny_pm': {'start': time(18, 30), 'end': time(21, 0), 'priority': 'medium'}
    }

    def get_killzone_info(self) -> KillzoneInfo:
        current_time = datetime.now(pytz.UTC).time()
        current_zone = None
        priority = 'low'
        for zone_name, zone_config in self.KILLZONES.items():
            if zone_config['start'] <= current_time <= zone_config['end']:
                current_zone = zone_name
                priority = zone_config['priority']
                break
        next_session = self._get_next_session(current_time)
        time_remaining = self._calculate_time_remaining(current_time, current_zone)
        return KillzoneInfo(
            current=current_zone,
            time_remaining=time_remaining,
            next_session=next_session,
            priority=priority
        )

    def _get_next_session(self, current_time: time) -> str:
        for zone_name, zone_config in self.KILLZONES.items():
            if current_time < zone_config['start']:
                return zone_name
        return 'asia'

    def _calculate_time_remaining(self, current_time: time, current_zone: Optional[str]) -> str:
        if not current_zone:
            return "Market closed"
        zone_end = self.KILLZONES[current_zone]['end']
        current_dt = datetime.combine(date.today(), current_time)
        end_dt = datetime.combine(date.today(), zone_end)
        remaining = end_dt - current_dt
        hours, rem = divmod(remaining.seconds, 3600)
        minutes, _ = divmod(rem, 60)
        return f"{hours}h {minutes}m"

class DivergenceDetector:
    def __init__(self):
        self.settings = SettingsManager()

    def detect_divergence(self, nasdaq_data: List[OHLCVData], sp500_data: List[OHLCVData]) -> List[SMTSignal]:
        lookback = self.settings.lookback_period
        thresh = self.settings.min_divergence_threshold
        if len(nasdaq_data) < lookback or len(sp500_data) < lookback:
            return []
        signals: List[SMTSignal] = []
        nasdaq_df = self._ohlcv_to_df(nasdaq_data[-lookback:])
        sp500_df = self._ohlcv_to_df(sp500_data[-lookback:])
        nasdaq_change = (nasdaq_df['close'].iloc[-1] / nasdaq_df['close'].iloc[0] - 1) * 100
        sp500_change = (sp500_df['close'].iloc[-1] / sp500_df['close'].iloc[0] - 1) * 100
        divergence_pct = abs(nasdaq_change - sp500_change)
        if divergence_pct >= thresh:
            signal_type = 'bullish_divergence' if nasdaq_change > sp500_change else 'bearish_divergence'
            signals.append(SMTSignal(
                timestamp=datetime.now(timezone.utc).isoformat(),
                signal_type=signal_type,
                strength=min(divergence_pct / 2.0, 1.0),
                nasdaq_price=nasdaq_df['close'].iloc[-1],
                sp500_price=sp500_df['close'].iloc[-1],
                divergence_percentage=divergence_pct,
                confirmation_status=divergence_pct > thresh * 2,
                details={'lookback_period': lookback}
            ))
        return signals

    def _ohlcv_to_df(self, data: List[OHLCVData]) -> pd.DataFrame:
        return pd.DataFrame([{
            'timestamp': item.timestamp,
            'open': item.open,
            'high': item.high,
            'low': item.low,
            'close': item.close,
            'volume': item.volume
        } for item in data])

class MarketStructureAnalyzer:
    def __init__(self):
        self.settings = SettingsManager()

    def detect_mss(self, data: List[OHLCVData]) -> List[SMTSignal]:
        swings = self.settings.lookback_swings
        thresh = self.settings.swing_threshold
        if len(data) < swings * 2:
            return []
        signals: List[SMTSignal] = []
        df = self._ohlcv_to_df(data)
        highs = df['high'].rolling(3, center=True).max()
        lows = df['low'].rolling(3, center=True).min()
        current_price = df['close'].iloc[-1]
        recent_high = highs.iloc[-swings-1:-1].max()
        recent_low = lows.iloc[-swings-1:-1].min()
        if current_price > recent_high * (1 + thresh/100):
            signals.append(SMTSignal(
                timestamp=datetime.now(timezone.utc).isoformat(),
                signal_type='mss_break',
                strength=1.0,
                nasdaq_price=current_price,
                sp500_price=current_price,
                divergence_percentage=0.0,
                confirmation_status=True,
                details={'break_type': 'bullish', 'level': recent_high}
            ))
        elif current_price < recent_low * (1 - thresh/100):
            signals.append(SMTSignal(
                timestamp=datetime.now(timezone.utc).isoformat(),
                signal_type='mss_break',
                strength=1.0,
                nasdaq_price=current_price,
                sp500_price=current_price,
                divergence_percentage=0.0,
                confirmation_status=True,
                details={'break_type': 'bearish', 'level': recent_low}
            ))
        return signals

    def _ohlcv_to_df(self, data: List[OHLCVData]) -> pd.DataFrame:
        return pd.DataFrame([{
            'timestamp': item.timestamp,
            'open': item.open,
            'high': item.high,
            'low': item.low,
            'close': item.close,
            'volume': item.volume
        } for item in data])

class OrderBlockDetector:
    def __init__(self):
        self.settings = SettingsManager()

    def detect_order_blocks(self, data: List[OHLCVData]) -> List[SMTSignal]:
        min_size = self.settings.min_block_size
        vol_thr = self.settings.volume_threshold
        if len(data) < 20:
            return []
        signals: List[SMTSignal] = []
        df = self._ohlcv_to_df(data)
        atr = self._calculate_atr(df, 14)
        avg_volume = df['volume'].rolling(20).mean().iloc[-1]
        for i in range(-5, -1):
            candle = df.iloc[i]
            body = abs(candle['close'] - candle['open'])
            vol_ratio = candle['volume'] / avg_volume
            if body > atr * (min_size / 100) and vol_ratio > vol_thr:
                block_type = 'bullish' if candle['close'] > candle['open'] else 'bearish'
                signals.append(SMTSignal(
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    signal_type='order_block',
                    strength=min(vol_ratio / 3.0, 1.0),
                    nasdaq_price=candle['close'],
                    sp500_price=candle['close'],
                    divergence_percentage=0.0,
                    confirmation_status=vol_ratio > vol_thr * 2,
                    details={'block_type': block_type, 'high': candle['high'], 'low': candle['low'], 'volume_ratio': vol_ratio}
                ))
        return signals

    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> float:
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        return true_range.rolling(window=period).mean().iloc[-1]

    def _ohlcv_to_df(self, data: List[OHLCVData]) -> pd.DataFrame:
        return pd.DataFrame([{
            'timestamp': item.timestamp,
            'open': item.open,
            'high': item.high,
            'low': item.low,
            'close': item.close,
            'volume': item.volume
        } for item in data])

class FairValueGapDetector:
    def __init__(self):
        self.settings = SettingsManager()

    def detect_fvg(self, data: List[OHLCVData]) -> List[SMTSignal]:
        gap_min = self.settings.min_fvg_gap_size
        if len(data) < 3:
            return []
        signals: List[SMTSignal] = []
        for i in range(len(data) - 3, len(data) - 1):
            if i < 0:
                continue
            c1, c2, c3 = data[i], data[i+1], data[i+2]
            # Bullish
            if c1.high < c3.low:
                gap = (c3.low - c1.high) / c2.close * 100
                if gap >= gap_min:
                    signals.append(SMTSignal(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        signal_type='fvg',
                        strength=min(gap / 1.0, 1.0),
                        nasdaq_price=c3.close,
                        sp500_price=c3.close,
                        divergence_percentage=0.0,
                        confirmation_status=gap > gap_min * 2,
                        details={'gap_type':'bullish','gap_high':c3.low,'gap_low':c1.high,'gap_size_pct':gap}
                    ))
            # Bearish
            elif c1.low > c3.high:
                gap = (c1.low - c3.high) / c2.close * 100
                if gap >= gap_min:
                    signals.append(SMTSignal(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        signal_type='fvg',
                        strength=min(gap / 1.0, 1.0),
                        nasdaq_price=c3.close,
                        sp500_price=c3.close,
                        divergence_percentage=0.0,
                        confirmation_status=gap > gap_min * 2,
                        details={'gap_type':'bearish','gap_high':c1.low,'gap_low':c3.high,'gap_size_pct':gap}
                    ))
        return signals

class QuarterlyTheoryAnalyzer:
    def __init__(self):
        self.settings = SettingsManager()

    def analyze_quarterly_signals(self, data: List[OHLCVData]) -> List[SMTSignal]:
        months = self.settings.quarterly_months
        bias_days = self.settings.monthly_bias_days
        signals: List[SMTSignal] = []
        now = datetime.now(timezone.utc)
        if now.month in months and now.day in bias_days and len(data) >= 5:
            recent = data[-5:]
            vol = self._calculate_volatility(recent)
            signals.append(SMTSignal(
                timestamp=now.isoformat(),
                signal_type='quarterly_shift',
                strength=0.9,
                nasdaq_price=data[-1].close,
                sp500_price=data[-1].close,
                divergence_percentage=0.0,
                confirmation_status=True,
                details={'period_type':'quarterly','volatility':vol,'quarter':(now.month-1)//3+1}
            ))
        return signals

    def _calculate_volatility(self, data: List[OHLCVData]) -> float:
        prices = [c.close for c in data]
        if len(prices) < 2:
            return 0.0
        returns = [abs(prices[i] - prices[i-1]) / prices[i-1] for i in range(1, len(prices))]
        return sum(returns)/len(returns)*100

class SMTAnalyzer:
    def __init__(self):
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.killzone_manager = KillzoneManager()
        self.divergence_detector = DivergenceDetector()
        self.mss_analyzer = MarketStructureAnalyzer()
        self.order_block_detector = OrderBlockDetector()
        self.fvg_detector = FairValueGapDetector()
        self.quarterly_analyzer = QuarterlyTheoryAnalyzer()

    async def analyze_all(self, market_data: Dict[str, MarketSnapshot]) -> List[SMTSignal]:
        all_signals: List[SMTSignal] = []
        try:
            nasdaq = market_data.get('QQQ')
            sp500 = market_data.get('SPY')
            if not nasdaq or not sp500:
                logger.warning("Missing NASDAQ or S&P500 data for SMT analysis")
                return []
            all_signals.extend(
                self.divergence_detector.detect_divergence(nasdaq.ohlcv_5m, sp500.ohlcv_5m)
            )
            for snapshot in market_data.values():
                all_signals.extend(self.mss_analyzer.detect_mss(snapshot.ohlcv_5m))
                all_signals.extend(self.order_block_detector.detect_order_blocks(snapshot.ohlcv_5m))
                all_signals.extend(self.fvg_detector.detect_fvg(snapshot.ohlcv_5m))
                all_signals.extend(self.quarterly_analyzer.analyze_quarterly_signals(snapshot.ohlcv_5m))
            await self._cache_signals(all_signals)
            logger.info(f"Generated {len(all_signals)} SMT signals")
            return all_signals
        except Exception as e:
            logger.error(f"Error in SMT analysis: {e}")
            return []

    async def get_cached_signals(self, limit: int = 50) -> List[SMTSignal]:
        try:
            cached = await self.redis_client.get("smt_signals")
            if cached:
                data = json.loads(cached)
                signals = [SMTSignal(**s) for s in data]
                return signals[:limit]
        except Exception as e:
            logger.error(f"Error getting cached signals: {e}")
        return []

    async def _cache_signals(self, signals: List[SMTSignal]):
        try:
            data = [asdict(s) for s in signals]
            await self.redis_client.setex("smt_signals", 300, json.dumps(data, default=str))
        except Exception as e:
            logger.error(f"Error caching signals: {e}")
