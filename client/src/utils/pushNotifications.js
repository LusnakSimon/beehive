// Push Notifications Utility

/**
 * Request permission for push notifications
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Check if notifications are supported and enabled
 */
export function areNotificationsEnabled() {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Get user's push notification preferences from localStorage
 */
export function getPushSettings() {
  const saved = localStorage.getItem('beehive-settings');
  if (saved) {
    return JSON.parse(saved);
  }
  return {};
}

/**
 * Show a push notification using service worker
 * @param {string} title - Notification title
 * @param {object} options - Notification options
 */
export async function showPushNotification(title, options = {}) {
  if (!areNotificationsEnabled()) {
    console.log('Notifications not enabled');
    return null;
  }

  const defaultOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options
  };

  try {
    // Use service worker if available for better notification support
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      return await registration.showNotification(title, defaultOptions);
    } else {
      // Fallback to regular Notification API
      return new Notification(title, defaultOptions);
    }
  } catch (error) {
    console.error('Error showing notification:', error);
    return null;
  }
}

/**
 * Setup notification click handler
 */
export function setupNotificationClickHandler(navigate) {
  // Listen for notification clicks
  if ('Notification' in window) {
    // For service worker notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'notification-click') {
          const url = event.data.url;
          if (url && navigate) {
            navigate(url);
          }
        }
      });
    }
  }
}
