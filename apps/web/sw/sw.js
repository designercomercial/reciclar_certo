/*
 * Service worker de Reciclar Certo (gerado no build; ver vite.config.ts).
 *
 * - App shell (HTML, JS, CSS): guardado para abrir sem internet.
 * - Guia de materiais (GET /api/publico/guia-materiais): rede primeiro; sem
 *   internet, a última cópia guardada. É público (sem dado pessoal).
 *   A página também guarda o guia no aparelho, com a data ("Guia de [data]").
 * - Rotas /api/cidadao/* (foto, jogo) NUNCA passam pelo cache.
 */
const VERSAO = "__VERSAO__";
const CACHE = "eco-reciclar-shell-" + VERSAO;
const CACHE_GUIA = "eco-reciclar-guia-v1";
const PRECACHE = __PRECACHE__;
const SHELL = "/reciclar/";
const GUIA = "/api/publico/guia-materiais";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(nomes.filter((n) => n.startsWith("eco-reciclar-shell-") && n !== CACHE).map((n) => caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});

const guardar = (nomeCache, chave, res) => {
  if (res.ok) {
    const copia = res.clone();
    caches.open(nomeCache).then((c) => c.put(chave, copia));
  }
  return res;
};

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate" && url.pathname.startsWith("/reciclar")) {
    event.respondWith(
      fetch(req)
        .then((res) => guardar(CACHE, SHELL, res))
        .catch(() => caches.match(SHELL).then((r) => r || Response.error())),
    );
    return;
  }

  if (url.pathname === GUIA) {
    event.respondWith(
      fetch(req)
        .then((res) => guardar(CACHE_GUIA, GUIA, res))
        .catch(() => caches.match(GUIA, { cacheName: CACHE_GUIA }).then((r) => r || Response.error())),
    );
    return;
  }

  // Arquivos com hash: cache primeiro.
  if (url.pathname.startsWith("/reciclar/assets/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => guardar(CACHE, req, res))));
  }
});
