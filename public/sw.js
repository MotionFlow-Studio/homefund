/*
 * HomeFund service worker: lets the app open and run without a connection.
 * - Pages: network first, falling back to the last cached copy.
 * - Build assets, icons and fonts: cache first (their URLs change on every build).
 * - API calls are never cached; data lives in the device database instead.
 */

const VERSION = "v7";
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const APP_SHELL = ["/", "/app", "/app/expenses", "/app/scan", "/app/household", "/app/overview", "/app/member", "/app/settings", "/join", "/signin", "/signup"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PAGES && key !== ASSETS)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|png|svg|ico|webmanifest)$/.test(url.pathname)
  );
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match("/")) ||
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (isAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (url.searchParams.has("_rsc")) {
    event.respondWith(networkFirst(request));
  }
});
