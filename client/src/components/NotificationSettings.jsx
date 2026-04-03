import { useNotifications } from '../contexts/NotificationContext';
import './NotificationSettings.css';

export default function NotificationSettings() {
  const {
    permission,
    settings,
    requestPermission,
    updateSettings
  } = useNotifications();

  return (
    <div className="notification-settings">
      <div className="info-box">
        <p>Zapni notifikácie pre upozornenia na:</p>
        <p>• Teplota mimo rozsahu</p>
        <p>• Vlhkosť mimo rozsahu</p>
        <p>• Nízka batéria (&lt; 20%)</p>
        <p>• Zmena hmotnosti (&gt; 2kg za hodinu)</p>
        <p>• Zariadenie offline (&gt; 1 hodina)</p>
      </div>

      <div className="form-group checkbox">
        <input
          type="checkbox"
          id="notifEnabled"
          checked={settings.enabled}
          onChange={(e) => {
            if (e.target.checked) {
              requestPermission();
            } else {
              updateSettings({ ...settings, enabled: false });
            }
          }}
        />
        <label htmlFor="notifEnabled">Povoliť notifikácie</label>
      </div>

      {permission === 'denied' && (
        <div className="info-box error-box">
          <p>
            ⚠️ Notifikácie sú blokované v prehliadači. Povoľ ich v nastaveniach prehliadača.
          </p>
        </div>
      )}

      {settings.enabled && (
        <>
          <div className="notification-types">
            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="notifTemp"
                checked={settings.temperature}
                onChange={(e) => updateSettings({ ...settings, temperature: e.target.checked })}
              />
              <label htmlFor="notifTemp">🌡️ Teplota mimo rozsahu</label>
            </div>

            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="notifHumidity"
                checked={settings.humidity}
                onChange={(e) => updateSettings({ ...settings, humidity: e.target.checked })}
              />
              <label htmlFor="notifHumidity">💧 Vlhkosť mimo rozsahu</label>
            </div>

            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="notifBattery"
                checked={settings.battery}
                onChange={(e) => updateSettings({ ...settings, battery: e.target.checked })}
              />
              <label htmlFor="notifBattery">🔋 Nízka batéria</label>
            </div>

            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="notifWeight"
                checked={settings.weight}
                onChange={(e) => updateSettings({ ...settings, weight: e.target.checked })}
              />
              <label htmlFor="notifWeight">⚖️ Zmena hmotnosti</label>
            </div>

            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="notifOffline"
                checked={settings.offline}
                onChange={(e) => updateSettings({ ...settings, offline: e.target.checked })}
              />
              <label htmlFor="notifOffline">📡 Zariadenie offline</label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
