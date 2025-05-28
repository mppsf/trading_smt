// src/components/KillzoneStatus.tsx
import React from 'react';
import { Clock } from 'lucide-react';
import { KillzoneInfo } from '../types';

interface KillzoneStatusProps {
  info: KillzoneInfo | null;
}

const KillzoneStatus: React.FC<KillzoneStatusProps> = ({ info }) => (
  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
      <Clock className="w-5 h-5 mr-2 text-purple-400" />
      Trading Sessions
    </h3>
    
    {info ? (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Active Session:</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            info.current 
              ? info.priority === 'high' 
                ? 'bg-green-900 text-green-400'
                : info.priority === 'medium'
                ? 'bg-yellow-900 text-yellow-400'
                : 'bg-blue-900 text-blue-400'
              : 'bg-gray-800 text-gray-400'
          }`}>
            {info.current || 'None'}
          </span>
        </div>
        
        {info.current && (
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Time Remaining:</span>
            <span className="text-white font-medium">
              {info.time_remaining}
            </span>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Next Session:</span>
          <span className="text-blue-400 font-medium">
            {info.next_session}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-300">Priority:</span>
          <div className={`px-2 py-1 rounded text-sm ${
            info.priority === 'high' ? 'bg-red-900 text-red-400' :
            info.priority === 'medium' ? 'bg-yellow-900 text-yellow-400' :
            'bg-gray-800 text-gray-400'
          }`}>
            {info.priority?.toUpperCase()}
          </div>
        </div>
      </div>
    ) : (
      <div className="text-gray-400">Loading session info...</div>
    )}
  </div>
);

export default KillzoneStatus;