import asyncio
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timezone, time, date, timedelta
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
    """Управление торговыми сессиями и killzones"""
    
    KILLZONES = {
        'asia': {'start': time(20, 0), 'end': time(23, 59), 'priority': 'low'},
        'london': {'start': time(2, 0), 'end': time(5, 0), 'priority': 'high'},
        'ny_am': {'start': time(14, 30), 'end': time(16, 0), 'priority': 'high'},
        'ny_lunch': {'start': time(17, 0), 'end': time(18, 0), 'priority': 'medium'},
        'ny_pm': {'start': time(18, 30), 'end': time(21, 0), 'priority': 'medium'}
    }

    def get_killzone_info(self) -> KillzoneInfo:
        """Получить информацию о текущей торговой сессии"""
        try:
            current_time = datetime.now(pytz.UTC).time()
            current_zone = None
            priority = 'low'
            
            # Найти текущую зону
            for zone_name, zone_config in self.KILLZONES.items():
                if self._is_time_in_range(current_time, zone_config['start'], zone_config['end']):
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
        except Exception as e:
            logger.error(f"Error getting killzone info: {e}")
            return KillzoneInfo(
                current=None,
                time_remaining="Unknown",
                next_session="Unknown",
                priority="low"
            )

    def _is_time_in_range(self, current: time, start: time, end: time) -> bool:
        """Проверить, находится ли время в диапазоне"""
        if start <= end:
            return start <= current <= end
        else:  # Переход через полночь
            return current >= start or current <= end

    def _get_next_session(self, current_time: time) -> str:
        """Получить следующую торговую сессию"""
        try:
            current_minutes = current_time.hour * 60 + current_time.minute
            next_zone = None
            min_diff = float('inf')
            
            for zone_name, zone_config in self.KILLZONES.items():
                start_minutes = zone_config['start'].hour * 60 + zone_config['start'].minute
                
                # Разница до начала зоны
                if start_minutes > current_minutes:
                    diff = start_minutes - current_minutes
                else:
                    diff = (24 * 60) - current_minutes + start_minutes  # Следующий день
                
                if diff < min_diff:
                    min_diff = diff
                    next_zone = zone_name
            
            return next_zone or 'asia'
        except Exception as e:
            logger.error(f"Error calculating next session: {e}")
            return 'unknown'

    def _calculate_time_remaining(self, current_time: time, current_zone: Optional[str]) -> str:
        """Рассчитать оставшееся время в текущей зоне"""
        try:
            if not current_zone:
                return "Market closed"
            
            zone_end = self.KILLZONES[current_zone]['end']
            
            # Преобразуем в минуты для удобства расчета
            current_minutes = current_time.hour * 60 + current_time.minute
            end_minutes = zone_end.hour * 60 + zone_end.minute
            
            if end_minutes > current_minutes:
                remaining_minutes = end_minutes - current_minutes
            else:
                # Переход через полночь
                remaining_minutes = (24 * 60) - current_minutes + end_minutes
            
            hours = remaining_minutes // 60
            minutes = remaining_minutes % 60
            
            return f"{hours}h {minutes}m"
        except Exception as e:
            logger.error(f"Error calculating time remaining: {e}")
            return "Unknown"

