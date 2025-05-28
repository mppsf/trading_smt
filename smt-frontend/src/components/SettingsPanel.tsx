import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, AlertCircle } from 'lucide-react';

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
  const activeParams = ['max_signals_display', 'smt_strength_threshold'];
  
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
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  const filteredSettings = Object.entries(settings).filter(([key]) => !isExcluded(key));

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <SettingsIcon className="w-5 h-5 mr-2 text-orange-400" />
        SMT Settings
      </h3>

      <div className="space-y-4">
        {filteredSettings.map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <div className="flex items-center mb-1">
              <label className="text-gray-300 text-sm font-medium">
                {formatKeyName(key)}
              </label>
              {isActive(key) ? (
                <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                  Active
                </span>
              ) : (
                <div className="ml-2 flex items-center">
                  <AlertCircle className="w-3 h-3 text-yellow-500 mr-1" />
                  <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs rounded">
                    Unused
                  </span>
                </div>
              )}
            </div>
            <input
              type="text"
              value={getDisplayValue(value)}
              onChange={e => handleChange(key as keyof Settings, e.target.value)}
              placeholder={Array.isArray(value) ? "Enter comma-separated values" : "Enter value"}
              className={`bg-gray-800 text-white border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent ${
                isActive(key) 
                  ? 'border-gray-700 focus:ring-blue-500' 
                  : 'border-yellow-600 focus:ring-yellow-500'
              }`}
              disabled={!isActive(key)}
            />
            {Array.isArray(value) && (
              <span className="text-xs text-gray-500 mt-1">
                Separate multiple values with commas
              </span>
            )}
            {!isActive(key) && (
              <span className="text-xs text-yellow-400 mt-1">
                This parameter is not currently used by the system
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end mt-6 space-x-4">
        {status.error && <span className="text-red-400 text-sm">{status.error}</span>}
        {status.success && <span className="text-green-400 text-sm">Saved!</span>}
        <button
          onClick={handleSave}
          disabled={status.saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-medium rounded px-4 py-2 text-sm transition-colors"
        >
          {status.saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;