/* MARANZA FIGHT 3 — service worker
   Precaches the shell, then caches hashed build assets on first use so the game
   can run offline after a complete first load. Bump CACHE_VERSION on releases. */
const CACHE_VERSION = 'maranza-fight-3-v4';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './previews/level-1.jpg',
  './previews/level-2.jpg',
  './previews/level-3.jpg',
  './previews/level-4.jpg',
  './previews/level-5.jpg',
  './previews/level-6.jpg',
  './previews/level-7.jpg',
  './previews/level-8.jpg',
  './previews/level-9.jpg',
];

/** The bundle filenames are hashed at build time, so read them out of index.html. */
async function collectBuildAssets() {
  try {
    const response = await fetch('./index.html', { cache: 'reload' });
    if (!response.ok) return [];
    const html = await response.text();
    const urls = new Set();
    const pattern = /(?:src|href)="([^"]+\.(?:js|css|png|svg|webmanifest|wasm))"/g;
    let match = pattern.exec(html);
    while (match) {
      const value = match[1];
      if (!value.startsWith('http') && !value.startsWith('data:')) {
        urls.add(new URL(value, new URL('./index.html', self.location.href)).href);
      }
      match = pattern.exec(html);
    }
    return [...urls];
  } catch {
    return [];
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(async (cache) => {
        await cache.addAll(SHELL).catch(() => undefined);
        const assets = await collectBuildAssets();
        await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && (url.pathname.includes('/assets/') || /\.(js|css|png|jpg|svg|webmanifest|wasm)$/.test(url.pathname))) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached || Response.error());
    }),
  );
});
