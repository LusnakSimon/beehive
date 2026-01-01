// Service Worker for Push Notifications and basic offline asset handling
// Increment this version when deploying new code to bust cache
const SW_VERSION = '2.0.0';
const CACHE_NAME = 'beehive-v2';
const ASSET_CACHE = 'beehive-assets-v3';

// Files that should never be cached (always fetch fresh)
const NO_CACHE_PATTERNS = [
  '/api/',
  '/socket.io/',
  '.hot-update.',
  'sockjs-node'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installing... version:', SW_VERSION);
  // Skip waiting to activate immediately
  event.waitUntil(
    caches.open(ASSET_CACHE).then(cache => cache.addAll(['/', '/index.html'])).catch(err => {
      console.warn('SW: precache failed', err);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating... version:', SW_VERSION);
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
  if (event.data === 'clearCache') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
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
  if (request.method !== 'GET') return;
  
  const url = new URL(request.url);
  
  // Never cache API calls, socket.io, or hot updates
  const shouldSkipCache = NO_CACHE_PATTERNS.some(pattern => url.pathname.includes(pattern));
  if (shouldSkipCache) {
    return; // Let browser handle normally
  }
  
  const accept = request.headers.get('accept') || '';

  // Navigation requests (HTML) - network-first with safe caching
  if (request.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // attempt to update cached index.html without breaking response
        try {
          const cache = await caches.open(ASSET_CACHE);
          await cache.put('/index.html', response.clone());
        } catch (err) {
          // swallow caching errors (could be body used or opaque responses)
          console.warn('SW: failed to cache index.html', err);
        }
        return response;
      } catch (err) {
        const cached = await caches.match('/index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Asset requests - network-first then cache, fallback to index.html as last resort
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      // Only cache successful responses for static assets
      if (response.ok && (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?)$/) || url.pathname === '/')) {
        try {
          const cache = await caches.open(ASSET_CACHE);
          await cache.put(request, response.clone());
        } catch (err) {
          // ignore caching errors
        }
      }
      return response;
    } catch (err) {
      const cached = await caches.match(request);
      if (cached) return cached;
      return (await caches.match('/index.html')) || Response.error();
    }
  })());
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
