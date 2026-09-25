/* AP Decks service worker — precache the shell and every deck, serve offline. */
var VERSION = 'apdecks-v131';
var ASSETS = [
  './', './index.html', './app.css', './app.js', './store.js', './tex.js', './games.js',
  './liquid-glass.css', './liquid-glass.js',
  './manifest.webmanifest',
  './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './data/index.json', './data/timeline.json', './data/fr-vocab.json',
  './data/lang.json', './data/chem.json', './data/french.json',
  './data/calcbc.json', './data/apush.json', './data/sat.json'
  // NOTE: a private deck is not listed here — it is 3.6 MB and only its owner
  // can see it, so it is never shipped to every device. It is picked up at
  // runtime and carried across version bumps by the activate handler below.

];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      // The shell is force-refetched so a stale HTTP copy cannot survive a
      // version bump. Deck JSON is not: the page has just fetched every one of
      // them, and reloading made a first visit pull 1.53 MB over the wire for
      // a 765 KB app.
      return Promise.all(ASSETS.map(function (u) {
        var data = u.indexOf('/data/') > -1;
        return c.add(data ? new Request(u) : new Request(u, { cache: 'reload' }))
          .catch(function () { /* keep going */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

/* Carry runtime-cached deck data across a version bump. A deck this device
   fetched itself — a private one, say — is not in ASSETS, so dropping the old
   cache wholesale used to lose it, and the next offline open came up with a
   deck missing. Re-fetch it if the network is there, copy it forward if not. */
function carryData(oldKey, fresh) {
  return caches.open(oldKey).then(function (c) {
    return c.keys().then(function (reqs) {
      return Promise.all(reqs.map(function (req) {
        if (new URL(req.url).pathname.indexOf('/data/') === -1) return;
        return fresh.match(req, { ignoreSearch: true }).then(function (have) {
          if (have) return;
          return fetch(req).then(function (res) {
            if (!res || !res.ok || res.type !== 'basic') throw new Error('no');
            return fresh.put(req, res.clone());
          }).catch(function () {
            return c.match(req).then(function (r) { return r ? fresh.put(req, r) : undefined; });
          });
        });
      }));
    });
  }).catch(function () { /* a cache we cannot read is one we cannot carry */ });
}

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      var old = keys.filter(function (k) { return k !== VERSION; });
      return caches.open(VERSION).then(function (fresh) {
        return Promise.all(old.map(function (k) { return carryData(k, fresh); }));
      }).then(function () {
        return Promise.all(old.map(function (k) { return caches.delete(k); }));
      });
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return;   // sync is live data — never cached

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      // deck data ships with the shell and only changes when VERSION does —
      // a background refetch of megabytes of JSON on every open buys nothing
      if (hit && url.pathname.indexOf('/data/') > -1) return hit;
      var net = fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});

/* ---- the daily reminder -------------------------------------------------
   One push a day from /api/push-send, on a day something is due. The payload
   is JSON — title, body, url — and a note that cannot be parsed still shows,
   as words, rather than being dropped. */
self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (x) { data = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(data.title || 'Cards due', {
    body: data.body || 'Tap to review',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'due',          // one note per day replaces the last, never stacks
    data: { url: data.url || './index.html#/review' }
  }));
});
/* Tapping it lands on Review: the open app is brought forward and sent
   there; with none open, one is opened. */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || './index.html#/review', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) {
      if ('focus' in cs[i]) {
        cs[i].postMessage({ go: url.slice(url.indexOf('#')) });
        return cs[i].focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
