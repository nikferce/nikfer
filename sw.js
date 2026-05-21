// ============================================================
// Nikfer Belleği — Service Worker
// Strateji: Cache-first (statik), Network-first (API/Supabase)
// ============================================================

const APP_VERSION   = 'v1.0.0';
const CACHE_STATIC  = `nikfer-static-${APP_VERSION}`;
const CACHE_DYNAMIC = `nikfer-dynamic-${APP_VERSION}`;

// Kurulumda önbelleğe alınacak statik dosyalar
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './db.js',
  './config.js',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('SW install cache error:', err))
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Supabase API istekleri → Network-first (canlı veri önemli)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // CDN kaynakları → Cache-first
  if (url.hostname.includes('jsdelivr.net')) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  // Statik uygulama dosyaları → Cache-first
  if (request.method === 'GET') {
    event.respondWith(cacheFirst(request, CACHE_DYNAMIC));
    return;
  }
});

// Cache-first: önce cache, yoksa network'ten al ve cache'e yaz
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline durumunda index.html döndür
    const fallback = await caches.match('./index.html');
    return fallback || new Response('Çevrimdışı — Bağlantı bekleniyor...', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Network-first: önce network, başarısızsa cache
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'Çevrimdışı — Veriler önbellekten yüklenemedi.' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ── PUSH BİLDİRİMLERİ (ileride aktif edilebilir) ─────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Nikfer Belleği', {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      tag: 'nikfer-notification',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('./')
  );
});
