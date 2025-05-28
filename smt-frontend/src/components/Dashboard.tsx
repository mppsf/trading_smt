import React from 'react';
import PriceDisplay from './PriceDisplay';
import SMTSignalsPanel from './SMTSignalsPanel';
import KillzoneStatus from './KillzoneStatus';
import SystemStatusPanel from './SystemStatusPanel';
import { MarketData, SMTSignal, KillzoneInfo, HealthStatus } from '../types';
import SettingsPanel from './SettingsPanel';

interface DashboardProps {
  marketData: Record<string, MarketData>;
  smtSignals: SMTSignal[];
  killzoneInfo: KillzoneInfo | null;
  healthStatus: HealthStatus | null;
  onRefreshSignals: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ marketData, smtSignals, killzoneInfo, healthStatus, onRefreshSignals }) => (
  <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Левая часть: цены и график */}
    <div className="lg:col-span-2 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.values(marketData).map(md => <PriceDisplay key={md.symbol} data={md} />)}
      </div>
      {/* Тут добавьте Price Comparison Chart */}
    </div>
    {/* Сайдбар */}
    <div className="space-y-6">
      <SystemStatusPanel health={healthStatus} />
      <KillzoneStatus info={killzoneInfo} />
      <SMTSignalsPanel signals={smtSignals} onRefresh={onRefreshSignals} />
      <SettingsPanel/>
      
    </div>
  </main>
);

export default Dashboard;