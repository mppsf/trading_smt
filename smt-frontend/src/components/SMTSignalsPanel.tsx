import React, { memo } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Activity, AlertTriangle, Target, Volume2, Zap } from 'lucide-react';
import { SMTSignal, SMTSignalType } from '../types';

interface SMTSignalsPanelProps {
  signals: SMTSignal[];
  onRefresh: () => void;
  loading?: boolean;
}

const SMTSignalsPanel = memo<SMTSignalsPanelProps>(({ signals, onRefresh, loading = false }) => {
  const getSignalIcon = (type: SMTSignalType): React.ReactNode => {
    const iconMap: Record<SMTSignalType, React.ReactNode> = {
      smt_bullish_divergence: <TrendingUp className="w-4 h-4" />,
      smt_bearish_divergence: <TrendingDown className="w-4 h-4" />,
      false_break_up: <Target className="w-4 h-4" />,
      false_break_down: <Target className="w-4 h-4" />,
      volume_spike: <Volume2 className="w-4 h-4" />,
      volume_divergence_bullish: <Volume2 className="w-4 h-4" />,
      volume_divergence_bearish: <Volume2 className="w-4 h-4" />,
      judas_swing_bullish: <Zap className="w-4 h-4" />,
      judas_swing_bearish: <Zap className="w-4 h-4" />
    };
    
    return iconMap[type] || <Activity className="w-4 h-4" />;
  };

  const getSignalColor = (type: SMTSignalType): string => {
    const bullishTypes: SMTSignalType[] = ['smt_bullish_divergence', 'false_break_up', 'volume_divergence_bullish', 'judas_swing_bullish'];
    const bearishTypes: SMTSignalType[] = ['smt_bearish_divergence', 'false_break_down', 'volume_divergence_bearish', 'judas_swing_bearish'];
    
    if (bullishTypes.includes(type)) return 'bg-green-900 text-green-400';
    if (bearishTypes.includes(type)) return 'bg-red-900 text-red-400';
    return 'bg-blue-900 text-blue-400';
  };

  const formatSignalName = (type: SMTSignalType): string => {
    const nameMap: Record<SMTSignalType, string> = {
      smt_bullish_divergence: 'SMT Bullish Divergence',
      smt_bearish_divergence: 'SMT Bearish Divergence',
      false_break_up: 'False Break Up',
      false_break_down: 'False Break Down',
      volume_spike: 'Volume Spike',
      volume_divergence_bullish: 'Volume Divergence Bullish',
      volume_divergence_bearish: 'Volume Divergence Bearish',
      judas_swing_bullish: 'Judas Swing Bullish',
      judas_swing_bearish: 'Judas Swing Bearish'
    };
    
    return nameMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatStrength = (strength: number): string => {
    if (typeof strength !== 'number' || isNaN(strength)) return '0%';
    return `${Math.round(strength * 100)}%`;
  };

  const formatPrice = (price: number): string => {
    if (typeof price !== 'number' || isNaN(price)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid time';
      return date.toLocaleTimeString();
    } catch {
      return 'Invalid time';
    }
  };

  const formatPercentage = (percentage: number): string => {
    if (typeof percentage !== 'number' || isNaN(percentage)) return '0.00%';
    return `${percentage.toFixed(2)}%`;
  };

  const getSignalKey = (signal: SMTSignal): string => {
    return signal.id || `${signal.timestamp}-${signal.signal_type}-${signal.strength}`;
  };

  const isValidSignal = (signal: SMTSignal): boolean => {
    return !!(
      signal &&
      signal.signal_type &&
      typeof signal.strength === 'number' &&
      typeof signal.nasdaq_price === 'number' &&
      typeof signal.sp500_price === 'number' &&
      typeof signal.divergence_percentage === 'number' &&
      signal.timestamp
    );
  };

  const validSignals = signals.filter(isValidSignal);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Activity className="w-5 h-5 mr-2 text-blue-400" />
          SMT Signals ({validSignals.length})
        </h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg flex items-center text-sm transition-colors"
          aria-label={loading ? 'Loading signals...' : 'Refresh signals'}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {validSignals.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <div className="text-gray-400 mb-2">No SMT Signals</div>
          <div className="text-gray-500 text-sm mb-4">
            No signals detected at the moment. They will appear when divergences are found.
          </div>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {validSignals.map((signal) => (
            <div
              key={getSignalKey(signal)}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getSignalColor(signal.signal_type)}`}>
                    <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
                    {getSignalIcon(signal.signal_type)}
                    <span className="ml-1">
                      {formatSignalName(signal.signal_type)}
                    </span>
                  </span>
                  {signal.confirmation_status && (
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-400">
                      Confirmed
                    </span>
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
                    {formatPercentage(signal.divergence_percentage)}
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
                  <span className="text-xs text-blue-400 font-medium capitalize">
                    {signal.market_phase}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

SMTSignalsPanel.displayName = 'SMTSignalsPanel';
export default SMTSignalsPanel;