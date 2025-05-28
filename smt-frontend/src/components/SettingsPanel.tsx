// src/components/SettingsPanel.tsx - Улучшенная версия
import React, { useEffect, useState, useCallback } from 'react';
import { Settings as SettingsIcon, Check, AlertCircle, Info, Zap } from 'lucide-react';
import { StatusBadge, Card } from '../ui';

interface Settings {
  smt_strength_threshold: number;
  killzone_priorities: number[];
  refresh_interval: number;
  max_signals_display: number;
  divergence_threshold: number;
  confirmation_candles: number;
  volume_multiplier: number;
}

// Конфигурация параметров для улучшенного UX
const PARAM_CONFIG = {
  // Активные параметры (используются в API)
  active: {
    smt_strength_threshold: {
      label: 'Signal Strength',
      desc: 'Minimum strength for signal detection (0.1-1.0)',
      min: 0.1, max: 1.0, step: 0.1,
      icon: <Zap className="w-4 h-4" />
    },
    max_signals_display: {
      label: 'Max Signals',
      desc: 'Maximum number of signals to display',
      min: 10, max: 200, step: 10,
      icon: <Info className="w-4 h-4" />
    },
    divergence_threshold: {
      label: 'Divergence %',
      desc: 'Minimum divergence percentage (1.0-10.0)',
      min: 1.0, max: 10.0, step: 0.5,
      icon: <AlertCircle className="w-4 h-4" />
    },
    confirmation_candles: {
      label: 'Confirmation',
      desc: 'Number of candles for confirmation (1-10)',
      min: 1, max: 10, step: 1,
      icon: <Check className="w-4 h-4" />
    },
    volume_multiplier: {
      label: 'Volume Multiplier',
      desc: 'Volume spike detection multiplier (1.0-5.0)',
      min: 1.0, max: 5.0, step: 0.1,
      icon: <Zap className="w-4 h-4" />
    }
  },
  // Системные параметры
  system: {
    refresh_interval: {
      label: 'Refresh Rate',
      desc: 'Data update interval in seconds',
      min: 5, max: 300, step: 5,
      format: (val: number) => `${val/1000}s`
    },
    killzone_priorities: {
      label: 'Session Priorities',
      desc: 'Trading session priority levels (comma-separated)',
      isArray: true
    }
  }
} as const;

const fetchSettings = async (): Promise<Settings> => {
  const response = await fetch('http://localhost:8000/api/v1/settings');
  if (!response.ok) throw new Error('Failed to fetch settings');
  return response.json();
};

const updateSettings = async (payload: Settings): Promise<Settings> => {
  const response = await fetch('http://localhost:8000/api/v1/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Failed to update settings');
  return response.json();
};

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState({ saving: false, error: '', success: false });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => setStatus(prev => ({ ...prev, error: 'Failed to load settings' })));
  }, []);

  const handleChange = useCallback((key: keyof Settings, value: string) => {
    if (!settings) return;
    
    let parsedValue: any = value;
    const config = PARAM_CONFIG.active[key as keyof typeof PARAM_CONFIG.active] || 
                  PARAM_CONFIG.system[key as keyof typeof PARAM_CONFIG.system];
    
    if (config?.isArray) {
      parsedValue = value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    } else if (typeof settings[key] === 'number') {
      parsedValue = parseFloat(value) || 0;
    }
    
    setSettings(prev => prev ? { ...prev, [key]: parsedValue } : prev);
    setIsDirty(true);
  }, [settings]);

  const handleSave = async () => {
    if (!settings || !isDirty) return;
    
    setStatus({ saving: true, error: '', success: false });
    try {
      await updateSettings(settings);
      setStatus({ saving: false, error: '', success: true });
      setIsDirty(false);
      setTimeout(() => setStatus(prev => ({ ...prev, success: false })), 3000);
    } catch (error) {
      setStatus({ 
        saving: false, 
        error: error instanceof Error ? error.message : 'Save failed', 
        success: false 
      });
    }
  };

  const renderParamGroup = (
    title: string, 
    params: Record<string, any>, 
    isActive = true
  ) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-md font-medium text-white">{title}</h4>
        <StatusBadge 
          status={isActive ? 'success' : 'warning'} 
          size="sm"
          withDot
        >
          {isActive ? 'Active' : 'System'}
        </StatusBadge>
      </div>
      
      {Object.entries(params).map(([key, config]) => {
        if (!settings || !(key in settings)) return null;
        
        const value = settings[key as keyof Settings];
        const displayValue = config.isArray 
          ? Array.isArray(value) ? value.join(',') : String(value)
          : String(value);

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {config.icon}
                <label className="text-sm font-medium text-gray-200">
                  {config.label}
                </label>
              </div>
              {config.format && typeof value === 'number' && (
                <span className="text-xs text-blue-400 font-mono">
                  {config.format(value)}
                </span>
              )}
            </div>
            
            <input
              type={config.isArray ? 'text' : 'number'}
              value={displayValue}
              onChange={e => handleChange(key as keyof Settings, e.target.value)}
              min={config.min}
              max={config.max}
              step={config.step}
              className={`w-full bg-gray-800 text-white border rounded-lg px-3 py-2 text-sm 
                focus:outline-none focus:ring-2 focus:border-transparent transition-all
                ${isActive 
                  ? 'border-gray-600 focus:ring-blue-500' 
                  : 'border-yellow-600 focus:ring-yellow-500'
                }`}
              placeholder={config.isArray ? "1,2,3" : "Enter value"}
            />
            
            <p className="text-xs text-gray-400">{config.desc}</p>
          </div>
        );
      })}
    </div>
  );

  if (!settings) {
    return (
      <Card className="animate-pulse">
        <div className="h-6 bg-gray-700 rounded mb-4"></div>
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-4 bg-gray-700 rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <SettingsIcon className="w-5 h-5 mr-2 text-orange-400" />
          SMT Configuration
        </h3>
        {isDirty && (
          <StatusBadge status="warning" size="sm">
            Unsaved changes
          </StatusBadge>
        )}
      </div>

      <div className="space-y-8">
        {renderParamGroup('Signal Detection', PARAM_CONFIG.active, true)}
        {renderParamGroup('System Settings', PARAM_CONFIG.system, false)}
      </div>

      <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-700">
        <div className="flex items-center space-x-4 text-sm">
          {status.error && (
            <StatusBadge status="error" size="sm">
              {status.error}
            </StatusBadge>
          )}
          {status.success && (
            <StatusBadge status="success" size="sm">
              Settings saved!
            </StatusBadge>
          )}
        </div>
        
        <button
          onClick={handleSave}
          disabled={status.saving || !isDirty}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
            disabled:from-gray-600 disabled:to-gray-700 text-white font-medium rounded-lg transition-all duration-200
            flex items-center space-x-2 disabled:cursor-not-allowed"
        >
          {status.saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>
    </Card>
  );
};

export default SettingsPanel;