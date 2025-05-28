// src/components/SystemStatusPanel.tsx
import React from 'react';
import { Activity } from 'lucide-react';
import { HealthStatus } from '../types';

interface SystemStatusPanelProps {
  health: HealthStatus | null;
}

const SystemStatusPanel: React.FC<SystemStatusPanelProps> = ({ health }) => (
  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
      <Activity className="w-5 h-5 mr-2 text-green-400" />
      System Status
    </h3>
    
    {health ? (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Redis Status:</span>
          <div className={`flex items-center px-2 py-1 rounded text-sm ${
            health.redis === 'healthy' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              health.redis === 'healthy' ? 'bg-green-400' : 'bg-red-400'
            }`} />
            {health.redis}
          </div>
        </div>
        
        <div className="text-xs text-gray-500">
          Last checked: {new Date().toLocaleTimeString()}
        </div>
      </div>
    ) : (
      <div className="text-gray-400">Loading status...</div>
    )}
  </div>
);

export default SystemStatusPanel;