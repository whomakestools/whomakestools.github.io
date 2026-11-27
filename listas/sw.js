// Service worker do app Listas: deixa a lista funcionar offline (HTML, CSS e JS ficam em cache).
// A leitura de preço pela câmera (price-scanner/OCR, hospedados fora) continua exigindo internet.
const CACHE = 'listas-v7' // troque o número para forçar a atualização dos arquivos em cache
const ARQUIVOS = [
  './', './index.html', './css/lista.css', './js/app.js',
  './js/vendor/qrcode.min.js', './js/vendor/jsQR.min.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'
]

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Rede primeiro (sempre pega a versão nova quando há internet); sem internet, usa o cache.
self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return // ignora arquivos externos
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)) }
        return res
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  )
})
