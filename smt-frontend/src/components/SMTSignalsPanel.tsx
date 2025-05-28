// src/components/SMTSignalsPanel.tsx
import React, { memo } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import { SMTSignal } from '../types';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';

interface SMTSignalsPanelProps {
  signals: SMTSignal[];
  onRefresh: () => void;
  loading?: boolean;
}

const SMTSignalsPanel = memo<SMTSignalsPanelProps>(({ signals, onRefresh, loading = false }) => {
  const getSignalIcon = (type: SMTSignal['signal_type']) => {
    switch (type) {
      case 'bullish_divergence': return <TrendingUp className="w-4 h-4" />;
      case 'bearish_divergence': return <TrendingDown className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getSignalStatus = (type: SMTSignal['signal_type']) => {
    switch (type) {
      case 'bullish_divergence': return 'success';
      case 'bearish_divergence': return 'error';
      default: return 'neutral';
    }
  };

  const formatStrength = (strength: number) => `${(strength * 100).toFixed(0)}%`;
  const formatPrice = (price: number) => `$${price.toFixed(2)}`;
  const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString();

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Activity className="w-5 h-5 mr-2 text-blue-400" />
          SMT Signals ({signals.length})
        </h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg flex items-center text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {signals.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="w-12 h-12" />}
          title="No SMT Signals"
          description="No signals detected at the moment. They will appear when divergences are found."
          action={{
            label: "Refresh",
            onClick: onRefresh
          }}
        />
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <StatusBadge 
                    status={getSignalStatus(signal.signal_type) as any} 
                    size="sm" 
                    withDot
                  >
                    {getSignalIcon(signal.signal_type)}
                    <span className="ml-1 capitalize">
                      {signal.signal_type.replace('_', ' ')}
                    </span>
                  </StatusBadge>
                  {signal.confirmation_status && (
                    <StatusBadge status="success" size="sm">
                      Confirmed
                    </StatusBadge>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {formatTime(signal.timestamp)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Strength:</span>
                  <span className="text-white font-medium ml-2">
                    {formatStrength(signal.strength)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Divergence:</span>
                  <span className="text-white font-medium ml-2">
                    {signal.divergence_percentage.toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">NASDAQ:</span>
                  <span className="text-white font-medium ml-2">
                    {formatPrice(signal.nasdaq_price)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">S&P 500:</span>
                  <span className="text-white font-medium ml-2">
                    {formatPrice(signal.sp500_price)}
                  </span>
                </div>
              </div>

              {signal.market_phase && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <span className="text-xs text-gray-400">Market Phase: </span>
                  <span className="text-xs text-blue-400 font-medium">
                    {signal.market_phase}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
});

SMTSignalsPanel.displayName = 'SMTSignalsPanel';
export default SMTSignalsPanel;