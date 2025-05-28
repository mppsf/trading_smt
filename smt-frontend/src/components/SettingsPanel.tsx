// src/components/SettingsPanel.tsx
import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { Settings } from '../types';
import { fetchSettings, updateSettings } from '../services/api';

const humanize = (key: string) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => setError('Failed to load settings'));
  }, []);

  const handleChange = (key: keyof Settings, raw: string) => {
    if (!settings) return;
    let value: number | number[];
    
    if (Array.isArray(settings[key])) {
      value = raw
        .split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(n => !isNaN(n));
    } else {
      value = parseFloat(raw);
    }
    setSettings({ ...settings, [key]: value } as Settings);
  };

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateSettings(settings);
      setSuccess(true);
    } catch {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccess(false), 2000);
    }
  };

  if (!settings) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    );
  }

  const entries = Object.entries(settings) as [keyof Settings, number | number[]][];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
        <SettingsIcon className="w-5 h-5 mr-2 text-orange-400" />
        SMT Settings
      </h3>

      <div className="space-y-4">
        {entries.map(([key, val]) => {
          const isArray = Array.isArray(val);
          const displayValue = isArray ? (val as number[]).join(',') : String(val);
          return (
            <div key={key} className="flex flex-col">
              <label
                htmlFor={String(key)}
                className="text-gray-300 mb-1 text-sm font-medium"
              >
                {humanize(String(key))}
              </label>
              <input
                id={String(key)}
                type="text"
                value={displayValue}
                onChange={e => handleChange(key, e.target.value)}
                className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isArray && (
                <small className="text-gray-500 mt-1">
                  Enter numbers separated by commas
                </small>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end mt-6 space-x-4">
        {error && <span className="text-red-400 text-sm">{error}</span>}
        {success && <span className="text-green-400 text-sm">Saved!</span>}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded px-4 py-2 text-sm transition"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;