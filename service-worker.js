importScripts("precache-manifest.js");

const { cacheName, urls } = self.TRACY_PRECACHE;
const precacheUrls = new Set(urls.map((url) => new URL(url, self.location).href));
const precacheCachePromise = caches.open(cacheName);
const precacheResponses = new Map();

async function warmPrecacheResponses(cache) {
  const matches = await Promise.all(
    urls.map(async (url) => {
      const href = new URL(url, self.location).href;
      const response = await cache.match(href);
      return response === undefined ? null : [href, response];
    }),
  );

  precacheResponses.clear();
  for (const match of matches) {
    if (match !== null) {
      precacheResponses.set(match[0], match[1]);
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) =>
        cache
          .addAll(urls.map((url) => new Request(url, { cache: "reload" })))
          .then(() => warmPrecacheResponses(cache)),
      )
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
      .then(() => precacheCachePromise)
      .then((cache) => warmPrecacheResponses(cache))
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

  event.respondWith(
    (precacheResponses.get(cacheUrl)?.clone()) ??
    precacheCachePromise
      .then((cache) => cache.match(cacheUrl))
      .then((response) => response ?? fetch(event.request)),
  );
});
