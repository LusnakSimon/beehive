import { useState, useEffect } from 'react'
import { useHive } from '../context/HiveContext'
import './Settings.css'
import NotificationSettings from '../components/NotificationSettings'

export default function Settings() {
  const { hives, addHive, updateHive, deleteHive } = useHive()
  const [settings, setSettings] = useState({
    notifications: true,
    tempMin: 30,
    tempMax: 36,
    humidityMin: 50,
    humidityMax: 60,
    updateInterval: 30,
    loraDevEUI: '',
    loraAppEUI: '',
    loraAppKey: ''
  })

  const [showAddHive, setShowAddHive] = useState(false)
  const [newHive, setNewHive] = useState({
    id: '',
    name: '',
    location: '',
    color: '#fbbf24'
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

  const handleAddHive = () => {
    if (!newHive.id || !newHive.name) {
      alert('Vyplň ID a názov úľa')
      return
    }
    
    addHive(newHive)
    setNewHive({ id: '', name: '', location: '', color: '#fbbf24' })
    setShowAddHive(false)
    alert('Úľ pridaný!')
  }

  const handleDeleteHive = (id) => {
    if (confirm('Naozaj chceš vymazať tento úľ?')) {
      deleteHive(id)
      alert('Úľ vymazaný!')
    }
  }

  const colors = ['#fbbf24', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b']

  return (
    <div className="settings">
      <h1>⚙️ Nastavenia</h1>

      <div className="settings-section">
        <h2>Správa úľov</h2>
        
        <div className="hives-list">
          {hives.map(hive => (
            <div key={hive.id} className="hive-item">
              <div className="hive-item-icon" style={{ backgroundColor: hive.color }}>
                🐝
              </div>
              <div className="hive-item-info">
                <div className="hive-item-name">{hive.name}</div>
                <div className="hive-item-id">{hive.id}</div>
                {hive.location && (
                  <div className="hive-item-location">📍 {hive.location}</div>
                )}
              </div>
              <button 
                className="btn-delete-hive"
                onClick={() => handleDeleteHive(hive.id)}
                disabled={hives.length === 1}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>

        {!showAddHive ? (
          <button className="btn-add-hive" onClick={() => setShowAddHive(true)}>
            ➕ Pridať nový úľ
          </button>
        ) : (
          <div className="add-hive-form">
            <div className="form-group">
              <label htmlFor="hiveId">ID úľa *</label>
              <input
                id="hiveId"
                type="text"
                value={newHive.id}
                onChange={(e) => setNewHive(prev => ({ ...prev, id: e.target.value }))}
                placeholder="napr. HIVE-004"
              />
            </div>

            <div className="form-group">
              <label htmlFor="hiveName">Názov úľa *</label>
              <input
                id="hiveName"
                type="text"
                value={newHive.name}
                onChange={(e) => setNewHive(prev => ({ ...prev, name: e.target.value }))}
                placeholder="napr. Úľ 4"
              />
            </div>

            <div className="form-group">
              <label htmlFor="hiveLocation">Lokalita (voliteľné)</label>
              <input
                id="hiveLocation"
                type="text"
                value={newHive.location}
                onChange={(e) => setNewHive(prev => ({ ...prev, location: e.target.value }))}
                placeholder="napr. Záhrada D"
              />
            </div>

            <div className="form-group">
              <label>Farba</label>
              <div className="color-picker">
                {colors.map(color => (
                  <button
                    key={color}
                    className={`color-option ${newHive.color === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewHive(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setShowAddHive(false)}>
                Zrušiť
              </button>
              <button className="btn-primary" onClick={handleAddHive}>
                Pridať úľ
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h2>📡 LoRaWAN konfigurácia</h2>
        
        <div className="form-group">
          <label htmlFor="loraDevEUI">Device EUI</label>
          <input
            id="loraDevEUI"
            type="text"
            value={settings.loraDevEUI}
            onChange={(e) => handleChange('loraDevEUI', e.target.value)}
            placeholder="0000000000000000"
            maxLength="16"
          />
        </div>

        <div className="form-group">
          <label htmlFor="loraAppEUI">Application EUI</label>
          <input
            id="loraAppEUI"
            type="text"
            value={settings.loraAppEUI}
            onChange={(e) => handleChange('loraAppEUI', e.target.value)}
            placeholder="0000000000000000"
            maxLength="16"
          />
        </div>

        <div className="form-group">
          <label htmlFor="loraAppKey">Application Key</label>
          <input
            id="loraAppKey"
            type="text"
            value={settings.loraAppKey}
            onChange={(e) => handleChange('loraAppKey', e.target.value)}
            placeholder="00000000000000000000000000000000"
            maxLength="32"
          />
        </div>

        <div className="info-box">
          <p>💡 Tieto hodnoty získaš z The Things Network konzoly</p>
          <p>🔒 Údaje sa ukladajú len lokálne vo tvojom telefóne</p>
          <p>📶 Frekvencia: EU868, Metóda: OTAA</p>
        </div>
      </div>

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
        <h2>🔔 Notifikácie</h2>
        <NotificationSettings />
      </div>

      <div className="settings-section">
        <h2>O aplikácii</h2>
        <div className="info-box">
          <p><strong>Verzia:</strong> 1.0.0</p>
          <p><strong>Zariadenie:</strong> ESP32-C3</p>
          <p><strong>Režim:</strong> {navigator.onLine ? '🟢 Online' : '🔴 Offline'}</p>
        </div>
      </div>

      <div className="settings-section">
        <h2>💝 Podpora projektu</h2>
        <div className="info-box">
          <p>Páči sa vám táto aplikácia? Podporte jej vývoj!</p>
          <a 
            href="https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px',
              marginTop: '12px',
              textDecoration: 'none',
              backgroundColor: '#0070ba'
            }}
          >
            <span>💳</span>
            <span>Podporiť cez PayPal</span>
          </a>
        </div>
      </div>

      <button className="btn btn-primary" onClick={saveSettings}>
        💾 Uložiť nastavenia
      </button>
    </div>
  )
}
