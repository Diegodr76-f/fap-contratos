/* Service worker del Planificador adaptativo.
   Guarda la aplicación completa para que funcione sin internet: los planes
   viven en el navegador, así que una vez instalada no necesita conexión.

   Estrategia: la página se pide primero a la red (para que las versiones
   nuevas lleguen solas) y se cae al caché si no hay señal. Los íconos y las
   tipografías se sirven del caché y se refrescan por detrás. */

var VERSION = "planificador-v2";
var CASCARA = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", function (ev) {
  ev.waitUntil(
    caches.open(VERSION).then(function (c) {
      return c.addAll(CASCARA);
    }).then(function () {
      /* No tomamos el control de golpe: la página avisa y el usuario decide. */
      return undefined;
    })
  );
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) {
        return k === VERSION ? null : caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("message", function (ev) {
  if (ev.data === "activar-ya") self.skipWaiting();
});

self.addEventListener("fetch", function (ev) {
  var req = ev.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  var propio = url.origin === self.location.origin;
  var esPagina = req.mode === "navigate"
    || (propio && url.pathname.replace(/\/$/, "").endsWith("/planificador"))
    || (propio && url.pathname.endsWith("index.html"));

  if (esPagina) {
    /* Primero la red, para no quedarse con una versión vieja. */
    ev.respondWith(
      fetch(req).then(function (res) {
        var copia = res.clone();
        caches.open(VERSION).then(function (c) { c.put("./index.html", copia); });
        return res;
      }).catch(function () {
        return caches.match("./index.html").then(function (r) {
          return r || caches.match("./");
        });
      })
    );
    return;
  }

  if (propio || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    /* Del caché al instante; se refresca por detrás. */
    ev.respondWith(
      caches.match(req).then(function (hit) {
        var red = fetch(req).then(function (res) {
          if (res && (res.ok || res.type === "opaque")) {
            var copia = res.clone();
            caches.open(VERSION).then(function (c) { c.put(req, copia); });
          }
          return res;
        }).catch(function () { return hit; });
        return hit || red;
      })
    );
  }
});
