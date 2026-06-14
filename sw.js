const CACHE = "deepclaude-v1";
const ASSETS = ["/", "/index.html", "/style.css", "/storage.js", "/app.js", "/manifest.json",
  "https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js",
  "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css",
  "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/highlight.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});
self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
