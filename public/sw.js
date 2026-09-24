const CACHE_NAME = 'bodega-v40'
const STATIC_ASSETS = ['/index.html', '/']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // API calls → siempre red, sin cache
  if (url.pathname.startsWith('/api/')) return

  // Todo lo demás → network-first: intenta red, cae a cache si falla (offline)
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response
        }
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone))
        return response
      })
      .catch(() =>
        caches.match(e.request).then((cached) => {
          if (cached) return cached
          if (e.request.mode === 'navigate') {
            return caches.match('/index.html').then((r) => r ?? fetch('/index.html'))
          }
          return new Response('', { status: 503 })
        })
      )
  )
})
