// src/components/PriceDisplay.tsx
import React, { memo } from 'react';
import { ArrowUp, ArrowDown, TrendingUp, Activity } from 'lucide-react';
import { MarketData } from '../types';

interface PriceDisplayProps {
  data: MarketData;
}

const PriceDisplay = memo<PriceDisplayProps>(({ data }) => {
  const isPositive = data.change_percent >= 0;
  const isSignificantChange = Math.abs(data.change_percent) > 1;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  };

  const formatPercentage = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 hover:border-blue-500/50 transition-all duration-300">
      {/* Header with Symbol and Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-xl font-bold text-white">{data.symbol}</h3>
          {data.market_state && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              data.market_state === 'open' 
                ? 'bg-green-900 text-green-400' 
                : 'bg-gray-800 text-gray-400'
            }`}>
              {data.market_state.replace('_', ' ').toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center">
          {isPositive ? (
            <ArrowUp className={`w-5 h-5 ${isSignificantChange ? 'text-green-400' : 'text-green-500'}`} />
          ) : (
            <ArrowDown className={`w-5 h-5 ${isSignificantChange ? 'text-red-400' : 'text-red-500'}`} />
          )}
        </div>
      </div>

      {/* Main Price Display */}
      <div className="mb-4">
        <div className="text-3xl font-bold text-white mb-2">
          {formatPrice(data.current_price)}
        </div>
        <div className={`flex items-center space-x-2 text-lg font-medium ${
          isPositive ? 'text-green-400' : 'text-red-400'
        }`}>
          <span>{formatPercentage(data.change_percent)}</span>
          {isSignificantChange && (
            <TrendingUp className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Additional Info */}
      <div className="space-y-2 text-sm">
        {data.volume && (
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center">
              <Activity className="w-4 h-4 mr-1" />
              Volume:
            </span>
            <span className="text-white font-medium">{formatVolume(data.volume)}</span>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Last Update:</span>
          <span className="text-gray-300 text-xs">
            {new Date(data.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Visual Price Change Indicator */}
      <div className="mt-4 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${
            isPositive ? 'bg-green-400' : 'bg-red-400'
          }`}
          style={{ 
            width: `${Math.min(Math.abs(data.change_percent) * 10, 100)}%` 
          }}
        />
      </div>
    </div>
  );
});

PriceDisplay.displayName = 'PriceDisplay';

export default PriceDisplay;