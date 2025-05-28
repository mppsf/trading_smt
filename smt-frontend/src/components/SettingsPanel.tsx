// src/components/SettingsPanel.tsx
import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Settings } from '../types';
import { fetchSettings, updateSettings } from '../services/api';

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState({ saving: false, error: '', success: false });

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => setStatus(prev => ({ ...prev, error: 'Failed to load settings' })));
  }, []);

  const handleChange = (key: keyof Settings, value: string) => {
    if (!settings) return;
  
    let newValue: any = value;
  
    if (Array.isArray(settings[key])) {
      // Массив: поддержка десятичных через запятую и чисел через запятую
      newValue = value
        .split(',')
        .map(s => parseFloat(s.trim().replace(',', '.')))
        .filter(n => !isNaN(n));
    } else if (typeof settings[key] === 'number') {
      // Пока оставляем как строку — не парсим, чтобы не мешать вводу
      newValue = value;
    }
  
    setSettings(prev => prev ? { ...prev, [key]: newValue } : prev);
  };
  

  const handleSave = async () => {
    if (!settings) return;
  
    // Преобразуем все строки чисел в настоящие числа перед сохранением
    const sanitizedSettings: Settings = Object.fromEntries(
      Object.entries(settings).map(([key, value]) => {
        if (Array.isArray(value)) {
          return [key, value];
        } else if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return [key, isNaN(parsed) ? 0 : parsed]; // по желанию: обработка NaN
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
  

  // Helper function to format setting key names
  const formatKeyName = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char ? char.toUpperCase() : '');
  };

  // Helper function to safely get display value
  const getDisplayValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join(',');
    return String(value);
  };

  if (!settings) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <SettingsIcon className="w-5 h-5 mr-2 text-orange-400" />
        SMT Settings
      </h3>

      <div className="space-y-4">
        {Object.entries(settings).map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <label className="text-gray-300 mb-1 text-sm font-medium">
              {formatKeyName(key)}
            </label>
            <input
              type="text"
              value={getDisplayValue(value)}
              onChange={e => handleChange(key as keyof Settings, e.target.value)}
              placeholder={Array.isArray(value) ? "Enter comma-separated values" : "Enter value"}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {Array.isArray(value) && (
              <span className="text-xs text-gray-500 mt-1">
                Separate multiple values with commas
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