// src/components/SMTSignalsPanel.tsx
import React, { memo, useMemo, useState, useCallback } from 'react';
import { Zap, RefreshCw, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { SMTSignal } from '../types';

interface SMTSignalsPanelProps {
  signals: SMTSignal[] | null | undefined;
  onRefresh: () => void;
  loading?: boolean;
}

interface SignalCardProps {
  signal: SMTSignal;
  index: number;
}

const SignalCard = memo<SignalCardProps>(({ signal, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const signalConfig = useMemo(() => {
    switch (signal.signal_type) {
      case 'bullish_divergence':
        return { 
          status: 'success' as const, 
          bgColor: 'bg-green-900/20 border-green-400',
          textColor: 'text-green-400'
        };
      case 'bearish_divergence':
        return { 
          status: 'error' as const, 
          bgColor: 'bg-red-900/20 border-red-400',
          textColor: 'text-red-400'
        };
      default:
        return { 
          status: 'neutral' as const, 
          bgColor: 'bg-gray-800 border-gray-500',
          textColor: 'text-gray-400'
        };
    }
  }, [signal.signal_type]);

  const formatPrice = useCallback((price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }, []);

  const formatPercentage = useCallback((percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  }, []);

  const formatTimestamp = useCallback((timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return 'Invalid time';
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div className={`p-4 rounded-lg border-l-4 transition-all hover:shadow-lg ${signalConfig.bgColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
          signalConfig.status === 'success' ? 'bg-green-900 text-green-400' :
          signalConfig.status === 'error' ? 'bg-red-900 text-red-400' :
          'bg-gray-800 text-gray-400'
        }`}>
          {signal.signal_type.replace('_', ' ').toUpperCase()}
        </span>
        <span className="text-xs text-gray-400">
          {formatTimestamp(signal.timestamp)}
        </span>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="text-gray-300">
          Strength: <span className="text-white font-medium">{(signal.strength * 100).toFixed(1)}%</span>
        </div>
        <div className="text-gray-300">
          Divergence: <span className="text-white font-medium">{formatPercentage(signal.divergence_percentage)}</span>
        </div>
      </div>
      
      {/* Price Info */}
      <div className="flex justify-between text-xs text-gray-400 mb-3">
        <span>NASDAQ: {formatPrice(signal.nasdaq_price)}</span>
        <span>S&P500: {formatPrice(signal.sp500_price)}</span>
      </div>
      
      {/* Status Badge */}
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
          signal.confirmation_status ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'
        }`}>
          <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
          {signal.confirmation_status ? 'Confirmed' : 'Pending'}
        </span>

        {/* Market Phase */}
        {signal.market_phase && (
          <span className="px-2 py-1 text-xs bg-blue-900/50 text-blue-400 rounded-full">
            {signal.market_phase}
          </span>
        )}
      </div>
      
      {/* Expandable Details */}
      {signal.details && Object.keys(signal.details).length > 0 && (
        <div className="border-t border-gray-700 pt-2">
          <button
            onClick={toggleExpanded}
            className="flex items-center text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
            Details {isExpanded ? 'Less' : 'More'}
          </button>
          
          {isExpanded && (
            <div className="mt-2 text-xs text-gray-500 space-y-1">
              {Object.entries(signal.details).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="capitalize">{key.replace('_', ' ')}:</span>
                  <span className="text-gray-400">
                    {typeof value === 'number' ? value.toFixed(4) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SignalCard.displayName = 'SignalCard';

const SMTSignalsPanel = memo<SMTSignalsPanelProps>(({ 
  signals, 
  onRefresh, 
  loading = false 
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [signalTypeFilter, setSignalTypeFilter] = useState<string>('all');
  const [minStrengthFilter, setMinStrengthFilter] = useState<number>(0);

  // Safe array processing with proper type checking
  const safeSignals = useMemo(() => {
    if (!signals) return [];
    if (!Array.isArray(signals)) {
      console.warn('Expected signals to be an array, got:', typeof signals);
      return [];
    }
    return signals.filter(signal => 
      signal && 
      typeof signal === 'object' && 
      'id' in signal && 
      'signal_type' in signal &&
      'timestamp' in signal
    );
  }, [signals]);

  // Apply filters
  const filteredSignals = useMemo(() => {
    return safeSignals.filter(signal => {
      if (signalTypeFilter !== 'all' && signal.signal_type !== signalTypeFilter) {
        return false;
      }
      if (signal.strength < minStrengthFilter) {
        return false;
      }
      return true;
    });
  }, [safeSignals, signalTypeFilter, minStrengthFilter]);

  // Get recent signals for display
  const recentSignals = useMemo(() => {
    return filteredSignals
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [filteredSignals]);

  // Statistics
  const signalStats = useMemo(() => {
    const total = safeSignals.length;
    const confirmed = safeSignals.filter(s => s.confirmation_status).length;
    const bullish = safeSignals.filter(s => s.signal_type === 'bullish_divergence').length;
    const bearish = safeSignals.filter(s => s.signal_type === 'bearish_divergence').length;
    
    return { total, confirmed, bullish, bearish };
  }, [safeSignals]);

  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);

  const resetFilters = useCallback(() => {
    setSignalTypeFilter('all');
    setMinStrengthFilter(0);
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Zap className="w-5 h-5 mr-2 text-blue-400" />
            SMT Signals
          </h3>
          <div className="flex space-x-2">
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-900 text-blue-400">
              {signalStats.total} total
            </span>
            {signalStats.confirmed > 0 && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-900 text-green-400">
                {signalStats.confirmed} confirmed
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={toggleFilters}
            className={`p-2 hover:bg-gray-800 rounded-lg transition-colors ${
              showFilters ? 'text-blue-400 bg-gray-800' : 'text-gray-400 hover:text-white'
            }`}
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
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-800 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-white">Filters</h4>
            <button
              onClick={resetFilters}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Reset
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Signal Type</label>
              <select
                value={signalTypeFilter}
                onChange={(e) => setSignalTypeFilter(e.target.value)}
                className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="bullish_divergence">Bullish</option>
                <option value="bearish_divergence">Bearish</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Min Strength ({(minStrengthFilter * 100).toFixed(0)}%)
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={minStrengthFilter}
                onChange={(e) => setMinStrengthFilter(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
          
          <div className="text-xs text-gray-400">
            Showing {filteredSignals.length} of {signalStats.total} signals
          </div>
        </div>
      )}

      {/* Signals Display */}
      {recentSignals.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4 flex justify-center">
            <Zap className="w-12 h-12" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {loading ? 'Loading Signals...' : 'No SMT Signals Found'}
          </h3>
          <p className="text-gray-400 mb-6 max-w-sm mx-auto">
            {loading 
              ? 'Analyzing market data for divergence patterns...' 
              : filteredSignals.length !== safeSignals.length
                ? 'Try adjusting your filters to see more signals'
                : 'Waiting for market divergence patterns to emerge'
            }
          </p>
          {!loading && (
            <button
              onClick={onRefresh}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Refresh Now
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {recentSignals.map((signal, index) => (
            <SignalCard 
              key={`${signal.id}-${signal.timestamp}-${index}`} 
              signal={signal} 
              index={index} 
            />
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {signalStats.total > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xl font-bold text-white">{signalStats.total}</div>
              <div className="text-xs text-gray-400">Total Signals</div>
            </div>
            <div>
              <div className="text-xl font-bold text-green-400">{signalStats.bullish}</div>
              <div className="text-xs text-gray-400">Bullish</div>
            </div>
            <div>
              <div className="text-xl font-bold text-red-400">{signalStats.bearish}</div>
              <div className="text-xs text-gray-400">Bearish</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-400">{signalStats.confirmed}</div>
              <div className="text-xs text-gray-400">Confirmed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

SMTSignalsPanel.displayName = 'SMTSignalsPanel';
export default SMTSignalsPanel;