import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useHive } from '../context/HiveContext'
import './Settings.css'
import NotificationSettings from '../components/NotificationSettings'

export default function Settings() {
  const { user, refreshUser } = useAuth()
  const { hives } = useHive()
  const [settings, setSettings] = useState({
    notifications: true,
    tempMin: 30,
    tempMax: 36,
    humidityMin: 50,
    humidityMax: 60,
    updateInterval: 30
  })

  const [showAddHive, setShowAddHive] = useState(false)
  const [newHive, setNewHive] = useState({
    name: '',
    location: '',
    color: '#fbbf24'
  })
  const [isAddingHive, setIsAddingHive] = useState(false)

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

  const handleAddHive = async () => {
    if (!newHive.name) {
      alert('Vyplň názov úľa')
      return
    }
    
    setIsAddingHive(true)
    
    try {
      // Generate next hive ID on backend
      const response = await fetch('/api/users/me/hives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newHive.name,
          location: newHive.location,
          color: newHive.color
        })
      })

      if (response.ok) {
        const data = await response.json()
        await refreshUser() // Refresh user data with new JWT
        alert(`Úľ "${newHive.name}" bol úspešne vytvorený!`)
        setNewHive({ name: '', location: '', color: '#fbbf24' })
        setShowAddHive(false)
      } else {
        const error = await response.json()
        alert(`Chyba: ${error.message || 'Nepodarilo sa pridať úľ'}`)
      }
    } catch (error) {
      console.error('Error adding hive:', error)
      alert('Chyba pri pridávaní úľa')
    } finally {
      setIsAddingHive(false)
    }
  }

  const handleDeleteHive = async (hiveId) => {
    if (hives.length === 1) {
      alert('Nemôžeš vymazať posledný úľ!')
      return
    }
    
    const hiveName = hives.find(h => h.id === hiveId)?.name
    if (!confirm(`Naozaj chceš vymazať úľ "${hiveName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/users/me/hives/${hiveId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        await refreshUser() // Refresh user data with new JWT
        alert('Úľ vymazaný!')
      } else {
        const error = await response.json()
        alert(`Chyba: ${error.message || 'Nepodarilo sa vymazať úľ'}`)
      }
    } catch (error) {
      console.error('Error deleting hive:', error)
      alert('Chyba pri mazaní úľa')
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
            <div className="info-box" style={{ marginBottom: '1rem' }}>
              <p>💡 ID úľa sa vygeneruje automaticky</p>
            </div>

            <div className="form-group">
              <label htmlFor="hiveName">Názov úľa *</label>
              <input
                id="hiveName"
                type="text"
                value={newHive.name}
                onChange={(e) => setNewHive(prev => ({ ...prev, name: e.target.value }))}
                placeholder="napr. Záhradný úľ"
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
              <button 
                className="btn-secondary" 
                onClick={() => setShowAddHive(false)}
                disabled={isAddingHive}
              >
                Zrušiť
              </button>
              <button 
                className="btn-primary" 
                onClick={handleAddHive}
                disabled={isAddingHive}
              >
                {isAddingHive ? 'Pridávam...' : 'Pridať úľ'}
              </button>
            </div>
          </div>
        )}
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
    </div>
  )
}
