import React from 'react';
import { Zap, RefreshCw } from 'lucide-react';
import { SMTSignal } from '../types';

interface SMTSignalsPanelProps {
  signals: SMTSignal[];
  onRefresh: () => void;
}

const SMTSignalsPanel: React.FC<SMTSignalsPanelProps> = ({ signals, onRefresh }) => (
  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-white flex items-center">
        <Zap className="w-5 h-5 mr-2 text-blue-400" /> SMT Signals
      </h3>
      <button onClick={onRefresh} className="p-2 hover:bg-gray-800 rounded-lg">
        <RefreshCw className="w-4 h-4 text-gray-400" />
      </button>
    </div>
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {signals.length === 0 ? (
        <div className="text-gray-400 text-center py-8">No active SMT signals</div>
      ) : (
        signals.slice(-5).map((signal, i) => (
          <div key={i} className={`p-4 rounded-lg border-l-4 ${
            signal.signal_type === 'bullish_divergence' ? 'bg-green-900/20 border-green-400'
            : signal.signal_type === 'bearish_divergence' ? 'bg-red-900/20 border-red-400'
            : 'bg-gray-800 border-gray-500'
          }`}>
            {/* ... детализация сигнала ... */}
          </div>
        ))
      )}
    </div>
  </div>
);

export default SMTSignalsPanel;