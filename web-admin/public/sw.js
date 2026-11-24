/**
 * AOTUC Web-Admin Service Worker — Application Shell & Offline Resilience
 * Version: v1.0.0
 * Scope: /
 * 
 * Rules:
 * 1. STRICT ISOLATION: All /api/* endpoints are Network-Only. Never cached.
 *    Offline API errors must propagate directly so that local IndexedDB draft saving
 *    and offline queue logic in RegistrationDesk.tsx function transparently.
 * 2. APP SHELL: Navigation requests (HTML) use Network-First with Cache Fallback
 *    to guarantee users receive updates online while allowing full cold-start boot offline.
 * 3. IMMUTABLE ASSETS: Content-hashed assets (/assets/*) and static resources use Cache-First
 *    with Network Fallback and dynamic cache population.
 * 4. CLEANUP: On activation, obsolete cache versions are purged immediately,
 *    and clients are claimed via self.clients.claim().
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `aotuc-shell-${CACHE_VERSION}`;

// Core assets to pre-cache on service worker installation
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/aotuc-logo.png',
  '/logo-guinee.png',
  '/aotuc-header-brand.png',
  '/aotuc-official-banner.png',
  '/aotuc-official-seal.png',
  '/aotuc-round-seal.png'
];

// Install Event: Pre-cache core shell resources, discover bundled JS/CSS chunks, and activate safely
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Precache static assets
      for (const url of PRECACHE_URLS) {
        try {
          const response = await fetch(url, { cache: 'no-cache' });
          if (response && response.ok) {
            await cache.put(url, response);
          }
        } catch (err) {
          console.warn(`[AOTUC SW] Precache optional warning for ${url}:`, err);
        }
      }

      // 2. Discover and precache current Vite hashed JS and CSS assets linked in index.html
      // This guarantees that old caches are never purged before the new bundle is fully available offline.
      try {
        const indexResponse = await fetch('/index.html', { cache: 'no-cache' });
        if (indexResponse && indexResponse.ok) {
          const htmlText = await indexResponse.clone().text();
          const assetMatches = htmlText.match(/(\/assets\/[^"'\s>]+)/g) || [];
          for (const assetPath of assetMatches) {
            try {
              const assetRes = await fetch(assetPath, { cache: 'no-cache' });
              if (assetRes && assetRes.ok) {
                await cache.put(assetPath, assetRes);
                console.log(`[AOTUC SW] Precached critical bundle: ${assetPath}`);
              }
            } catch (aErr) {
              console.warn(`[AOTUC SW] Warning caching bundle asset ${assetPath}:`, aErr);
            }
          }
        }
      } catch (hErr) {
        console.warn('[AOTUC SW] Warning discovering bundled assets:', hErr);
      }
    }).then(() => {
      // Activate immediately once the complete app shell (HTML + JS + CSS) is safely cached
      return self.skipWaiting();
    })
  );
});

// Activate Event: Clean up outdated caches and claim existing clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('aotuc-shell-')) {
            console.log(`[AOTUC SW] Purging old cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event: Strategic routing per request type
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests immediately
  if (request.method !== 'GET') {
    return;
  }

  // Edge-case safeguard for Chrome DevTools
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') {
    return;
  }

  const url = new URL(request.url);

  // Ignore non-http/https requests (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 1. STRICT NETWORK-ONLY FOR BACKEND API ENDPOINTS
  // Do NOT intercept /api/* requests so network errors bubble naturally to the application
  // for IndexedDB offline capture.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. NAVIGATION REQUESTS (HTML / App Shell)
  // Strategy: Network-First with Cache Fallback
  // If user is online, fetch fresh index.html and update cache.
  // If user is offline (e.g. browser reopen with no Wi-Fi), serve cached index.html.
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed (offline cold start or reload)
          const cachedResponse = (await caches.match('/index.html')) || (await caches.match('/'));
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            `<!doctype html>
            <html lang="fr">
            <head><meta charset="utf-8"/><title>AOTUC - Hors Ligne</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 2rem;">
              <h2>AOTUC — Mode Hors Ligne</h2>
              <p>L'application n'est pas encore mise en cache sur cet appareil. Veuillez vous connecter une première fois à Internet.</p>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 3. STATIC ASSETS (JS, CSS, Images, Fonts)
  // Strategy: Cache-First with Network Fallback & Dynamic Caching
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      // Not in cache yet, fetch from network and store in cache for subsequent offline loads
      return fetch(request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Return 404 response if network failed and asset is not cached
        return new Response('', { status: 404, statusText: 'Offline Asset Not Cached' });
      });
    })
  );
});

// Message listener for manual cache management and debugging
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'PURGE_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log(`[AOTUC SW] Cache ${CACHE_NAME} purged on demand.`);
    });
  }
});
