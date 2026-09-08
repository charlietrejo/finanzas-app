// Service worker de Northstar Finance: cache básico de assets + última
// página cargada (sección 5 del doc de requerimientos — "cache de assets y
// última data cargada; sincronización al recuperar conexión, no en tiempo
// real"). No intercepta Server Actions (POST) ni peticiones a Supabase
// (otro origen): si no hay red, esas simplemente fallan, que es aceptable
// para este alcance.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `northstar-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `northstar-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = ["/offline.html", "/icon.png", "/icon-maskable.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirstNavigate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // deja pasar Server Actions (POST) sin tocarlas

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // no tocar Supabase ni otros orígenes

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigate(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || /\.(png|ico|svg|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
