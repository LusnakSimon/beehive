// Service Worker for Push Notifications

const CACHE_NAME = 'beehive-v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let data = {
    title: 'Beehive Monitor',
    body: 'New notification',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: 'beehive-notification'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    tag: data.tag || 'beehive-notification',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {},
    vibrate: [200, 100, 200],
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});

// Periodic background sync for checking conditions
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-beehive-conditions') {
    event.waitUntil(checkConditions());
  }
});

async function checkConditions() {
  try {
    const response = await fetch('/api/notifications/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.alerts && result.alerts.length > 0) {
      for (const alert of result.alerts) {
        await self.registration.showNotification(alert.title, {
          body: alert.body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: alert.tag,
          data: { url: '/' }
        });
      }
    }
  } catch (error) {
    console.error('Error checking conditions:', error);
  }
}
