// Service Worker for Push Notifications and basic offline asset handling

const CACHE_NAME = 'beehive-v1';
const ASSET_CACHE = 'beehive-assets-v2';

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  // Pre-cache the app shell (index.html and root) so we can fallback when offline
  event.waitUntil(
    caches.open(ASSET_CACHE).then(cache => cache.addAll(['/', '/index.html'])).catch(err => {
      console.warn('SW: precache failed', err);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  // Remove old caches so stale assets don't persist
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (k !== ASSET_CACHE && k !== CACHE_NAME) {
        console.log('SW: deleting old cache', k);
        return caches.delete(k);
      }
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

// allow clients to message the SW (e.g., to trigger skipWaiting after deploy)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
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

// Basic fetch handler: network-first for navigations, network-with-cache-fallback for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle GET requests
  if (request.method !== 'GET') return;

  const accept = request.headers.get('accept') || '';

  // Navigation requests (HTML) - try network, fall back to cached root
  if (request.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(
      fetch(request).then(response => {
        // update cache with latest index
        const copy = response.clone();
        caches.open(ASSET_CACHE).then(cache => cache.put('/index.html', copy)).catch(()=>{})
        return response;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For assets (css/js/images), try network then fallback to cache
  event.respondWith(
    fetch(request).then(response => {
      try { caches.open(ASSET_CACHE).then(cache => cache.put(request, response.clone())); } catch (e) {}
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      // as a last resort for missing assets, return the cached index (so SPA can render)
      return caches.match('/index.html');
    })
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
