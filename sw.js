// Offline-capable service worker: precache the shell, network-first for code, cache-first for big assets.
const VERSION = 'pj-v3';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg',
  'assets/fonts/fredoka-latin.woff2', 'data/puzzles.json',
  'js/main.js', 'js/util.js', 'js/store.js', 'js/audio.js', 'js/fx.js', 'js/pieces.js', 'js/piece-data.js', 'js/board.js',
  'js/session.js', 'js/puzzles.js', 'js/themes.js', 'js/mascot.js', 'js/ui.js', 'js/levels.js', 'js/progress.js',
  'js/results.js', 'js/play.js', 'js/modes.js', 'js/vendor/chess.js',
  'js/screens/home.js', 'js/screens/map.js', 'js/screens/settings.js', 'js/screens/collection.js', 'js/screens/stats.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Code & pages: network-first (so deploys show up immediately), cache as the offline fallback.
// Heavy static assets (puzzle bundle, font): cache-first.
const STATIC = /\.(woff2|json|png|svg)$/;
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const staticAsset = STATIC.test(new URL(req.url).pathname);
  const fromNet = () => fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  });
  e.respondWith(
    staticAsset
      ? caches.match(req).then((hit) => hit || fromNet())
      : fromNet().catch(() => caches.match(req).then((hit) => hit || caches.match('index.html')))
  );
});
