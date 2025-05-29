import asyncio
from fastapi import FastAPI
import logging
from datetime import datetime, timezone
from typing import Dict, Any

from app.services.market_data_collector import MarketDataCollector, MarketSnapshot
from app.services.smart_money_service import SmartMoneyService
from app.core.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)

class BackgroundTaskManager:
    def __init__(self, collector: MarketDataCollector, smt_service: SmartMoneyService, ws_manager: WebSocketManager):
        self.collector = collector
        self.smt_service = smt_service
        self.ws_manager = ws_manager
        self.task = None
        self.running = False
        self.last_run = None
        
    async def start(self):
        if self.running:
            return
        self.running = True
        self.task = asyncio.create_task(self._run_loop())
        logger.info("Background tasks started")
        
    async def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("Background tasks stopped")
        
    async def _run_loop(self):
        while self.running:
            start_time = asyncio.get_event_loop().time()
            
            try:
                # Собираем рыночные данные
                market_data = await self.collector.collect_realtime_data()
                
                if market_data:
                    # Анализируем данные без кастомных параметров (используем настройки по умолчанию)
                    signals = await self.smt_service.analyze(market_data)
                    
                    # Подготавливаем данные для рассылки
                    broadcast_data = self._prepare_broadcast_data(market_data, signals)
                    
                    # Отправляем данные через WebSocket
                    try:
                        await self.ws_manager.broadcast(broadcast_data)
                        logger.debug(f"Broadcasted: {len(market_data)} symbols, {len(signals)} signals")
                    except Exception as ws_error:
                        logger.error(f"WebSocket broadcast failed: {ws_error}")
                        
                    self.last_run = datetime.now(timezone.utc)
                else:
                    logger.warning("No market data collected")
                
            except Exception as e:
                logger.error(f"Background task error: {e}")
                
            # Рассчитываем время ожидания до следующего запуска
            elapsed = asyncio.get_event_loop().time() - start_time
            sleep_time = max(0, 30 - elapsed)  # Запуск каждые 30 секунд
            
            try:
                await asyncio.sleep(sleep_time)
            except asyncio.CancelledError:
                break
                
    def _prepare_broadcast_data(self, market_data: Dict[str, MarketSnapshot], signals: list) -> Dict[str, Any]:
        """Подготовка данных для WebSocket рассылки"""
        try:
            # Конвертируем рыночные данные
            market_dict = {}
            for symbol, snap in market_data.items():
                try:
                    market_dict[symbol] = {
                        "symbol": snap.symbol,
                        "current_price": float(snap.current_price),
                        "change_percent": float(snap.change_percent),
                        "volume": int(snap.volume),
                        "timestamp": snap.timestamp,
                        "market_state": snap.market_state,
                        "technical_indicators": {
                            "rsi": float(snap.technical_indicators.rsi),
                            "sma_20": float(snap.technical_indicators.sma_20),
                            "ema_12": float(snap.technical_indicators.ema_12),
                            "ema_26": float(snap.technical_indicators.ema_26),
                            "macd": float(snap.technical_indicators.macd),
                            "macd_signal": float(snap.technical_indicators.macd_signal),
                            "bollinger_upper": float(snap.technical_indicators.bollinger_upper),
                            "bollinger_lower": float(snap.technical_indicators.bollinger_lower),
                            "atr": float(snap.technical_indicators.atr)
                        } if hasattr(snap, 'technical_indicators') else {}
                    }
                except Exception as symbol_error:
                    logger.error(f"Error processing symbol {symbol}: {symbol_error}")
                    continue
            
            # Конвертируем сигналы
            signals_list = []
            for signal in signals:
                try:
                    signal_dict = {
                        "timestamp": getattr(signal, 'timestamp', datetime.now(timezone.utc).isoformat()),
                        "signal_type": getattr(signal, 'type', 'unknown'),
                        "strength": float(getattr(signal, 'strength', 0.0)),
                        "confirmed": getattr(signal, 'confirmed', False),
                        "details": getattr(signal, 'details', {}),
                    }
                    
                    # Добавляем специфические поля если есть
                    if hasattr(signal, 'es_price'):
                        signal_dict["es_price"] = float(signal.es_price)
                    if hasattr(signal, 'nq_price'):
                        signal_dict["nq_price"] = float(signal.nq_price)
                    if hasattr(signal, 'divergence_pct'):
                        signal_dict["divergence_percentage"] = float(signal.divergence_pct)
                    
                    signals_list.append(signal_dict)
                    
                except Exception as signal_error:
                    logger.error(f"Error processing signal: {signal_error}")
                    continue
            
            return {
                "type": "market_update",
                "data": {
                    "market_data": market_dict,
                    "signals": signals_list,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "metadata": {
                        "symbols_count": len(market_dict),
                        "signals_count": len(signals_list),
                        "last_update": self.last_run.isoformat() if self.last_run else None
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"Broadcast data preparation error: {e}")
            return {
                "type": "error",
                "data": {
                    "message": "Data preparation failed",
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }

# Глобальная переменная для управления задачами
task_manager: BackgroundTaskManager = None

async def start_background_tasks(app: FastAPI, collector: MarketDataCollector, smt_service: SmartMoneyService, ws_manager: WebSocketManager):
    """Запуск фоновых задач"""
    global task_manager
    try:
        task_manager = BackgroundTaskManager(collector, smt_service, ws_manager)
        await task_manager.start()
        
        # Регистрируем обработчик завершения
        async def shutdown_handler():
            logger.info("Shutting down background tasks...")
            if task_manager:
                await task_manager.stop()
        
        app.add_event_handler("shutdown", shutdown_handler)
        logger.info("Background tasks startup completed")
                
    except Exception as e:
        logger.error(f"Failed to start background tasks: {e}")
        raise

async def stop_background_tasks():
    """Остановка фоновых задач"""
    global task_manager
    if task_manager:
        await task_manager.stop()
        logger.info("Background tasks stopped")