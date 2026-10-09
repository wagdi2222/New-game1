// Guardians of the Oasis offline cache: serve from cache at once, refresh it from the network in the background
const CACHE = 'waha-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'js/levels.js', 'js/sprites.js', 'js/audio.js', 'js/game.js', 'js/net.js', 'js/online.js', 'js/ui.js', 'js/vendor/peerjs.min.js'];
self.addEventListener('install', e => {
  // Skip the browser's HTTP cache so a new version never stores files from the old one
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => (k.startsWith('waha-') || k.startsWith('tank-battle-')) && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    // A friend who opened an invite link on an older cached copy reloads into this version to join the room
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(cs => cs.forEach(c => { if (new URL(c.url).searchParams.has('room')) c.navigate(c.url).catch(() => {}); })));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const cached = await c.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })
      .catch(() => cached || c.match('index.html'));
    return cached || fresh;
  }));
});
