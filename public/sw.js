// পাক্ষিক ভ্রমণসূচী: সার্ভিস ওয়ার্কার
//  • অ্যাপের খোলস (HTML, JS, CSS, ফন্ট, আইকন) জমা রাখে, যাতে দুর্বল নেটে দ্রুত খোলে
//  • ফোনে নোটিফিকেশন দেখায় (অ্যাপ বন্ধ থাকলেও) ও চাপলে সংশ্লিষ্ট পেজ খোলে
// ডাটাবেসের (Supabase) তথ্য কখনো জমা রাখে না, সবসময় সরাসরি আনে।
const CACHE = 'saao-shell-v1'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/fonts/Nikosh.ttf']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => undefined))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // পেজ: আগে নেট, না পেলে জমা রাখা খোলস
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy)).catch(() => undefined)
          return res
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    )
    return
  }

  // JS/CSS (নামে হ্যাশ থাকে), ফন্ট, আইকন: আগে জমা, না থাকলে নেট থেকে এনে জমা
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined)
        }
        return res
      })),
    )
  }
})

// ---- নোটিফিকেশন ----
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data ? e.data.text() : '' } }
  const title = d.title || 'পাক্ষিক ভ্রমণসূচী'
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    lang: 'bn',
    data: { url: d.url || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus()
        if ('navigate' in c) return c.navigate(target)
        return
      }
    }
    return self.clients.openWindow(target)
  })())
})
