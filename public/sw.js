const CACHE_NAME = 'bodega-v38'
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
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request))
    return
  }

  // Todo lo demás → network-first: intenta red, cae a cache si falla (offline)
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response
        }
        // Guardar en cache como backup offline
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone))
        return response
      })
      .catch(() => {
        // Sin red: devolver desde cache
        return caches.match(e.request).then((cached) => {
          if (cached) return cached
          // Para rutas SPA sin cache, devolver index.html
          if (e.request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/')
          }
        })
      })
  )
})
