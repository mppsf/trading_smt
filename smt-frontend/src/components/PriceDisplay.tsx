// src/components/Dashboard.tsx
import React from 'react';
import PriceDisplay from './PriceDisplay';
import SMTSignalsPanel from './SMTSignalsPanel';
import KillzoneStatus from './KillzoneStatus';
import SystemStatusPanel from './SystemPanel';
import SettingsPanel from './SettingsPanel';
import { MarketData, SMTSignal, KillzoneInfo, HealthStatus } from '../types';

interface DashboardProps {
  marketData: Record<string, MarketData>;
  smtSignals: SMTSignal[];
  killzoneInfo: KillzoneInfo | null;
  healthStatus: HealthStatus | null;
  onRefreshSignals: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  marketData, 
  smtSignals, 
  killzoneInfo, 
  healthStatus, 
  onRefreshSignals 
}) => (
  <main className="max-w-7xl mx-auto px-4 py-6">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Левая и центральная часть */}
      <div className="lg:col-span-2 space-y-6">
        {/* Рыночные данные */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.keys(marketData).length === 0 ? (
            <div className="col-span-2 bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
              <div className="text-gray-400">No market data available</div>
            </div>
          ) : (
            Object.values(marketData).map(data => (
              <PriceDisplay key={data.symbol} data={data} />
            ))
          )}
        </div>
        
        {/* SMT Сигналы - отдельной строкой */}
        <SMTSignalsPanel signals={smtSignals} onRefresh={onRefreshSignals} />
      </div>
      
      {/* Правая часть: статусы и настройки */}
      <div className="space-y-6">
        <SystemStatusPanel health={healthStatus} />
        <KillzoneStatus info={killzoneInfo} />
        <SettingsPanel />
      </div>
    </div>
  </main>
);

export default Dashboard;