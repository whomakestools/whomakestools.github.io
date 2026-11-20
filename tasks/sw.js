/* Service worker do Controle de Atividades
   - Guarda o app em cache para funcionar sem internet.
   - Não há manifesto: o navegador não oferece "Instalar aplicativo".
   - Ao publicar uma nova versão do app, altere VERSAO para renovar o cache. */
const VERSAO = 'v2';
const CACHE_APP = 'controle-atividades-app-' + VERSAO;
const CACHE_FONTES = 'controle-atividades-fontes';
// Só arquivos que com certeza existem: se um item falhar, o cache inteiro não é criado
const APP = ['./taskAdmin.html', './sw.js'];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE_APP).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('controle-atividades-app-') && k !== CACHE_APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fontes do Google: usa o cache primeiro (mudam raramente)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    ev.respondWith(
      caches.open(CACHE_FONTES).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }))
      ).catch(() => new Response('', { status: 504 }))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Arquivos do app: tenta a rede (para receber atualizações) e cai no cache se estiver offline
  ev.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE_APP).then((c) => c.put(req, copia)); }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) =>
          hit || (req.mode === 'navigate' ? caches.match('./taskAdmin.html') : new Response('', { status: 504 }))
        )
      )
  );
});
