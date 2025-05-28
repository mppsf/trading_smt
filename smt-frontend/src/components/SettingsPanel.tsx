import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Card, StatusBadge, LoadingSpinner } from '../ui';

interface Settings {
  smt_strength_threshold: number;
  killzone_priorities: number[];
  refresh_interval: number;
  max_signals_display: number;
  divergence_threshold?: number;
  confirmation_candles?: number;
  volume_multiplier?: number;
  london_open?: string;
  ny_open?: string;
  asia_open?: string;
}

const fetchSettings = async (): Promise<Settings> => {
  const response = await fetch('http://localhost:8000/api/v1/settings');
  return response.json();
};

const updateSettings = async (payload: Settings): Promise<Settings> => {
  const response = await fetch('http://localhost:8000/api/v1/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
};

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState({ saving: false, error: '', success: false });

  // Активные параметры (используются в fetchSMTSignals)
  const activeParams = [
    'max_signals_display', 
    'smt_strength_threshold',
    'divergence_threshold',
    'confirmation_candles',
    'volume_multiplier',
    'killzone_priorities',
    'refresh_interval'
  ];
  
  // Исключенные параметры (время сессий)
  const excludedParams = ['london_open', 'ny_open', 'asia_open'];

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => setStatus(prev => ({ ...prev, error: 'Failed to load settings' })));
  }, []);

  const handleChange = (key: keyof Settings, value: string) => {
    if (!settings) return;
    let newValue: any = value;
    
    if (Array.isArray(settings[key])) {
      newValue = value
        .split(',')
        .map(s => parseFloat(s.trim().replace(',', '.')))
        .filter(n => !isNaN(n));
    } else if (typeof settings[key] === 'number') {
      newValue = value;
    }
    
    setSettings(prev => prev ? { ...prev, [key]: newValue } : prev);
  };

  const handleSave = async () => {
    if (!settings) return;
    
    const sanitizedSettings: Settings = Object.fromEntries(
      Object.entries(settings).map(([key, value]) => {
        if (Array.isArray(value)) {
          return [key, value];
        } else if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return [key, isNaN(parsed) ? 0 : parsed];
        }
        return [key, value];
      })
    ) as Settings;
    
    setStatus({ saving: true, error: '', success: false });
    try {
      await updateSettings(sanitizedSettings);
      setStatus({ saving: false, error: '', success: true });
      setTimeout(() => setStatus(prev => ({ ...prev, success: false })), 2000);
    } catch {
      setStatus({ saving: false, error: 'Failed to save settings', success: false });
    }
  };

  const formatKeyName = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char ? char.toUpperCase() : '');
  };

  const getDisplayValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(',');
    return String(value);
  };

  const isActive = (key: string) => activeParams.includes(key);
  const isExcluded = (key: string) => excludedParams.includes(key);

  if (!settings) {
    return (
      <Card className="flex items-center justify-center">
        <LoadingSpinner size="md" className="mr-3" />
        <span className="text-gray-400">Loading settings...</span>
      </Card>
    );
  }

  const filteredSettings = Object.entries(settings).filter(([key]) => !isExcluded(key));

  return (
    <Card>
      <div className="flex items-center mb-6">
        <SettingsIcon className="w-5 h-5 mr-2 text-orange-400" />
        <h3 className="text-lg font-semibold text-white">SMT Settings</h3>
      </div>

      <div className="space-y-4">
        {filteredSettings.map(([key, value]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-300 text-sm font-medium">
                {formatKeyName(key)}
              </label>
              <StatusBadge 
                status={isActive(key) ? 'success' : 'neutral'} 
                size="sm"
                withDot
              >
                {isActive(key) ? 'Used' : 'Reserved'}
              </StatusBadge>
            </div>
            <input
              type="text"
              value={getDisplayValue(value)}
              onChange={e => handleChange(key as keyof Settings, e.target.value)}
              placeholder={Array.isArray(value) ? "Comma-separated values" : "Enter value"}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {Array.isArray(value) && (
              <span className="text-xs text-gray-500 mt-1 block">
                Separate multiple values with commas
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end mt-8 space-x-4">
        {status.error && (
          <StatusBadge status="error" size="sm">{status.error}</StatusBadge>
        )}
        {status.success && (
          <StatusBadge status="success" size="sm">Settings saved!</StatusBadge>
        )}
        <button
          onClick={handleSave}
          disabled={status.saving}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-medium rounded-lg text-sm transition-colors"
        >
          {status.saving && <LoadingSpinner size="sm" className="mr-2" />}
          {status.saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </Card>
  );
};

export default SettingsPanel;