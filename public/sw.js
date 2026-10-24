// Service worker da Marcos Tasks: funciona offline e mostra notificações.
// Mudar VERSION força a limpeza das caches antigas.
const VERSION = 'v5'
// registado com ?dev=1 em desenvolvimento: sem cache, só notificações
const DEV = new URL(self.location.href).searchParams.has('dev')
const CACHE = `marcos-tasks-${VERSION}`
const PAGES = ['/', '/entrar', '/tarefas', '/foco', '/estatisticas', '/perfil', '/ranking']
const PRECACHE = [...PAGES, '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', event => {
  if (DEV) {
    self.skipWaiting()
    return
  }
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('marcos-tasks-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  if (DEV) return
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // API e ficheiros: sempre direto ao servidor (dados privados e em tempo real)
  if (url.pathname.startsWith('/api/')) return

  // Ficheiros do build têm hash no nome: cache primeiro
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        hit =>
          hit ||
          fetch(request).then(res => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then(c => c.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // Páginas e restantes pedidos: rede primeiro, cache se estiver offline
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok && (request.mode === 'navigate' || url.pathname.startsWith('/_next/'))) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(request, copy))
        }
        return res
      })
      .catch(async () => {
        const hit = await caches.match(request, { ignoreSearch: request.mode === 'navigate' })
        if (hit) return hit
        if (request.mode === 'navigate') return (await caches.match('/')) || Response.error()
        return Response.error()
      }),
  )
})

// Notificações push enviadas pelo servidor (lembretes com a app fechada)
self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Marcos Tasks', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'marcos',
      renotify: true,
      vibrate: [120, 60, 120],
      actions: data.actions || [],
      data: { url: data.url || '/' },
    }),
  )
})

// Tocar numa notificação (ou no botão "Focar agora") abre ou foca a app
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = event.action === 'focar' ? '/foco' : event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const client = clients.find(c => new URL(c.url).origin === self.location.origin)
      if (client) {
        client.focus()
        if ('navigate' in client) return client.navigate(target)
        return
      }
      return self.clients.openWindow(target)
    }),
  )
})
