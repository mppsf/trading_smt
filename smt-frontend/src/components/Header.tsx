// src/components/Header.tsx
import React from 'react';
import { Wifi, WifiOff, RefreshCw, Settings, AlertCircle } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  error: string | null;
  isLoading: boolean;
  lastUpdate: Date | null;
  onRefresh: () => void;
}

const Header: React.FC<HeaderProps> = ({ isConnected, error, isLoading, lastUpdate, onRefresh }) => (
  <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
    <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-2xl font-bold text-white">SMT Trading Analyzer</h1>
        <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
          isConnected ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
        }`}>
          {isConnected ? <Wifi className="w-4 h-4 mr-1" /> : <WifiOff className="w-4 h-4 mr-1" />}
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        {error && (
          <div className="flex items-center px-3 py-1 bg-red-900/50 text-red-400 rounded-full text-sm">
            <AlertCircle className="w-4 h-4 mr-1" />
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg flex items-center"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
        <div className="text-sm text-gray-400">
          {lastUpdate && `Last update: ${lastUpdate.toLocaleTimeString()}`}
        </div>
        <Settings className="w-5 h-5 cursor-pointer hover:text-white" />
      </div>
    </div>
  </header>
);

export default Header;
