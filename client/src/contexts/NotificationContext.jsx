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
    
    console.log('Notifications supported:', supported);
    
    if ('Notification' in window) {
      setPermission(Notification.permission);
      console.log('Notification permission:', Notification.permission);
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
      console.log('Attempting to register Service Worker...');
      console.log('Location:', window.location.href);
      console.log('Is HTTPS or localhost?', window.location.protocol === 'https:' || window.location.hostname === 'localhost');
      
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('Service Worker registered:', reg);
      setRegistration(reg);
      
      // Wait for service worker to be ready
      const ready = await navigator.serviceWorker.ready;
      console.log('Service Worker ready:', ready);
      setRegistration(ready);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      console.error('Error details:', error.message, error.stack);
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
      console.log('Permission result:', perm);
      
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
    console.log('Settings updated:', newSettings);
  };

  const sendNotification = async (title, options = {}) => {
    console.log('sendNotification called:', { title, options, permission, isSupported, enabled: settings.enabled });
    
    if (!isSupported) {
      console.error('Notifications not supported');
      alert('Notifikácie nie sú podporované v tomto prehliadači');
      return;
    }

    if (permission !== 'granted') {
      console.error('Permission not granted:', permission);
      alert('Povoľ notifikácie v prehliadači');
      return;
    }

    if (!settings.enabled) {
      console.error('Notifications not enabled in settings');
      return;
    }

    try {
      // Try simple notification first
      try {
        const notif = new Notification(title, {
          icon: '/icon.svg',
          badge: '/icon.svg',
          ...options
        });
        console.log('Simple notification shown:', notif);
        return;
      } catch (simpleError) {
        console.log('Simple notification failed, trying service worker:', simpleError);
      }

      // Fallback to service worker notification
      if (registration) {
        await registration.showNotification(title, {
          icon: '/icon.svg',
          badge: '/icon.svg',
          ...options
        });
        console.log('Service worker notification shown');
      } else {
        console.error('No service worker registration available');
        alert('Service Worker nie je dostupný. Skús refreshnuť stránku.');
      }
    } catch (error) {
      console.error('Error showing notification:', error);
      alert('Chyba pri zobrazení notifikácie: ' + error.message);
    }
  };

  const checkConditions = async (hiveId) => {
    if (!settings.enabled || permission !== 'granted') return;

    try {
      const response = await fetch(`/api/notifications/check?hiveId=${hiveId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      const result = await response.json();
      
      if (result.alerts && result.alerts.length > 0) {
        for (const alert of result.alerts) {
          await sendNotification(alert.title, {
            body: alert.body,
            tag: alert.tag,
            data: { url: '/', hiveId }
          });
        }
      }
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
