// 簡單 offline cache：展示櫃本體可以離線打開（app 本身當然要上網）
const CACHE = 'scout-tools-v15';
const ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/store.js', '/admin.js', '/app.js', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  if (e.request.url.endsWith('/apps.json')) return; // 永遠用最新版，唔入 cache
  if (e.request.url.endsWith('/sw.js')) return; // sw 本身要跟網絡，先至有新部署時自動更新
  e.respondWith(
    // 核心 JS 行 network-first：有新部署即刻攞新版本（舊版行 cache-first，
    // 上網正常時永遠唔會更新 store.js/admin.js，導致後台改極都好似冇效）
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
