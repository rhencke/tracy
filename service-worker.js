importScripts("precache-manifest.js");

const { cacheName, urls } = self.TRACY_PRECACHE;
const precacheUrls = new Set(urls.map((url) => new URL(url, self.location).href));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(urls.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== cacheName).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  const cacheUrl = url.pathname.endsWith("/")
    ? new URL("index.html", url).href
    : url.href;

  if (url.origin !== self.location.origin || !precacheUrls.has(cacheUrl)) {
    return;
  }

  event.respondWith(caches.match(cacheUrl).then((response) => response ?? fetch(event.request)));
});
