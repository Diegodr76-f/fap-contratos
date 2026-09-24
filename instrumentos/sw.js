/* Generador de Instrumentos Legales · service worker
   Objetivo: que la herramienta siga abriendo sin internet, como cuando se usaba
   con el archivo suelto en el disco.
   - La página: red primero, caché de respaldo → al publicar una versión nueva
     se ve enseguida, pero sin conexión sigue abriendo la última que funcionó.
   - Iconos, manifiesto y datos incluidos: caché primero → arranque instantáneo.
   - El registro de contratos pasa de largo: nunca se intercepta ni se guarda,
     así los datos nunca salen servidos de caché. Ojo: vive en el MISMO sitio
     (../crm/contratos_export.json), así que no basta con dejar pasar lo de otro
     origen. Hasta la v2 se colaba en el "caché primero" y la herramienta
     enseñaba para siempre el registro del primer día, aunque el robot
     publicara uno nuevo cada mañana. La v3 existe para borrar esa copia. */
/* El número del caché se sube cada vez que cambia esta lista: la estrategia de
   los recursos que no son la página es "caché primero", así que un archivo que
   se queda dentro no se vuelve a pedir nunca. Y addAll es atómico — si un solo
   recurso da 404, no se guarda ninguno y la app deja de funcionar sin conexión:
   por eso aquí no puede figurar nada que no exista en el repositorio. */
const CACHE = "instrumentos-v3";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/\/contratos_export\.json$/.test(url.pathname)) return;

  const esPagina = req.mode === "navigate" || req.destination === "document";
  if (esPagina) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
          return r;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      const copia = r.clone();
      caches.open(CACHE).then((c) => c.put(req, copia));
      return r;
    }))
  );
});