class DivergenceDetector:
    """Детектор дивергенций между NASDAQ и S&P500"""
    
    def __init__(self):
        self.settings = SettingsManager()

    def detect_divergence(self, nasdaq_data: List[OHLCVData], sp500_data: List[OHLCVData]) -> List[SMTSignal]:
        """Обнаружение дивергенций"""
        try:
            lookback = self.settings.lookback_period
            thresh = self.settings.min_divergence_threshold
            
            if len(nasdaq_data) < lookback or len(sp500_data) < lookback:
                return []
            
            signals: List[SMTSignal] = []
            
            # Преобразуем в DataFrame для удобства расчетов
            nasdaq_df = self._ohlcv_to_df(nasdaq_data[-lookback:])
            sp500_df = self._ohlcv_to_df(sp500_data[-lookback:])
            
            if nasdaq_df.empty or sp500_df.empty:
                return []
            
            # Рассчитаем изменения цен в процентах
            nasdaq_change = (nasdaq_df['close'].iloc[-1] / nasdaq_df['close'].iloc[0] - 1) * 100
            sp500_change = (sp500_df['close'].iloc[-1] / sp500_df['close'].iloc[0] - 1) * 100
            
            divergence_pct = abs(nasdaq_change - sp500_change)
            
            if divergence_pct >= thresh:
                signal_type = 'bullish_divergence' if nasdaq_change > sp500_change else 'bearish_divergence'
                
                signals.append(SMTSignal(
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    signal_type=signal_type,
                    strength=min(divergence_pct / 2.0, 1.0),
                    nasdaq_price=float(nasdaq_df['close'].iloc[-1]),
                    sp500_price=float(sp500_df['close'].iloc[-1]),
                    divergence_percentage=float(divergence_pct),
                    confirmation_status=divergence_pct > thresh * 2,
                    details={
                        'lookback_period': lookback,
                        'nasdaq_change': float(nasdaq_change),
                        'sp500_change': float(sp500_change)
                    }
                ))
            
            return signals
        except Exception as e:
            logger.error(f"Error detecting divergence: {e}")
            return []

    def _ohlcv_to_df(self, data: List[OHLCVData]) -> pd.DataFrame:
        """Преобразование OHLCV данных в DataFrame"""
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

class MarketStructureAnalyzer:
    """Анализатор рыночной структуры (MSS)"""
    
    def __init__(self):
        self.settings = SettingsManager()

    def detect_mss(self, data: List[OHLCVData]) -> List[SMTSignal]:
        """Обнаружение пробоев рыночной структуры"""
        try:
            swings = self.settings.lookback_swings
            thresh = self.settings.swing_threshold
            
            if len(data) < swings * 2:
                return []
            
            signals: List[SMTSignal] = []
            df = self._ohlcv_to_df(data)
            
            if df.empty or len(df) < swings * 2:
                return []
            
            # Найдем локальные максимумы и минимумы
            highs = df['high'].rolling(window=3, center=True).max()
            lows = df['low'].rolling(window=3, center=True).min()
            
            current_price = float(df['close'].iloc[-1])
            
            # Найдем недавние значимые уровни
            recent_high = float(highs.iloc[-swings-1:-1].max())
            recent_low = float(lows.iloc[-swings-1:-1].min())
            
            # Проверка на пробой структуры
            if current_price > recent_high * (1 + thresh/100):
                signals.append(SMTSignal(
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    signal_type='mss_break',
                    strength=1.0,
                    nasdaq_price=current_price,
                    sp500_price=current_price,
                    divergence_percentage=0.0,
                    confirmation_status=True,
                    details={
                        'break_type': 'bullish',
                        'level': recent_high,
                        'current_price': current_price,
                        'break_percentage': ((current_price / recent_high) - 1) * 100
                    }
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
                    details={
                        'break_type': 'bearish',
                        'level': recent_low,
                        'current_price': current_price,
                        'break_percentage': ((recent_low / current_price) - 1) * 100
                    }
                ))
            
            return signals
        except Exception as e:
            logger.error(f"Error detecting MSS: {e}")
            return []

    def _ohlcv_to_df(self, data: List[OHLCVData]) -> pd.DataFrame:
        """Преобразование OHLCV данных в DataFrame"""
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

class OrderBlockDetector:
    """Детектор ордер-блоков"""
    
    def __init__(self):
        self.settings = SettingsManager()

    def detect_order_blocks(self, data: List[OHLCVData]) -> List[SMTSignal]:
        """Обнаружение ордер-блоков"""
        try:
            min_size = self.settings.min_block_size
            vol_thr = self.settings.volume_threshold
            
            if len(data) < 20:
                return []
            
            signals: List[SMTSignal] = []
            df = self._ohlcv_to_df(data)
            
            if df.empty or len(df) < 20:
                return []
            
            # Рассчитаем ATR для определения размера тела свечи
            atr = self._calculate_atr(df, 14)
            avg_volume = float(df['volume'].rolling(20).mean().iloc[-1])
            
            # Проверим последние 5 свечей на налич