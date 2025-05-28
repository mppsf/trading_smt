import React, { memo } from 'react';
import { Activity, Clock, Settings as SettingsIcon, Wifi, WifiOff } from 'lucide-react';
import { HealthStatus, KillzoneInfo } from '../../types';
import { Card, StatusBadge } from '../ui';

interface SystemPanelProps {
  health: HealthStatus | null;
  killzone: KillzoneInfo | null;
  isConnected: boolean;
}

export const SystemPanel = memo<SystemPanelProps>(({ health, killzone, isConnected }) => (
  <div className="space-y-4">
    {/* Connection Status */}
    <Card padding="sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-300 text-sm">Connection</span>
        <StatusBadge 
          status={isConnected ? 'success' : 'error'}
          size="sm"
          withDot
        >
          {isConnected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
          {isConnected ? 'Online' : 'Offline'}
        </StatusBadge>
      </div>
    </Card>

    {/* System Health */}
    <Card>
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Activity className="w-5 h-5 mr-2 text-green-400" />
        System Status
      </h3>
      
      {health ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Redis:</span>
            <StatusBadge 
              status={health.redis === 'healthy' ? 'success' : 'error'}
              size="sm"
              withDot
            >
              {health.redis}
            </StatusBadge>
          </div>
          <div className="text-xs text-gray-500">
            Last checked: {new Date().toLocaleTimeString()}
          </div>
        </div>
      ) : (
        <div className="text-gray-400">Loading status...</div>
      )}
    </Card>

    {/* Trading Sessions */}
    <Card>
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Clock className="w-5 h-5 mr-2 text-purple-400" />
        Trading Sessions
      </h3>
      
      {killzone ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Active:</span>
            <StatusBadge 
              status={killzone.current ? 
                killzone.priority === 'high' ? 'success' :
                killzone.priority === 'medium' ? 'warning' : 'info'
                : 'neutral'
              }
              size="sm"
            >
              {killzone.current || 'None'}
            </StatusBadge>
          </div>
          
          {killzone.current && (
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Remaining:</span>
              <span className="text-white font-medium text-sm">
                {killzone.time_remaining}
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Next:</span>
            <span className="text-blue-400 font-medium text-sm">
              {killzone.next_session}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-gray-400">Loading session info...</div>
      )}
    </Card>
  </div>
));

SystemPanel.displayName = 'SystemPanel';