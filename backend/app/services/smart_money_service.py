import redis.asyncio as redis
import json
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timezone, time
from app.core.config import settings
from app.core.settings_manager import SettingsManager
from app.core.data_models import OHLCV, Signal
from app.services.market_data_collector import MarketSnapshot
from app.analyzers.smt_analyzer import SMTAnalyzer
from app.analyzers.volume_analyzer import VolumeAnalyzer

logger = logging.getLogger(__name__)

class SmartMoneyService:
    def __init__(self):
        self.redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.settings = SettingsManager()
        self.smt_analyzer = SMTAnalyzer()
        self.volume_analyzer = VolumeAnalyzer()

    async def analyze(self, market_data: Dict[str, MarketSnapshot], custom_params: Optional[Dict[str, Any]] = None) -> List[Signal]:
        try:
            # Получаем настройки с учетом кастомных параметров
            current_settings = await self._get_effective_settings(custom_params)
            
            # Извлекаем данные ES и NQ
            es_data = market_data.get('ES=F')
            nq_data = market_data.get('NQ=F')
            
            if not es_data or not nq_data:
                logger.warning("Missing ES or NQ data for analysis")
                return []

            # Проверяем активную торговую сессию
            if not self._is_active_session():
                logger.info("Outside active trading session")
                return []

            # Конвертируем данные MarketSnapshot в OHLCV
            es_ohlcv = self._convert_snapshot_to_ohlcv(es_data)
            nq_ohlcv = self._convert_snapshot_to_ohlcv(nq_data)
            
            if not es_ohlcv or not nq_ohlcv:
                logger.warning("No OHLCV data available for analysis")
                return []

            signals = []
            
            # SMT анализ (дивергенция между ES и NQ)
            smt_signals = self.smt_analyzer.analyze(
                es_ohlcv, nq_ohlcv, 
                threshold=current_settings.get('divergence_threshold', 0.5),
                confirmation_candles=current_settings.get('confirmation_candles', 3)
            )
            signals.extend(smt_signals)
            
            # Объемный анализ для ES
            es_volume_signals = self.volume_analyzer.analyze(
                es_ohlcv,
                volume_multiplier=current_settings.get('volume_multiplier', 2.0)
            )
            signals.extend(es_volume_signals)
            
            # Объемный анализ для NQ
            nq_volume_signals = self.volume_analyzer.analyze(
                nq_ohlcv,
                volume_multiplier=current_settings.get('volume_multiplier', 2.0)
            )
            signals.extend(nq_volume_signals)
            
            # Фильтрация по силе сигнала
            strength_threshold = current_settings.get('smt_strength_threshold', 0.7)
            filtered_signals = [s for s in signals if s.strength >= strength_threshold]
            
            # Ограничение количества сигналов
            max_signals = current_settings.get('max_signals_display', 10)
            final_signals = sorted(filtered_signals, key=lambda x: x.strength, reverse=True)[:max_signals]
            
            # Кэшируем результаты
            await self._cache_signals(final_signals)
            
            logger.info(f"Analysis completed: {len(final_signals)} signals generated")
            return final_signals
            
        except Exception as e:
            logger.error(f"Analysis error: {e}")
            return []

    def _convert_snapshot_to_ohlcv(self, snapshot: MarketSnapshot) -> List[OHLCV]:
        """Конвертация MarketSnapshot в список OHLCV"""
        try:
            # Используем 15m данные для анализа
            if hasattr(snapshot, 'ohlcv_15m') and snapshot.ohlcv_15m:
                return [OHLCV(
                    timestamp=item.timestamp,
                    open=item.open,
                    high=item.high,
                    low=item.low,
                    close=item.close,
                    volume=item.volume
                ) for item in snapshot.ohlcv_15m]
            
            # Fallback к 5m данным
            elif hasattr(snapshot, 'ohlcv_5m') and snapshot.ohlcv_5m:
                return [OHLCV(
                    timestamp=item.timestamp,
                    open=item.open,
                    high=item.high,
                    low=item.low,
                    close=item.close,
                    volume=item.volume
                ) for item in snapshot.ohlcv_5m]
            
            return []
            
        except Exception as e:
            logger.error(f"Error converting snapshot to OHLCV: {e}")
            return []

    async def _get_effective_settings(self, custom_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Получение эффективных настроек с учетом кастомных параметров"""
        try:
            # Базовые настройки
            base_settings = {
                'smt_strength_threshold': self.settings.get('smt_strength_threshold', 0.7),
                'divergence_threshold': self.settings.get('divergence_threshold', 0.5),
                'confirmation_candles': self.settings.get('confirmation_candles', 3),
                'volume_multiplier': self.settings.get('volume_multiplier', 2.0),
                'max_signals_display': self.settings.get('max_signals_display', 10),
                'refresh_interval': self.settings.get('refresh_interval', 30000),
            }
            
            # Применяем кастомные параметры если есть
            if custom_params:
                base_settings.update(custom_params)
                
            return base_settings
            
        except Exception as e:
            logger.error(f"Error getting effective settings: {e}")
            return {
                'smt_strength_threshold': 0.7,
                'divergence_threshold': 0.5,
                'confirmation_candles': 3,
                'volume_multiplier': 2.0,
                'max_signals_display': 10,
                'refresh_interval': 30000,
            }

    def _is_active_session(self) -> bool:
        """Проверка активной торговой сессии"""
        try:
            now = datetime.now(timezone.utc).time()
            
            # London session: 08:00-16:00 UTC
            london_start = time(8, 0)
            london_end = time(16, 0)
            
            # New York session: 13:30-22:00 UTC
            ny_start = time(13, 30)
            ny_end = time(22, 0)
            
            # Asia session: 00:00-09:00 UTC
            asia_start = time(0, 0)
            asia_end = time(9, 0)
            
            return (london_start <= now <= london_end or
                   ny_start <= now <= ny_end or
                   asia_start <= now <= asia_end)
                   
        except Exception as e:
            logger.error(f"Error checking active session: {e}")
            return True  # По умолчанию считаем сессию активной

    async def _cache_signals(self, signals: List[Signal]):
        """Кэширование сигналов в Redis"""
        try:
            # Конвертируем сигналы в JSON-сериализуемый формат
            signals_data = []
            for signal in signals:
                signal_dict = {
                    'timestamp': signal.timestamp,
                    'type': signal.type,
                    'strength': signal.strength,
                    'details': getattr(signal, 'details', {}),
                    'confirmed': getattr(signal, 'confirmed', False),
                    'es_price': getattr(signal, 'es_price', 0.0),
                    'nq_price': getattr(signal, 'nq_price', 0.0),
                    'divergence_pct': getattr(signal, 'divergence_pct', 0.0),
                }
                signals_data.append(signal_dict)
            
            # Кэшируем на 5 минут
            await self.redis.setex(
                "smart_money_signals", 
                300, 
                json.dumps(signals_data, default=str)
            )
            
            logger.debug(f"Cached {len(signals)} signals")
            
        except Exception as e:
            logger.error(f"Cache error: {e}")

    async def get_cached_signals(self, limit: int = 50) -> List[Signal]:
        """Получение кэшированных сигналов"""
        try:
            cached = await self.redis.get("smart_money_signals")
            if not cached:
                logger.info("No cached signals found")
                return []
                
            signals_data = json.loads(cached)
            signals = []
            
            for data in signals_data:
                # Создаем объект Signal из кэшированных данных
                signal = Signal(
                    timestamp=data.get('timestamp', datetime.now(timezone.utc).isoformat()),
                    type=data.get('type', 'unknown'),
                    strength=float(data.get('strength', 0.0))
                )
                
                # Добавляем дополнительные атрибуты
                for key, value in data.items():
                    if key not in ['timestamp', 'type', 'strength']:
                        setattr(signal, key, value)
                
                signals.append(signal)
            
            # Применяем фильтр по силе из настроек
            threshold = self.settings.get('smt_strength_threshold', 0.7)
            filtered_signals = [s for s in signals if s.strength >= threshold]
            
            # Ограничиваем количество
            result = sorted(filtered_signals, key=lambda x: x.strength, reverse=True)[:limit]
            
            logger.info(f"Retrieved {len(result)} cached signals")
            return result
            
        except Exception as e:
            logger.error(f"Cache retrieval error: {e}")
            return []

    async def health_check(self) -> Dict[str, Any]:
        """Проверка работоспособности сервиса"""
        health_status = {
            "service": "smart_money_service",
            "status": "healthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "checks": {}
        }
        
        try:
            # Проверка Redis
            await self.redis.ping()
            health_status["checks"]["redis"] = "healthy"
            
            # Проверка анализаторов
            health_status["checks"]["smt_analyzer"] = "healthy" if self.smt_analyzer else "missing"
            health_status["checks"]["volume_analyzer"] = "healthy" if self.volume_analyzer else "missing"
            
            # Проверка настроек
            settings_check = self.settings.get('smt_strength_threshold')
            health_status["checks"]["settings"] = "healthy" if settings_check is not None else "degraded"
            
        except Exception as e:
            health_status["checks"]["redis"] = f"unhealthy: {e}"
            health_status["status"] = "degraded"
        
        return health_status