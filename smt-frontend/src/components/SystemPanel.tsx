import React, { memo } from 'react';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import { HealthStatus } from '../types';

interface SystemStatusPanelProps {
  health: HealthStatus | null;
  isConnected?: boolean;
}

const SystemStatusPanel = memo<SystemStatusPanelProps>(({ health, isConnected = true }) => {
  const getStatusStyle = (status: string) => 
    status === 'connected' || status === 'healthy' 
      ? 'bg-green-900 text-green-400' 
      : 'bg-red-900 text-red-400';

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">Connection</span>
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
            isConnected ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
            {isConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Activity className="w-5 h-5 mr-2 text-green-400" />
          System Status
        </h3>
        
        {health ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Status:</span>
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusStyle(health.status)}`}>
                <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
                {health.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Redis:</span>
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusStyle(health.redis)}`}>
                <span className="w-2 h-2 rounded-full bg-current mr-2"></span>
                {health.redis}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Last checked: {new Date(health.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="text-gray-400">Loading status...</div>
        )}
      </div>
    </div>
  );
});

SystemStatusPanel.displayName = 'SystemStatusPanel';
export default SystemStatusPanel;