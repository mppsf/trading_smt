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
    const newValue = Array.isArray(settings[key])
      ? value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
      : parseFloat(value);
    setSettings({ ...settings, [key]: newValue });
  };

  const handleSave = async () => {
    if (!settings) return;
    setStatus({ saving: true, error: '', success: false });
    try {
      await updateSettings(settings);
      setStatus({ saving: false, error: '', success: true });
      setTimeout(() => setStatus(prev => ({ ...prev, success: false })), 2000);
    } catch {
      setStatus({ saving: false, error: 'Failed to save settings', success: false });
    }
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
              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </label>
            <input
              type="text"
              value={Array.isArray(value) ? value.join(',') : String(value)}
              onChange={e => handleChange(key as keyof Settings, e.target.value)}
              className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end mt-6 space-x-4">
        {status.error && <span className="text-red-400 text-sm">{status.error}</span>}
        {status.success && <span className="text-green-400 text-sm">Saved!</span>}
        <button
          onClick={handleSave}
          disabled={status.saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white font-medium rounded px-4 py-2 text-sm transition"
        >
          {status.saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;