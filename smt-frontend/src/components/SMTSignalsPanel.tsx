import React, { memo, useMemo } from 'react';
import { Zap, RefreshCw, Filter } from 'lucide-react';
import { SMTSignal } from '../../types';
import { Card, StatusBadge, EmptyState, LoadingSpinner } from '../ui';

interface SMTSignalsPanelProps {
  signals: SMTSignal[];
  onRefresh: () => void;
  loading?: boolean;
}

const SignalCard = memo<{ signal: SMTSignal; index: number }>(({ signal, index }) => {
  const signalConfig = useMemo(() => {
    switch (signal.signal_type) {
      case 'bullish_divergence':
        return { status: 'success' as const, bgColor: 'bg-green-900/20 border-green-400' };
      case 'bearish_divergence':
        return { status: 'error' as const, bgColor: 'bg-red-900/20 border-red-400' };
      default:
        return { status: 'neutral' as const, bgColor: 'bg-gray-800 border-gray-500' };
    }
  }, [signal.signal_type]);

  return (
    <div className={`p-4 rounded-lg border-l-4 transition-all hover:shadow-lg ${signalConfig.bgColor}`}>
      <div className="flex items-center justify-between mb-3">
        <StatusBadge status={signalConfig.status} size="sm">
          {signal.signal_type.replace('_', ' ').toUpperCase()}
        </StatusBadge>
        <span className="text-xs text-gray-400">
          {new Date(signal.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-300">
          Strength: <span className="text-white font-medium">{(signal.strength * 100).toFixed(1)}%</span>
        </div>
        <div className="text-gray-300">
          Divergence: <span className="text-white font-medium">{signal.divergence_percentage.toFixed(2)}%</span>
        </div>
      </div>
      
      <div className="flex justify-between text-xs text-gray-400 mt-2">
        <span>NASDAQ: ${signal.nasdaq_price.toFixed(2)}</span>
        <span>S&P500: ${signal.sp500_price.toFixed(2)}</span>
      </div>
      
      <StatusBadge
        status={signal.confirmation_status ? 'success' : 'warning'}
        size="sm"
        withDot
        className="mt-2"
      >
        {signal.confirmation_status ? 'Confirmed' : 'Pending'}
      </StatusBadge>
    </div>
  );
});

SignalCard.displayName = 'SignalCard';

export const SMTSignalsPanel = memo<SMTSignalsPanelProps>(({ 
  signals, 
  onRefresh, 
  loading = false 
}) => {
  const recentSignals = useMemo(() => signals.slice(-6), [signals]);

  return (
    <Card className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Zap className="w-5 h-5 mr-2 text-blue-400" />
          SMT Signals
          <StatusBadge status="info" size="sm" className="ml-3">
            {signals.length} total
          </StatusBadge>
        </h3>
        
        <div className="flex items-center space-x-2">
          <button
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            title="Filter signals"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
            title="Refresh SMT Signals"
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {recentSignals.length === 0 ? (
        <EmptyState
          icon={<Zap className="w-12 h-12" />}
          title="No Active SMT Signals"
          description="Waiting for market divergence patterns to emerge"
          action={{
            label: "Refresh Now",
            onClick: onRefresh
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {recentSignals.map((signal, index) => (
            <SignalCard key={`${signal.timestamp}-${index}`} signal={signal} index={index} />
          ))}
        </div>
      )}
    </Card>
  );
});

SMTSignalsPanel.displayName = 'SMTSignalsPanel';