// Self-destructing Service Worker - unregisters old cache then deregisters
self.addEventListener('install', e => {
  // Delete all old caches immediately
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  // Unregister this service worker
  e.waitUntil(self.registration.unregister());
  self.clients.claim();
});
// Don't intercept any fetch requests