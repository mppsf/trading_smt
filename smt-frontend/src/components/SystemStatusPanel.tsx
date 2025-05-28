import React from 'react';
import { Activity } from 'lucide-react';
import { HealthStatus } from '../types';

interface SystemStatusPanelProps {
  health: HealthStatus | null;
}

const SystemStatusPanel: React.FC<SystemStatusPanelProps> = ({ health }) => (
  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
    {/* ... status markup ... */}
  </div>
);

export default SystemStatusPanel;