import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useHive } from '../context/HiveContext'
import { useToast } from '../contexts/ToastContext'
import './Settings.css'
import NotificationSettings from '../components/NotificationSettings'
import SocialNotificationSettings from '../components/SocialNotificationSettings'
import LoRaWANSetupGuide from '../components/LoRaWANSetupGuide'

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const { hives } = useHive()
  const toast = useToast()
  const [settings, setSettings] = useState({
    notifications: true,
    tempMin: 30,
    tempMax: 36,
    humidityMin: 50,
    humidityMax: 60,
    updateInterval: 30
  })

  const [lorawanConfig, setLorawanConfig] = useState({
    devEUI: '',
    appEUI: '',
    appKey: ''
  })
  const [showLoRaWANGuide, setShowLoRaWANGuide] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = () => {
    const saved = localStorage.getItem('beehive-settings')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
    
    const lorawanSaved = localStorage.getItem('lorawan-config')
    if (lorawanSaved) {
      setLorawanConfig(JSON.parse(lorawanSaved))
    }
  }

  const saveSettings = () => {
    localStorage.setItem('beehive-settings', JSON.stringify(settings))
    localStorage.setItem('lorawan-config', JSON.stringify(lorawanConfig))
    toast.success('Nastavenia uložené!')
  }

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleLorawanChange = (field, value) => {
    // Validate hex format (only allow 0-9, A-F, a-f)
    if (value && !/^[0-9A-Fa-f]*$/.test(value)) {
      return // Invalid character, don't update
    }
    
    // Length limits
    const maxLengths = {
      devEUI: 16,
      appEUI: 16,
      appKey: 32
    }
    
    if (value.length > maxLengths[field]) {
      return // Too long, don't update
    }
    
    setLorawanConfig(prev => ({ ...prev, [field]: value.toUpperCase() }))
  }

  const copyLorawanConfig = () => {
    const config = `// LoRaWAN Configuration
const char* devEUI = "${lorawanConfig.devEUI}";
const char* appEUI = "${lorawanConfig.appEUI}";
const char* appKey = "${lorawanConfig.appKey}";`;
    
    navigator.clipboard.writeText(config).then(() => {
      toast.success('Konfigurácia skopírovaná do schránky!')
    }).catch(() => {
      toast.error('Nepodarilo sa skopírovať. Skús manuálne.')
    })
  }

  const isLorawanConfigComplete = () => {
    return lorawanConfig.devEUI.length === 16 && 
           lorawanConfig.appEUI.length === 16 && 
           lorawanConfig.appKey.length === 32
  }

  return (
    <div className="settings">
      <h1>⚙️ Nastavenia</h1>
      
      <div className="settings-section">
        <h2>Základné nastavenia</h2>

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
          <small className="settings-hint">Ako často sa majú aktualizovať dáta z API (10-300s). Kratší interval = viac žiadostí na server.</small>
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

      <div className="settings-section">
        <h2>👥 Sociálne Notifikácie</h2>
        <SocialNotificationSettings />
      </div>

      {/* LoRaWAN configuration moved to per-hive device setup in MyHives */}

      <div className="settings-section">
        <h2>O aplikácii</h2>
        <div className="info-box">
          <p><strong>Verzia:</strong> 1.0.0</p>
          <p><strong>Zariadenie:</strong> ESP32-C3</p>
          <p><strong>Režim:</strong> {navigator.onLine ? '🟢 Online' : '🔴 Offline'}</p>
          <p style={{ marginTop: '16px', fontSize: '13px', opacity: 0.7 }}>
            Páči sa vám táto aplikácia?{' '}
            <a 
              href="https://ko-fi.com/dongfeng400" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#007bff',
                textDecoration: 'underline'
              }}
            >
              Podporiť na Ko-fi ☕
            </a>
          </p>
        </div>
      </div>

      <button className="btn btn-primary" onClick={saveSettings}>
        💾 Uložiť nastavenia
      </button>

      {showLoRaWANGuide && (
        <LoRaWANSetupGuide 
          devEUI={lorawanConfig.devEUI}
          onClose={() => setShowLoRaWANGuide(false)}
        />
      )}
    </div>
  )
}
