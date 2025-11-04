import { useState, useEffect } from 'react'
import './Settings.css'

export default function Settings() {
  const [settings, setSettings] = useState({
    hiveId: '',
    notifications: true,
    tempMin: 30,
    tempMax: 36,
    humidityMin: 50,
    humidityMax: 60,
    updateInterval: 30
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = () => {
    const saved = localStorage.getItem('beehive-settings')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
  }

  const saveSettings = () => {
    localStorage.setItem('beehive-settings', JSON.stringify(settings))
    alert('Nastavenia uložené!')
  }

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="settings">
      <h1>⚙️ Nastavenia</h1>

      <div className="settings-section">
        <h2>Základné nastavenia</h2>
        
        <div className="form-group">
          <label htmlFor="hiveId">ID úľa</label>
          <input
            id="hiveId"
            type="text"
            value={settings.hiveId}
            onChange={(e) => handleChange('hiveId', e.target.value)}
            placeholder="napr. HIVE-001"
          />
        </div>

        <div className="form-group">
          <label htmlFor="updateInterval">Interval aktualizácie (sekundy)</label>
          <input
            id="updateInterval"
            type="number"
            value={settings.updateInterval}
            onChange={(e) => handleChange('updateInterval', parseInt(e.target.value))}
            min="10"
            max="300"
          />
        </div>

        <div className="form-group checkbox">
          <input
            id="notifications"
            type="checkbox"
            checked={settings.notifications}
            onChange={(e) => handleChange('notifications', e.target.checked)}
          />
          <label htmlFor="notifications">Povoliť upozornenia</label>
        </div>
      </div>

      <div className="settings-section">
        <h2>Optimálne rozsahy</h2>
        
        <div className="range-group">
          <label>Teplota (°C)</label>
          <div className="range-inputs">
            <input
              type="number"
              value={settings.tempMin}
              onChange={(e) => handleChange('tempMin', parseFloat(e.target.value))}
              placeholder="Min"
            />
            <span>až</span>
            <input
              type="number"
              value={settings.tempMax}
              onChange={(e) => handleChange('tempMax', parseFloat(e.target.value))}
              placeholder="Max"
            />
          </div>
        </div>

        <div className="range-group">
          <label>Vlhkosť (%)</label>
          <div className="range-inputs">
            <input
              type="number"
              value={settings.humidityMin}
              onChange={(e) => handleChange('humidityMin', parseFloat(e.target.value))}
              placeholder="Min"
            />
            <span>až</span>
            <input
              type="number"
              value={settings.humidityMax}
              onChange={(e) => handleChange('humidityMax', parseFloat(e.target.value))}
              placeholder="Max"
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>O aplikácii</h2>
        <div className="info-box">
          <p><strong>Verzia:</strong> 1.0.0</p>
          <p><strong>Zariadenie:</strong> ESP32-C3</p>
          <p><strong>Režim:</strong> {navigator.onLine ? '🟢 Online' : '🔴 Offline'}</p>
        </div>
      </div>

      <button className="btn btn-primary" onClick={saveSettings}>
        💾 Uložiť nastavenia
      </button>
    </div>
  )
}
