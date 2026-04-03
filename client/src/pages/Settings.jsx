import { useState, useEffect } from 'react'
import { useToast } from '../contexts/ToastContext'
import './Settings.css'
import NotificationSettings from '../components/NotificationSettings'

export default function Settings() {
  const toast = useToast()
  const [settings, setSettings] = useState({
    notifications: true,
    tempMin: 30,
    tempMax: 36,
    humidityMin: 40,
    humidityMax: 70,
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
    toast.success('Nastavenia uložené!')
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
          <label htmlFor="updateInterval">Interval aktualizácie (minúty)</label>
          <input
            id="updateInterval"
            type="number"
            value={settings.updateInterval}
            onChange={(e) => handleChange('updateInterval', parseInt(e.target.value))}
            min="5"
            max="60"
          />
          <small className="settings-hint">Ako často sa majú aktualizovať dáta (5-60 min). Zariadenie odosiela dáta každých 30 minút.</small>
        </div>
      </div>

      <div className="settings-section">
        <h2>Optimálne rozsahy</h2>
        <p className="settings-description">
          Nastav optimálne hodnoty pre tvoje včely. Ak hodnoty prekročia tieto limity, dostaneš upozornenie.
          <br />
          <em>Tip: Pre zdravé včely je optimálna teplota 30-36°C a vlhkosť 40-70%.</em>
        </p>
        
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
        <h2>🔔 Sensor Notifikácie</h2>
        <NotificationSettings />
      </div>

      <button className="btn btn-primary" onClick={saveSettings}>
        💾 Uložiť nastavenia
      </button>
    </div>
  )
}
