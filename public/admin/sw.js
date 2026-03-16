const SHELL_CACHE = "admin-shell-v2";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./admin.css",
  "./admin.js",
  "./toastui-editor.min.css",
  "./toastui-editor-all.min.js",
  "./shortcodes.json",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key !== SHELL_CACHE)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html")),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }
        const copy = response.clone();
        event.waitUntil(
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined),
        );
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
