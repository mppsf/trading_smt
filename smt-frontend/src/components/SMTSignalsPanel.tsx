// src/components/SMTSignalsPanel.tsx
import React from 'react';
import { Zap, RefreshCw } from 'lucide-react';
import { SMTSignal } from '../types';

interface SMTSignalsPanelProps {
  signals: SMTSignal[];
  onRefresh: () => void;
}

const SMTSignalsPanel: React.FC<SMTSignalsPanelProps> = ({ signals, onRefresh }) => (
  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-white flex items-center">
        <Zap className="w-5 h-5 mr-2 text-blue-400" />
        SMT Signals
      </h3>
      <button
        onClick={onRefresh}
        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        title="Refresh SMT Signals"
      >
        <RefreshCw className="w-4 h-4 text-gray-400" />
      </button>
    </div>

    {signals.length === 0 ? (
      <div className="text-gray-400 text-center py-8">
        No active SMT signals
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {signals.slice(-3).map((signal, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border-l-4 ${
              signal.signal_type === 'bullish_divergence'
                ? 'bg-green-900/20 border-green-400'
                : signal.signal_type === 'bearish_divergence'
                ? 'bg-red-900/20 border-red-400'
                : 'bg-gray-800 border-gray-500'
            } ${index === 2 ? 'md:col-span-2' : ''}`} // третья карточка на всю ширину
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-white capitalize">
                {signal.signal_type.replace('_', ' ')}
              </span>
              <span className="text-sm text-gray-400">
                {new Date(signal.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="text-sm space-y-1">
              <div className="text-gray-300">
                Strength: {(signal.strength * 100).toFixed(1)}%
              </div>
              <div className="text-gray-300">
                Divergence: {signal.divergence_percentage.toFixed(2)}%
              </div>
              <div className="flex justify-between text-gray-300">
                <span>NASDAQ: ${signal.nasdaq_price.toFixed(2)}</span>
                <span>S&P500: ${signal.sp500_price.toFixed(2)}</span>
              </div>
              <div className={`flex items-center ${
                signal.confirmation_status ? 'text-green-400' : 'text-yellow-400'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  signal.confirmation_status ? 'bg-green-400' : 'bg-yellow-400'
                }`} />
                {signal.confirmation_status ? 'Confirmed' : 'Pending'}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default SMTSignalsPanel;
