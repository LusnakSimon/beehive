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
    setIsSupported('Notification' in window && 'serviceWorker' in navigator);
    
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
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', reg);
      setRegistration(reg);
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
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
        // Show test notification
        if (registration) {
          await registration.showNotification('Beehive Monitor', {
            body: 'Notifikácie sú aktivované! 🐝',
            icon: '/icon.svg',
            badge: '/icon.svg'
          });
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
      console.log('Notifications not enabled');
      return;
    }

    try {
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
