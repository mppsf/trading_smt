// src/components/SettingsPanel.tsx
import React, { useEffect, useState } from 'react';
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

  // Загрузка настроек при монтировании
  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => setError('Не удалось загрузить настройки'));
  }, []);

  // Обработка изменения любого поля
  const handleChange = (key: keyof Settings, raw: string) => {
    if (!settings) return;
    let value: number | number[];
    // Если поле — массив чисел
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

  // Сохранение на бэкенд
  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateSettings(settings);
      setSuccess(true);
    } catch {
      setError('Не удалось сохранить настройки');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccess(false), 2000);
    }
  };

  if (!settings) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-gray-400">
        Загрузка настроек…
      </div>
    );
  }

  const entries = Object.entries(settings) as [keyof Settings, number | number[]][];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        Настройки SMT-анализа
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {entries.map(([key, val]) => {
          const isArray = Array.isArray(val);
          const displayValue = isArray ? (val as number[]).join(',') : String(val);
          return (
            <div key={key} className="flex flex-col">
              <label
                htmlFor={String(key)}
                className="text-gray-300 mb-1 font-medium"
              >
                {humanize(String(key))}
              </label>
              <input
                id={String(key)}
                type="text"
                value={displayValue}
                onChange={e => handleChange(key, e.target.value)}
                className="bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isArray && (
                <small className="text-gray-500 mt-1">
                  Ввод: числа, разделённые запятыми
                </small>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end mt-6 space-x-4">
        {error && <span className="text-red-400">{error}</span>}
        {success && <span className="text-green-400">Сохранено!</span>}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`
            flex items-center gap-2 
            bg-blue-600 hover:bg-blue-500 
            disabled:bg-gray-600 disabled:cursor-not-allowed
            text-white font-medium rounded px-4 py-2 transition
          `}
        >
          {isSaving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
