import React, { createContext, useContext, useState, useEffect } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [permission, setPermission] = useState('default');
  const [isSupported, setIsSupported] = useState(false);
  const [registration, setRegistration] = useState(null);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.parse(saved) : {
      enabled: false,
      temperature: true,
      humidity: true,
      battery: true,
      weight: true,
      offline: true
    };
  });

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    // Register service worker
    if (isSupported) {
      registerServiceWorker();
    }
  }, [isSupported]);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      setRegistration(reg);
      
      // Wait for service worker to be ready
      const ready = await navigator.serviceWorker.ready;
      setRegistration(ready);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };

  const requestPermission = async () => {
    if (!isSupported) {
      alert('Notifikácie nie sú podporované v tomto prehliadači');
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm === 'granted') {
        // Show test notification using simple Notification API
        try {
          new Notification('Beehive Monitor', {
            body: 'Notifikácie sú aktivované! 🐝',
            icon: '/icon.svg'
          });
        } catch (e) {
          console.error('Simple notification failed:', e);
          
          // Try with service worker
          if (registration) {
            await registration.showNotification('Beehive Monitor', {
              body: 'Notifikácie sú aktivované! 🐝',
              icon: '/icon.svg',
              badge: '/icon.svg'
            });
          }
        }
        
        updateSettings({ ...settings, enabled: true });
        return true;
      } else {
        updateSettings({ ...settings, enabled: false });
        return false;
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  };

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
  };

  const sendNotification = async (title, options = {}) => {
    if (!isSupported || permission !== 'granted' || !settings.enabled) {
      return;
    }

    try {
      // Try simple notification first
      try {
        new Notification(title, {
          icon: '/icon.svg',
          badge: '/icon.svg',
          ...options
        });
        return;
      } catch (simpleError) {
        // Fallback to service worker notification
      }

      if (registration) {
        await registration.showNotification(title, {
          icon: '/icon.svg',
          badge: '/icon.svg',
          ...options
        });
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  };

  const checkConditions = async (hiveId, hiveName) => {
    if (!settings.enabled || permission !== 'granted') return;
    const label = hiveName || hiveId;
    const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown per alert type
    
    try {
      // Read threshold settings from beehive-settings (written by Settings page)
      const beehiveSettings = JSON.parse(localStorage.getItem('beehive-settings') || '{}');
      const tempMin = beehiveSettings.tempMin ?? 30;
      const tempMax = beehiveSettings.tempMax ?? 36;
      const humidityMin = beehiveSettings.humidityMin ?? 40;
      const humidityMax = beehiveSettings.humidityMax ?? 70;

      // Fetch latest sensor data
      const response = await fetch(`/api/sensor/latest?hiveId=${hiveId}`);
      if (!response.ok) return;
      
      const data = await response.json();
      const alerts = [];
      const resolvedTags = []; // Tags for conditions that are now normal

      // Check temperature
      if (settings.temperature && data.temperature < tempMin) {
        alerts.push({
          title: '🌡️ Nízka teplota!',
          body: `Teplota v úli ${label}: ${data.temperature.toFixed(1)}°C (min: ${tempMin}°C)`,
          tag: `temp-low-${hiveId}`
        });
      } else if (settings.temperature && data.temperature > tempMax) {
        alerts.push({
          title: '🌡️ Vysoká teplota!',
          body: `Teplota v úli ${label}: ${data.temperature.toFixed(1)}°C (max: ${tempMax}°C)`,
          tag: `temp-high-${hiveId}`
        });
      } else if (settings.temperature) {
        // Temperature is normal — clear both temp cooldowns so next spike triggers immediately
        resolvedTags.push(`temp-low-${hiveId}`, `temp-high-${hiveId}`);
      }

      // Check humidity
      if (settings.humidity && data.humidity < humidityMin) {
        alerts.push({
          title: '💧 Nízka vlhkosť!',
          body: `Vlhkosť v úli ${label}: ${data.humidity.toFixed(1)}% (min: ${humidityMin}%)`,
          tag: `humidity-low-${hiveId}`
        });
      } else if (settings.humidity && data.humidity > humidityMax) {
        alerts.push({
          title: '💧 Vysoká vlhkosť!',
          body: `Vlhkosť v úli ${label}: ${data.humidity.toFixed(1)}% (max: ${humidityMax}%)`,
          tag: `humidity-high-${hiveId}`
        });
      } else if (settings.humidity) {
        resolvedTags.push(`humidity-low-${hiveId}`, `humidity-high-${hiveId}`);
      }

      // Battery alert
      if (settings.battery && data.battery !== undefined && data.battery !== null && data.battery < 20) {
        alerts.push({
          title: '🔋 Nízka batéria!',
          body: `Batéria úľa ${label}: ${data.battery}%`,
          tag: `battery-low-${hiveId}`
        });
      } else if (settings.battery) {
        resolvedTags.push(`battery-low-${hiveId}`);
      }

      // Weight change alert — compare with stored previous reading
      const prevKey = `prev-reading-${hiveId}`;
      const prevStr = localStorage.getItem(prevKey);
      const prev = prevStr ? JSON.parse(prevStr) : null;

      if (settings.weight && prev && data.weight != null && prev.weight != null && data.lastUpdate && prev.lastUpdate) {
        const timeDiffHours = (new Date(data.lastUpdate) - new Date(prev.lastUpdate)) / (1000 * 60 * 60);
        if (timeDiffHours > 0 && timeDiffHours <= 4) {
          const weightChange = Math.abs(data.weight - prev.weight);
          const weightChangePerHour = weightChange / timeDiffHours;
          if (weightChangePerHour > 2) {
            const direction = data.weight > prev.weight ? 'nárast' : 'pokles';
            alerts.push({
              title: '⚖️ Výrazná zmena hmotnosti!',
              body: `Úľ ${label}: ${direction} o ${weightChange.toFixed(1)} kg`,
              tag: `weight-change-${hiveId}`
            });
          } else {
            resolvedTags.push(`weight-change-${hiveId}`);
          }
        }
      }

      // Device offline alert
      if (settings.offline && data.lastUpdate) {
        const hoursSince = (Date.now() - new Date(data.lastUpdate).getTime()) / (1000 * 60 * 60);
        if (hoursSince > 1) {
          alerts.push({
            title: '📡 Zariadenie neodpovedá!',
            body: `Úľ ${label}: posledné dáta pred ${Math.floor(hoursSince)}h`,
            tag: `offline-${hiveId}`
          });
        } else {
          resolvedTags.push(`offline-${hiveId}`);
        }
      }

      // Always store current reading for next comparison
      localStorage.setItem(prevKey, JSON.stringify({
        weight: data.weight,
        lastUpdate: data.lastUpdate
      }));

      // Load cooldowns, clear resolved tags, filter active alerts
      const cooldowns = JSON.parse(localStorage.getItem('notif-cooldowns') || '{}');
      const now = Date.now();

      // Clear cooldowns for conditions that resolved (back to normal)
      for (const tag of resolvedTags) {
        delete cooldowns[tag];
      }

      // Send only alerts that aren't in cooldown
      for (const alert of alerts) {
        const lastFired = cooldowns[alert.tag];
        if (lastFired && (now - lastFired) < COOLDOWN_MS) continue; // Skip — still in cooldown

        await sendNotification(alert.title, {
          body: alert.body,
          tag: alert.tag,
          data: { url: '/', hiveId }
        });
        cooldowns[alert.tag] = now;
      }

      localStorage.setItem('notif-cooldowns', JSON.stringify(cooldowns));
    } catch (error) {
      console.error('Error checking conditions:', error);
    }
  };

  const value = {
    permission,
    isSupported,
    settings,
    requestPermission,
    updateSettings,
    sendNotification,
    checkConditions
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
