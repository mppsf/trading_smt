import React from 'react';
import { Clock } from 'lucide-react';
import { KillzoneInfo } from '../types';

interface KillzoneStatusProps {
  info: KillzoneInfo | null;
}

const KillzoneStatus: React.FC<KillzoneStatusProps> = ({ info }) => (
  <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
    {/* ... status markup ... */}
  </div>
);

export default KillzoneStatus;