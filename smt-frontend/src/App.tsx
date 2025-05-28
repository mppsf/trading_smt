import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, TrendingDown, Minus, Activity, 
  Clock, AlertTriangle, Target, BarChart3,
  Wifi, WifiOff, RefreshCw, Settings,
  ArrowUp, ArrowDown, Eye, Zap, AlertCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// TypeScript интерфейсы согласно backend
interface MarketData {
  symbol: string;
  current_price: number;
  change_percent: number;
  volume: number;
  timestamp: string;
  ohlcv_5m: OHLCV[];
}

interface OHLCV {
  timestamp: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

interface SMTSignal {
  timestamp: string;
  signal_type: 'bullish_divergence' | 'bearish_divergence' | 'neutral';
  strength: number;
  nasdaq_price: number;
  sp500_price: number;
  divergence_percentage: number;
  confirmation_status: boolean;
}

interface KillzoneInfo {
  current: string | null;
  time_remaining: string;
  next_session: string;
  priority: 'high' | 'medium' | 'low';
}

interface HealthStatus {
  status: string;
  redis_status: string;
  timestamp: string;
}

const SMTTradingDashboard: React.FC = () => {
  // Состояние приложения
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [smtSignals, setSmtSignals] = useState<SMTSignal[]>([]);
  const [killzoneInfo, setKillzoneInfo] = useState<KillzoneInfo | null>(null);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // WebSocket подключение
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/market-updates');
    
    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'market_update') {
        setMarketData(data.data.market_data || {});
        setSmtSignals(data.data.smt_signals || []);
        setLastUpdate(new Date());
      } else if (data.type === 'initial_data') {
        setMarketData(data.data || {});
        setLastUpdate(new Date());
      }
    };
    
    ws.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
      setError('WebSocket connection failed');
    };

    return () => {
      ws.close();
    };
  }, []);

  // Получение health status
  useEffect(() => {
    const fetchHealthStatus = async () => {
      try {
        const response = await fetch('http://localhost:8000/health');
        const data = await response.json();
        setHealthStatus(data);
      } catch (error) {
        console.error('Error fetching health status:', error);
      }
    };

    fetchHealthStatus();
    const interval = setInterval(fetchHealthStatus, 30000); // Проверка каждые 30 секунд
    return () => clearInterval(interval);
  }, []);

  // Получение информации о killzones
  useEffect(() => {
    const fetchKillzones = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/v1/killzones');
        const data = await response.json();
        setKillzoneInfo(data);
      } catch (error) {
        console.error('Error fetching killzones:', error);
      }
    };

    fetchKillzones();
    const interval = setInterval(fetchKillzones, 60000); // Обновление каждую минуту
    return () => clearInterval(interval);
  }, []);

  // Получение market data через API
  const fetchMarketData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/v1/market-data?symbols=QQQ,SPY&timeframe=5m&limit=100');
      const data = await response.json();
      
      // Преобразуем массив в объект с ключами по символам
      const marketDataObj: Record<string, MarketData> = {};
      data.forEach((item: MarketData) => {
        marketDataObj[item.symbol] = item;
      });
      
      setMarketData(marketDataObj);
      setLastUpdate(new Date());
      setError(null);
    } catch (error) {
      console.error('Error fetching market data:', error);
      setError('Failed to fetch market data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Получение SMT сигналов
  const fetchSMTSignals = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/smt-signals?limit=50');
      const data = await response.json();
      setSmtSignals(data);
    } catch (error) {
      console.error('Error fetching SMT signals:', error);
    }
  }, []);

  // Ручное обновление данных
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      fetchMarketData(),
      fetchSMTSignals()
    ]);
  }, [fetchMarketData, fetchSMTSignals]);

  // Компонент для отображения цены с трендом
  const PriceDisplay = ({ symbol, data }: { symbol: string; data: MarketData }) => {
    const isPositive = data.change_percent >= 0;
    
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 hover:border-blue-500 transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{symbol}</h3>
          <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            isPositive ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
          }`}>
            {isPositive ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
            {data.change_percent.toFixed(2)}%
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="text-3xl font-bold text-white">
            ${data.current_price.toFixed(2)}
          </div>
          <div className="text-sm text-gray-400">
            Volume: {data.volume?.toLocaleString() || 'N/A'}
          </div>
          <div className="text-xs text-gray-500">
            Updated: {new Date(data.timestamp).toLocaleTimeString()}
          </div>
        </div>
        
        {data.ohlcv_5m && data.ohlcv_5m.length > 0 && (
          <div className="mt-4 h-20">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.ohlcv_5m.slice(-20)}>
                <Area 
                  type="monotone" 
                  dataKey="Close" 
                  stroke={isPositive ? "#10b981" : "#ef4444"}
                  fill={isPositive ? "#10b98120" : "#ef444420"}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  // Компонент SMT сигналов
  const SMTSignalsPanel = () => (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Zap className="w-5 h-5 mr-2 text-blue-400" />
          SMT Signals
        </h3>
        <button
          onClick={fetchSMTSignals}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title="Refresh SMT Signals"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {smtSignals.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            No active SMT signals
          </div>
        ) : (
          smtSignals.slice(-5).map((signal, index) => (
            <div 
              key={index}
              className={`p-4 rounded-lg border-l-4 ${
                signal.signal_type === 'bullish_divergence' 
                  ? 'bg-green-900/20 border-green-400' 
                  : signal.signal_type === 'bearish_divergence'
                  ? 'bg-red-900/20 border-red-400'
                  : 'bg-gray-800 border-gray-500'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-white capitalize">
                  {signal.signal_type.replace('_', ' ')}
                </span>
                <span className="text-sm text-gray-400">
                  {new Date(signal.timestamp).toLocaleTimeString()}
                </span>
              </div>
              
              <div className="text-sm space-y-1">
                <div className="text-gray-300">
                  Strength: {(signal.strength * 100).toFixed(1)}%
                </div>
                <div className="text-gray-300">
                  Divergence: {signal.divergence_percentage.toFixed(2)}%
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>NASDAQ: ${signal.nasdaq_price.toFixed(2)}</span>
                  <span>S&P500: ${signal.sp500_price.toFixed(2)}</span>
                </div>
                <div className={`flex items-center ${
                  signal.confirmation_status ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${
                    signal.confirmation_status ? 'bg-green-400' : 'bg-yellow-400'
                  }`} />
                  {signal.confirmation_status ? 'Confirmed' : 'Pending'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Компонент Killzone статуса
  const KillzoneStatus = () => (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Clock className="w-5 h-5 mr-2 text-purple-400" />
        Trading Sessions
      </h3>
      
      {killzoneInfo ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Active Session:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              killzoneInfo.current 
                ? killzoneInfo.priority === 'high' 
                  ? 'bg-green-900 text-green-400'
                  : killzoneInfo.priority === 'medium'
                  ? 'bg-yellow-900 text-yellow-400'
                  : 'bg-blue-900 text-blue-400'
                : 'bg-gray-800 text-gray-400'
            }`}>
              {killzoneInfo.current || 'None'}
            </span>
          </div>
          
          {killzoneInfo.current && (
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Time Remaining:</span>
              <span className="text-white font-medium">
                {killzoneInfo.time_remaining}
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Next Session:</span>
            <span className="text-blue-400 font-medium">
              {killzoneInfo.next_session}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-300">Priority:</span>
            <div className={`px-2 py-1 rounded text-sm ${
              killzoneInfo.priority === 'high' ? 'bg-red-900 text-red-400' :
              killzoneInfo.priority === 'medium' ? 'bg-yellow-900 text-yellow-400' :
              'bg-gray-800 text-gray-400'
            }`}>
              {killzoneInfo.priority.toUpperCase()}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-gray-400">Loading session info...</div>
      )}
    </div>
  );

  // Компонент статуса системы
  const SystemStatusPanel = () => (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <Activity className="w-5 h-5 mr-2 text-green-400" />
        System Status
      </h3>
      
      {healthStatus ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">API Status:</span>
            <div className={`flex items-center px-2 py-1 rounded text-sm ${
              healthStatus.status === 'healthy' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                healthStatus.status === 'healthy' ? 'bg-green-400' : 'bg-red-400'
              }`} />
              {healthStatus.status}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Redis:</span>
            <div className={`flex items-center px-2 py-1 rounded text-sm ${
              healthStatus.redis_status === 'healthy' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                healthStatus.redis_status === 'healthy' ? 'bg-green-400' : 'bg-red-400'
              }`} />
              {healthStatus.redis_status}
            </div>
          </div>
          
          <div className="text-xs text-gray-500">
            Checked: {new Date(healthStatus.timestamp).toLocaleString()}
          </div>
        </div>
      ) : (
        <div className="text-gray-400">Loading status...</div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
                onClick={handleRefresh}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors flex items-center"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
              
              <div className="text-sm text-gray-400">
                {lastUpdate && `Last update: ${lastUpdate.toLocaleTimeString()}`}
              </div>
              
              <Settings className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Market Data Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Price Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(marketData).length === 0 ? (
                <div className="col-span-2 bg-gray-900 border border-gray-700 rounded-xl p-8 text-center">
                  <div className="text-gray-400">
                    {isLoading ? 'Loading market data...' : 'No market data available'}
                  </div>
                  {!isLoading && (
                    <button
                      onClick={fetchMarketData}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Load Market Data
                    </button>
                  )}
                </div>
              ) : (
                Object.entries(marketData).map(([symbol, data]) => (
                  <PriceDisplay key={symbol} symbol={symbol} data={data} />
                ))
              )}
            </div>
            
            {/* Chart Section */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-green-400" />
                Price Comparison
              </h3>
              
              <div className="h-64">
                {marketData.QQQ?.ohlcv_5m && marketData.SPY?.ohlcv_5m ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="timestamp" 
                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                        tickFormatter={(value: any) => new Date(value).toLocaleTimeString()}
                      />
                      <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Close" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        dot={false}
                        data={marketData.QQQ.ohlcv_5m.slice(-20)}
                        name="NASDAQ (QQQ)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="Close" 
                        stroke="#F59E0B" 
                        strokeWidth={2}
                        dot={false}
                        data={marketData.SPY.ohlcv_5m.slice(-20)}
                        name="S&P 500 (SPY)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    {Object.keys(marketData).length === 0 ? 'No market data to display' : 'Loading chart data...'}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            <SystemStatusPanel />
            <KillzoneStatus />
            <SMTSignalsPanel />
          </div>
        </div>
      </main>
    </div>
  );
};

export default SMTTradingDashboard;