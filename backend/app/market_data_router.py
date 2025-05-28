from fastapi import APIRouter, HTTPException, Query
from datetime import datetime, timezone
import pandas as pd
import logging

from app.services.market_data_collector import MarketDataCollector

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["market-data"])

@router.get("/market-data")
async def get_market_data(
    symbols: str = Query("ES=F,NQ=F", description="Символы через запятую"),
    timeframe: str = Query("5m", description="Таймфрейм: 5m, 15m, 1h, 1d"),
    limit: int = Query(100, description="Количество баров")
):
    """Получить рыночные данные для указанных символов"""
    try:
        market_collector = MarketDataCollector()
        symbol_list = [s.strip() for s in symbols.split(",")]
        result = []
        
        for symbol in symbol_list[:10]:  # Лимит символов
            try:
                cached_data = await market_collector.get_symbol_data(symbol)
                
                if cached_data:
                    # Выбор правильного таймфрейма
                    if timeframe == "5m":
                        source_data = cached_data.ohlcv_5m
                    elif timeframe == "15m":
                        source_data = cached_data.ohlcv_15m
                    elif timeframe == "1h":
                        source_data = getattr(cached_data, 'ohlcv_1h', cached_data.ohlcv_15m)
                    elif timeframe == "1d":
                        source_data = getattr(cached_data, 'ohlcv_1d', cached_data.ohlcv_15m)
                    else:
                        source_data = cached_data.ohlcv_5m
                    
                    ohlcv_data = []
                    if source_data:
                        limited_data = source_data[-limit:] if len(source_data) > limit else source_data
                        for item in limited_data:
                            ohlcv_data.append({
                                "timestamp": item.timestamp,
                                "Open": item.open,
                                "High": item.high,
                                "Low": item.low,
                                "Close": item.close,
                                "Volume": item.volume
                            })
                    
                    result.append({
                        "symbol": cached_data.symbol,
                        "current_price": cached_data.current_price,
                        "change_percent": cached_data.change_percent,
                        "volume": cached_data.volume,
                        "timestamp": cached_data.timestamp,
                        "ohlcv": ohlcv_data,
                        "market_state": cached_data.market_state
                    })
                else:
                    # Fallback к историческим данным
                    historical_data = await market_collector.get_historical_data(
                        symbol, period="2d", interval=timeframe
                    )
                    
                    if historical_data is not None and not historical_data.empty:
                        ohlcv_data = []
                        limited_data = historical_data.tail(limit)
                        
                        for idx, row in limited_data.iterrows():
                            ohlcv_data.append({
                                "timestamp": idx.isoformat(),
                                "Open": float(row['Open']),
                                "High": float(row['High']),
                                "Low": float(row['Low']),
                                "Close": float(row['Close']),
                                "Volume": int(row['Volume']) if not pd.isna(row['Volume']) else 0
                            })
                        
                        current_price = float(historical_data['Close'].iloc[-1])
                        prev_price = float(historical_data['Close'].iloc[-2]) if len(historical_data) > 1 else current_price
                        change_percent = ((current_price / prev_price) - 1) * 100 if prev_price != 0 else 0
                        
                        result.append({
                            "symbol": symbol,
                            "current_price": current_price,
                            "change_percent": change_percent,
                            "volume": int(historical_data['Volume'].iloc[-1]) if not pd.isna(historical_data['Volume'].iloc[-1]) else 0,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "ohlcv": ohlcv_data,
                            "market_state": "unknown"
                        })
                    else:
                        logger.warning(f"No data available for symbol: {symbol}")
                        
            except Exception as symbol_error:
                logger.error(f"Error processing symbol {symbol}: {symbol_error}")
                continue
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting market data: {e}")
        raise HTTPException(status_code=500, detail=str(e))