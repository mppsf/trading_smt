import React, { memo } from 'react';
import { ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import { MarketData } from '../../types';
import { Card, StatusBadge } from '../ui';

interface PriceDisplayProps {
  data: MarketData;
}

export const PriceDisplay = memo<PriceDisplayProps>(({ data }) => {
  const isPositive = data.change_percent >= 0;
  const isSignificantChange = Math.abs(data.change_percent) > 1;

  return (
    <Card 
      variant={isSignificantChange ? 'gradient' : 'default'}
      className="hover:scale-105 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-white">{data.symbol}</h3>
          {data.market_state && (
            <StatusBadge 
              status={data.market_state === 'open' ? 'success' : 'neutral'}
              size="sm"
            >
              {data.market_state}
            </StatusBadge>
          )}
        </div>
        
        <StatusBadge 
          status={isPositive ? 'success' : 'error'}
          withDot
        >
          {isPositive ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
          {Math.abs(data.change_percent).toFixed(2)}%
        </StatusBadge>
      </div>
      
      <div className="space-y-3">
        <div className="text-3xl font-bold text-white flex items-baseline">
          ${data.current_price.toFixed(2)}
          {isSignificantChange && (
            <TrendingUp className="w-5 h-5 ml-2 text-blue-400" />
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-gray-400">
            Volume: {data.volume?.toLocaleString() || 'N/A'}
          </div>
          <div className="text-gray-500 text-right">
            {new Date(data.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </Card>
  );
});

PriceDisplay.displayName = 'PriceDisplay';
