// src/components/PriceDisplay.tsx
import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { MarketData } from '../types';

interface PriceDisplayProps {
  data: MarketData;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({ data }) => {
  const isPositive = data.change_percent >= 0;
  
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{data.symbol}</h3>
        <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          isPositive ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
        }`}>
          {isPositive ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
          {data.change_percent.toFixed(2)}%
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-3xl font-bold text-white">
          ${data.current_price.toFixed(2)}
        </div>
        <div className="text-sm text-gray-400">
          Volume: {data.volume?.toLocaleString() || 'N/A'}
        </div>
        <div className="text-xs text-gray-500">
          Updated: {new Date(data.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default PriceDisplay;