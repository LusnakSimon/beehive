import { useState, useEffect } from 'react'
import './SocialNotificationSettings.css'

export default function SocialNotificationSettings() {
  const [settings, setSettings] = useState({
    friendRequests: true,
    friendRequestAccepted: true,
    newMessages: false  // Using badge instead by default
  })

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('socialNotificationSettings')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
  }, [])

  const handleToggle = (key) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    }
    setSettings(newSettings)
    localStorage.setItem('socialNotificationSettings', JSON.stringify(newSettings))
  }

  return (
    <div className="social-notification-settings">
      <div className="settings-info-box">
        <p><strong>Sociálne upozornenia:</strong></p>
        <p>• Žiadosti o priateľstvo</p>
        <p>• Prijaté žiadosti</p>
        <p>• Nové správy (voliteľné)</p>
      </div>

      <div className="social-setting-item">
        <div className="social-setting-info">
          <label htmlFor="friendRequests">👥 Žiadosti o priateľstvo</label>
          <p className="social-setting-desc">Upozornenie keď vám niekto pošle žiadosť</p>
        </div>
        <label className="social-toggle-switch">
          <input
            id="friendRequests"
            type="checkbox"
            checked={settings.friendRequests}
            onChange={() => handleToggle('friendRequests')}
          />
          <span className="social-toggle-slider"></span>
        </label>
      </div>

      <div className="social-setting-item">
        <div className="social-setting-info">
          <label htmlFor="friendRequestAccepted">✅ Prijaté žiadosti</label>
          <p className="social-setting-desc">Upozornenie keď niekto príjme vašu žiadosť</p>
        </div>
        <label className="social-toggle-switch">
          <input
            id="friendRequestAccepted"
            type="checkbox"
            checked={settings.friendRequestAccepted}
            onChange={() => handleToggle('friendRequestAccepted')}
          />
          <span className="social-toggle-slider"></span>
        </label>
      </div>

      <div className="social-setting-item">
        <div className="social-setting-info">
          <label htmlFor="newMessages">💬 Nové správy</label>
          <p className="social-setting-desc">Upozornenie pri novej správe (okrem badge)</p>
        </div>
        <label className="social-toggle-switch">
          <input
            id="newMessages"
            type="checkbox"
            checked={settings.newMessages}
            onChange={() => handleToggle('newMessages')}
          />
          <span className="social-toggle-slider"></span>
        </label>
      </div>

      <div className="social-settings-note">
        <span className="social-note-icon">ℹ️</span>
        <p>Badge pri ikonách v navigácii sa zobrazuje vždy. Tieto nastavenia ovplyvňujú len in-app notifikácie v zozname upozornení.</p>
      </div>
    </div>
  )
}
