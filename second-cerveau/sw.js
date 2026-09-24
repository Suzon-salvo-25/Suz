// Service worker minimal : garde la coquille de l'appli pour l'ouvrir hors
// ligne. Les données vivent dans le navigateur (localStorage), pas ici.
const CACHE = "pepites-v1";
const COQUILLE = ["./", "./index.html", "./manifest.webmanifest", "./icone.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord pour la page (pour recevoir les mises à jour), cache en secours.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((rep) => {
        const copie = rep.clone();
        caches.open(CACHE).then((c) => c.put(req, copie));
        return rep;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
  );
});
