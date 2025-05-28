from datetime import datetime, timezone
from typing import Optional

async def get_current_market_phase() -> str:
    """Определение текущей фазы рынка на основе времени UTC"""
    now = datetime.now(timezone.utc)
    hour = now.hour
    
    if 8 <= hour < 16:
        return "london"
    elif 13 <= hour < 21:
        return "new_york" 
    elif 23 <= hour or hour < 8:
        return "asia"
    else:
        return "overlap"

async def get_quarterly_phase() -> Optional[str]:
    """Определить квартальную фазу для институциональных стратегий"""
    try:
        now = datetime.now(timezone.utc)
        quarter_start = datetime(now.year, ((now.month - 1) // 3) * 3 + 1, 1, tzinfo=timezone.utc)
        days_in_quarter = (now - quarter_start).days
        quarter_length = 90
        
        if days_in_quarter <= 0.25 * quarter_length:
            return "Q1_Accumulation"
        elif days_in_quarter <= 0.5 * quarter_length:
            return "Q2_Manipulation" 
        elif days_in_quarter <= 0.75 * quarter_length:
            return "Q3_Distribution"
        else:
            return "Q4_Rebalance"
    except:
        return None