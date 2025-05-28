import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import Dashboard from '../components/Dashboard';
import { MarketData, SMTSignal, KillzoneInfo, HealthStatus } from '../types';
import { fetchMarketData, fetchSMTSignals, fetchKillzones, fetchHealth } from '../services/api';

const SMTTradingDashboard: React.FC = () => {
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [smtSignals, setSmtSignals] = useState<SMTSignal[]>([]);
  const [killzoneInfo, setKillzoneInfo] = useState<KillzoneInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // WebSocket и fetch эффекты...
  // fetchHealth каждую 30с, killzones каждую минуту, WebSocket market updates

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [mdArr, signals] = await Promise.all([
        fetchMarketData('QQQ,SPY'),
        fetchSMTSignals()
      ]);
      setMarketData(Object.fromEntries(mdArr.map(m => [m.symbol, m])));
      setSmtSignals(signals);
      setLastUpdate(new Date());
      setError(null);
    } catch {
      setError('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { handleRefresh(); }, [handleRefresh]);

  return (
    <div className="min-h-screen bg-black text-white">
      <Header
        isConnected={isConnected}
        error={error}
        isLoading={isLoading}
        lastUpdate={lastUpdate}
        onRefresh={handleRefresh}
      />
      <Dashboard
        marketData={marketData}
        smtSignals={smtSignals}
        killzoneInfo={killzoneInfo}
        healthStatus={healthStatus}
        onRefreshSignals={() => fetchSMTSignals().then(setSmtSignals)}
      />
    </div>
  );
};
  
export default SMTTradingDashboard;

//todo
// import React, { useState, useCallback } from 'react';
// import { RefreshCw, Settings, AlertCircle, Bell, BellOff } from 'lucide-react';
// import { useRealtimeData, useLocalStorage, useWebSocket } from './hooks';
// import { 
//   OptimizedPriceDisplay, 
//   OptimizedSMTSignalsPanel, 
//   OptimizedSystemPanel 
// } from './components/optimized';
// import { Card, StatusBadge, LoadingSpinner } from './components/ui';
// import { SettingsPanel } from './components/SettingsPanel';

// interface AppSettings {
//   refreshInterval: number;
//   enableNotifications: boolean;
//   autoRefresh: boolean;
//   theme: 'dark' | 'light';
// }

// const DEFAULT_SETTINGS: AppSettings = {
//   refreshInterval: 5000,
//   enableNotifications: true,
//   autoRefresh: true,
//   theme: 'dark'  
// };

// export default function App() {
//   const [appSettings, setAppSettings] = useLocalStorage<AppSettings>('smt-app-settings', DEFAULT_SETTINGS);
//   const [showSettings, setShowSettings] = useState(false);
//   const [notifications, setNotifications] = useState<string[]>([]);

//   // Реал-тайм данные с настраиваемым интервалом
//   const {
//     marketData,
//     smtSignals,
//     killzoneInfo,
//     healthStatus,
//     loading,
//     error,
//     lastUpdate,
//     refresh
//   } = useRealtimeData(appSettings.autoRefresh ? appSettings.refreshInterval : 0);

//   // WebSocket подключение для мгновенных обновлений
//   const wsConnection = useWebSocket('ws://localhost:8000/ws', {
//     onMessage: useCallback((data) => {
//       if (data.type === 'smt_signal' && appSettings.enableNotifications) {
//         const message = `New ${data.data.signal_type} signal detected!`;
//         setNotifications(prev => [...prev.slice(-4), message]); // Храним последние 5
        
//         // Browser notification
//         if ('Notification' in window && Notification.permission === 'granted') {
//           new Notification('SMT Trading Alert', {
//             body: message,
//             icon: '/favicon.ico'
//           });
//         }
      
















// src/App.tsx

  );
};

export default App;