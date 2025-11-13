import { useState, useEffect } from 'react'
import './SocialNotificationSettings.css'

export default function SocialNotificationSettings() {
  const [settings, setSettings] = useState({
    friendRequests: true,
    friendRequestAccepted: true,
    newMessages: true
  })
  const [pushEnabled, setPushEnabled] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('socialPushNotifications')
    if (saved) {
      setSettings(JSON.parse(saved))
    }
    
    // Check if push notifications are supported and enabled
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted')
    }
  }, [])

  const handleToggle = (key) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    }
    setSettings(newSettings)
    localStorage.setItem('socialPushNotifications', JSON.stringify(newSettings))
    
    // Show save confirmation
    setSaveStatus('Uložené ✓')
    setTimeout(() => setSaveStatus(''), 2000)
  }

  const requestPushPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setPushEnabled(permission === 'granted')
      
      if (permission === 'granted') {
        setSaveStatus('Push notifikácie povolené ✓')
        setTimeout(() => setSaveStatus(''), 3000)
      }
    }
  }

  return (
    <div className="social-notification-settings">
      <div className="settings-info-box">
        <p><strong>📬 Push Notifikácie</strong></p>
        <p>Dostávajte upozornenia aj keď nie ste na stránke</p>
      </div>

      {!pushEnabled && (
        <div className="push-permission-prompt">
          <p>⚠️ Push notifikácie nie sú povolené</p>
          <button onClick={requestPushPermission} className="enable-push-btn">
            Povoliť Push Notifikácie
          </button>
        </div>
      )}

      {saveStatus && (
        <div className="save-status">
          {saveStatus}
        </div>
      )}

      <div className="social-setting-item">
        <div className="social-setting-info">
          <label htmlFor="friendRequests">👥 Žiadosti o priateľstvo</label>
          <p className="social-setting-desc">Push notifikácia keď vám niekto pošle žiadosť</p>
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
          <p className="social-setting-desc">Push notifikácia keď niekto príjme vašu žiadosť</p>
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
          <p className="social-setting-desc">Push notifikácia pri novej správe</p>
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
        <p>Push notifikácie vás upozornia aj keď nie ste na stránke. In-app upozornenia (zoznam) a badge počítadlá zostávajú vždy aktívne. Nastavenia sa ukladajú automaticky.</p>
      </div>
    </div>
  )
}
