/* ==========================================================================
   store.js — profiles, deck loading, spaced repetition, persistence.
   Everything lives in localStorage; nothing leaves the phone.
   ========================================================================== */
(function (global) {
  'use strict';

  var NS = 'apdecks.v1';
  var DAY = 86400000;

  /* ---- account: magic link capture -------------------------------------- */
  // #t=TOKEN must be taken before app.js's hash router runs (store.js loads
  // first). The token is device-level, not part of any profile's state.
  var TOK_KEY = NS + '.tok';
  (function captureToken() {
    var m = /^#t=([A-Za-z0-9_-]{16,128})$/.exec(location.hash || '');
    if (!m) return;
    try { localStorage.setItem(TOK_KEY, m[1]); } catch (e) { /* private mode */ }
    // window.history, explicitly: this IIFE has its own history() (the day log),
    // which shadows the browser's — the reason this once crashed on load.
    window.history.replaceState(null, '', location.pathname + location.search + '#/');
  })();
  function token() { try { return localStorage.getItem(TOK_KEY) || ''; } catch (e) { return ''; } }

  /* ---- account: owner id ------------------------------------------------
     A course in data/index.json may carry "owner": the first 16 hex digits
     of sha256('apdecks-owner:' + token). Only a device holding that token
     shelves the deck. It is a gate on the shelf, not on the file — and it is
     salted apart from the sync blob's own hash, so a committed owner id says
     nothing about where anyone's progress lives. */
  var OWNER_SALT = 'apdecks-owner:';
  var ownerHex = '';                       // for the token on this device
  function computeOwner(tok) {
    if (!tok || !global.crypto || !global.crypto.subtle || !global.TextEncoder) return Promise.resolve('');
    return global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(OWNER_SALT + tok))
      .then(function (buf) {
        var b = new Uint8Array(buf), s = '';
        for (var i = 0; i < 8; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16);
        return s;
      })
      .catch(function () { return ''; });
  }

  /* ---- day numbers in the user's own timezone --------------------------- */
  function dayNum(d) {
    d = d || new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / DAY);
  }
  function dayKey(n) {
    // A day number already IS the local day, so naming it must not depend on
    // when we ask. Stamping it with TODAY's offset filed every summer day one
    // calendar day early in any zone that shifts — a hole in the chart on a
    // day you studied, a bar on a day you did not, and a broken streak.
    return new Date(n * DAY).toISOString().slice(0, 10);
  }

  /* ---- raw storage ------------------------------------------------------ */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(NS + '.' + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(NS + '.' + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  /* ---- profiles --------------------------------------------------------- */
  var DEFAULT_SETTINGS = {
    theme: 'auto',        // auto | light | dark
    typing: false,        // type the answer before revealing
    sessionSize: 30,      // cards per session
    newPerSession: 20,    // unseen cards allowed into one session
    coreFirst: false,     // prioritise the high-yield cards
    glass: true,          // liquid glass material on/off
    // A course whose exam is over: its due pile stops counting, the deal
    // stops dealing it and no reminder names it. The schedule underneath is
    // untouched, so taking the flag off brings every card back where it was.
    retired: {},          // deck id -> the day it was marked over
    // written by the app rather than by a settings row, and listed here so a
    // sync merge knows them: an unknown key is no longer copied in
    ladderDone: {},       // the Six Ladders lessons ticked off
    ladderChecks: {},     // the Done-when lines ticked off, per phase
    gameBest: {},         // best score per game
    gameMiss: {}          // the cards each game got wrong, for a replay
  };

  function newProfile(name) {
    return { id: 'p' + Math.random().toString(36).slice(2, 9), name: name || 'Student' };
  }

  var profiles = read('profiles', null);
  if (!profiles || !profiles.length) { profiles = [newProfile('Me')]; write('profiles', profiles); }
  var activeId = read('active', null);
  if (!profiles.some(function (p) { return p.id === activeId; })) {
    activeId = profiles[0].id; write('active', activeId);
  }

  var state = null;
  function stateKey() { return 'state.' + activeId; }
  /* what a state blob has to be before anything is allowed to touch it */
  function plain(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  function loadState() {
    state = read(stateKey(), null);
    // A JSON scalar in this key — 123, "hello", true — used to pass the `||`
    // guard and then throw on the very next line, which killed store.js before
    // window.Store was ever assigned: the app stayed on "Loading" forever, on
    // every reload, with no way back in because Reset lives inside it.
    if (!plain(state)) state = { cards: {}, log: {}, settings: {}, created: dayNum() };
    state.cards = saneAll(state.cards);
    if (!plain(state.log)) state.log = {};
    if (!plain(state.settings)) state.settings = {};
    var s = {};
    for (var k in DEFAULT_SETTINGS) s[k] = DEFAULT_SETTINGS[k];
    for (var j in (state.settings || {})) s[j] = state.settings[j];
    state.settings = s;
    return state;
  }
  loadState();

  var saveTimer = null, saveFailed = false;
  /* a device that has stopped storing is losing every grade — say so the
     moment it happens rather than on whatever screen renders next */
  function flagSave(ok) {
    var was = saveFailed;
    saveFailed = !ok;
    if (saveFailed !== was) {
      try { global.dispatchEvent(new CustomEvent('apdecks-storage', { detail: saveFailed })); } catch (e) {}
    }
  }
  function save(now) {
    if (saveTimer) clearTimeout(saveTimer);
    if (now) { flagSave(write(stateKey(), state)); schedulePush(); scheduleRemind(); return; }
    saveTimer = setTimeout(function () { flagSave(write(stateKey(), state)); schedulePush(); scheduleRemind(); }, 120);
  }

  /* ---- account: sync ----------------------------------------------------
     One JSON blob per account behind /api on this same origin; the merge
     happens here. Cards merge per card by last-touched day (t), so two
     devices reviewing offline both keep their work; the day log takes the
     max per day; settings follow whichever side wrote the blob later. */
  var API = '/api/state';
  var pushTimer = null, lastSyncAt = read('syncat', 0), syncing = false;
  // why the last attempt did not land: '' ok, 'auth' rejected, 'off' the
  // deployment has no sync configured, 'net' offline or a server error.
  // Without it the row says "Never" forever and never says why.
  var lastFail = '';
  // when it is 'off', what the server said it lacks: 'store' (no Blob store
  // linked) or 'allowlist' (no token would be accepted); '' if it did not say
  var offWhy = '';
  function noteOff(r) {
    lastFail = 'off';
    return r.json().then(function (j) { offWhy = (j && j.missing && j.missing[0]) || ''; }, function () { offWhy = ''; });
  }

  /* Whoever touched the star last wins; with no evidence either way a star
     survives, because losing one is the mistake the reader would notice. */
  function pickStar(mine, theirs) {
    var ma = mine ? (mine.sa || 0) : -1, ta = theirs ? (theirs.sa || 0) : -1;
    if (ta > ma) return theirs.s || 0;
    if (ma > ta) return mine.s || 0;
    return ((mine && mine.s) || (theirs && theirs.s)) ? 1 : 0;
  }

  // the maps of signed moments: lesson ticks and Done-when ticks
  var TICK_MAPS = ['ladderDone', 'ladderChecks'];
  function mergeRemote(remote) {
    if (!remote || typeof remote !== 'object') return false;
    var changed = false;
    var rc = remote.cards || {};
    for (var id in rc) {
      var mine = state.cards[id], theirs = sane(rc[id]);
      if (!theirs) continue;
      if (!mine || (theirs.t || 0) > (mine.t || 0) ||
          ((theirs.t || 0) === (mine.t || 0) && (theirs.r || 0) > (mine.r || 0))) {
        // the schedule is whichever side is newer, but a star is a wish, not a
        // measurement — losing the card wholesale silently dropped it
        theirs.s = pickStar(mine, theirs);
        theirs.sa = Math.max((mine && mine.sa) || 0, theirs.sa || 0);
        // a note is written, not measured — same rule as the star
        var nn = pickNote(mine, theirs);
        if (nn) theirs.nt = nn; else delete theirs.nt;
        theirs.na = Math.max((mine && mine.na) || 0, theirs.na || 0);
        state.cards[id] = theirs; changed = true;
      } else {
        var ns = pickStar(mine, theirs);
        if (ns !== (mine.s || 0)) { mine.s = ns; changed = true; }
        if ((theirs.sa || 0) > (mine.sa || 0)) { mine.sa = theirs.sa; changed = true; }
        var mn = pickNote(mine, theirs);
        if (mn !== (mine.nt || '')) { if (mn) mine.nt = mn; else delete mine.nt; changed = true; }
        if ((theirs.na || 0) > (mine.na || 0)) { mine.na = theirs.na; changed = true; }
      }
    }
    var rl = plain(remote.log) ? remote.log : {};
    for (var day in rl) {
      // a day key is a date and a day value is a count of reviews — nothing
      // else may enter the chart or the streak
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      var rn = Math.round(num(rl[day], 0, 100000, 0));
      if (rn > (state.log[day] || 0)) { state.log[day] = rn; changed = true; }
    }
    // The Six Ladders ticks are merged lesson by lesson, whichever side is
    // newer, set or cleared. Copying the map whole with the rest of the
    // settings let two devices erase each other's reading progress.
    TICK_MAPS.forEach(function (tk) {
      if (!plain(remote.settings) || !plain(remote.settings[tk])) return;
      var ld = plain(state.settings[tk]) ? state.settings[tk] : {}, rd = remote.settings[tk];
      for (var lk in rd) {
        var rv2 = rd[lk], mv = ld[lk];
        if (typeof rv2 !== 'number' || !isFinite(rv2)) continue;
        if (mv === undefined || Math.abs(rv2) > Math.abs(mv)) { ld[lk] = rv2; changed = true; }
      }
      state.settings[tk] = ld;
    });
    // Settings used to be copied in whole. A blob with sessionSize 0 made the
    // daily review deal nothing and say "Nothing due" over four thousand
    // untouched cards. Only known keys, only sane values.
    if (plain(remote.settings) && (remote._at || 0) > lastSyncAt) {
      for (var k in DEFAULT_SETTINGS) {
        if (!(k in remote.settings) || TICK_MAPS.indexOf(k) > -1) continue;
        var rv = remote.settings[k], dv = DEFAULT_SETTINGS[k];
        if (typeof dv === 'number') rv = Math.round(num(rv, 1, 1000, dv));
        else if (typeof dv === 'boolean') rv = !!rv;
        else if (typeof dv === 'object') { if (!plain(rv)) continue; }
        else if (typeof rv !== typeof dv) continue;
        state.settings[k] = rv;
      }
      changed = true;
    }
    return changed;
  }

  /* ANOTHER TAB IS THE SAME DEVICE. Every save rewrote the whole profile from
     this tab's own memory, so a PWA icon and a browser tab open at once threw
     each other's grades away — six of eight, in the measured case. A foreign
     write is folded in with the same rules a sync uses: last-touched wins per
     card, the day log takes the larger count, settings stay this tab's own. */
  global.addEventListener('storage', function (e) {
    if (!e || e.key !== NS + '.' + stateKey() || !e.newValue) return;
    var incoming;
    try { incoming = JSON.parse(e.newValue); } catch (x) { return; }
    if (!plain(incoming)) return;
    if (mergeRemote({ cards: incoming.cards, log: incoming.log })) {
      write(stateKey(), state);
      try { global.dispatchEvent(new CustomEvent('apdecks-sync', { detail: { changed: true } })); } catch (x) {}
    }
  });

  function pull() {
    if (!token()) return Promise.resolve(false);
    return fetch(API, { headers: { Authorization: 'Bearer ' + token() } })
      .then(function (r) {
        if (r.status === 401) { lastFail = 'auth'; return false; }
        if (r.status === 503) return noteOff(r).then(function () { return false; });
        if (!r.ok) { lastFail = 'net'; return false; }
        return r.json().then(function (j) {
          var changed = j && j.state ? mergeRemote(j.state) : false;
          lastFail = '';
          lastSyncAt = Date.now(); write('syncat', lastSyncAt);
          if (changed) { write(stateKey(), state); }
          try { window.dispatchEvent(new CustomEvent('apdecks-sync', { detail: { changed: changed } })); } catch (e) {}
          return changed;
        });
      })
      .catch(function () { lastFail = 'net'; return false; });
  }

  function pushNow() {
    if (!token() || syncing) return;
    syncing = true;
    var at = Date.now();
    var blob = { updatedAt: at, state: { cards: state.cards, log: state.log, settings: state.settings, _at: at } };
    fetch(API, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token(), 'content-type': 'application/json' },
      body: JSON.stringify(blob),
    }).then(function (r) {
      if (r.ok) { lastFail = ''; lastSyncAt = at; write('syncat', at); }
      else if (r.status === 503) return noteOff(r);
      else lastFail = r.status === 401 ? 'auth' : 'net';
    })
      .catch(function () { lastFail = 'net'; /* offline: the next save retries */ })
      .then(function () { syncing = false; });
  }
  function schedulePush() {
    if (!token()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 2500);      // one PUT per burst of reviews
  }

  function setToken(t) {
    t = String(t || '').trim();
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(t)) return false;
    try { localStorage.setItem(TOK_KEY, t); } catch (e) { return false; }
    pull();
    reshelve();
    return true;
  }
  function clearToken() { try { localStorage.removeItem(TOK_KEY); } catch (e) {} reshelve(); }

  if (token()) {
    pull();                                      // merge whatever another device did
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') pull();
      else pushNow();                            // leaving: don't sit on the debounce
    });
  }

  /* ---- decks ------------------------------------------------------------ */
  var rawIndex = null, index = null, decks = {}, loading = {};

  /* the shelf: every course without an owner, plus the ones this device owns */
  function shelf(raw, owner) {
    var out = {};
    for (var k in raw) out[k] = raw[k];
    out.courses = raw.courses.filter(function (c) { return !c.owner || c.owner === owner; });
    out.total = 0;
    out.courses.forEach(function (c) { out.total += c.count || 0; });
    return out;
  }
  function loadIndex() {
    if (index) return Promise.resolve(index);
    var src = (global.__DECKS && global.__DECKS.index)
      ? Promise.resolve(global.__DECKS.index)
      : fetch('data/index.json', { cache: 'no-cache' })
          .then(function (r) { if (!r.ok) throw new Error('index ' + r.status); return r.json(); });
    return src
      .then(function (j) { rawIndex = j; return computeOwner(token()); })
      .then(function (o) { ownerHex = o; index = shelf(rawIndex, o); return index; });
  }
  /* the token changed: re-shelve, fetch anything newly visible, drop what
     is no longer ours, then tell the app to redraw */
  function reshelve() {
    if (!rawIndex) return Promise.resolve(false);
    return computeOwner(token()).then(function (o) {
      if (o === ownerHex) return false;
      ownerHex = o; index = shelf(rawIndex, o);
      rawIndex.courses.forEach(function (c) { if (c.owner && c.owner !== o) delete decks[c.id]; });
      return loadAll().catch(function () {}).then(function () {
        try { window.dispatchEvent(new CustomEvent('apdecks-sync', { detail: { changed: true, shelf: true } })); } catch (e) {}
        return true;
      });
    });
  }
  function prepare(d, id) {
    d.byId = {}; d.unitById = {};
    d.units.forEach(function (u) { d.unitById[u.id] = u; });
    d.cards.forEach(function (c) { c.deck = id; d.byId[c.i] = c; });
    decks[id] = d;
    return d;
  }
  function loadDeck(id) {
    if (decks[id]) return Promise.resolve(decks[id]);
    if (global.__DECKS && global.__DECKS.decks && global.__DECKS.decks[id]) {
      return Promise.resolve(prepare(global.__DECKS.decks[id], id));
    }
    if (loading[id]) return loading[id];
    loading[id] = fetch('data/' + id + '.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(id + ' ' + r.status); return r.json(); })
      .then(function (d) {
        d.byId = {};
        d.unitById = {};
        d.units.forEach(function (u) { d.unitById[u.id] = u; });
        d.cards.forEach(function (c) { c.deck = id; d.byId[c.i] = c; });
        decks[id] = d; delete loading[id];
        // the app paints from the index alone and fills in as decks land
        try { global.dispatchEvent(new CustomEvent('apdecks-deck', { detail: id })); } catch (e) {}
        return d;
      });
    return loading[id];
  }
  /* A new service worker just took control. The index it precached may list a
     deck this page never saw — the shelf was painted from the old worker's copy,
     and a deck added last week stayed invisible until the NEXT visit. Fetch the
     index again through the new worker, re-shelve, load what is new or changed,
     and tell the app. Nothing happens when nothing changed. */
  function refreshIndex() {
    if (global.__DECKS && global.__DECKS.index) return Promise.resolve(false);
    // a deck's version stamp changes when its file does, so a book that grew
    // without gaining a card still counts as new
    var fp = function (ix) { return ((ix && ix.courses) || []).map(function (c) { return c.id + ':' + c.count + ':' + (c.v || ''); }); };
    return fetch('data/index.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('index ' + r.status); return r.json(); })
      .then(function (j) {
        var before = fp(index);
        rawIndex = j; index = shelf(rawIndex, ownerHex);
        var after = fp(index);
        if (before.join(',') === after.join(',')) return false;
        // a deck whose count moved was cached under the old version: drop it so it is fetched fresh
        after.forEach(function (k) { if (before.indexOf(k) < 0) delete decks[k.split(':')[0]]; });
        return loadAll().catch(function () {}).then(function () {
          try { window.dispatchEvent(new CustomEvent('apdecks-sync', { detail: { changed: true, shelf: true } })); } catch (e) {}
          return true;
        });
      })
      .catch(function () { return false; });
  }

  /* One unreachable deck must not blank the library. Promise.all rejected the
     whole boot on the first failure, so a Ladders user whose private deck was
     not in the offline cache lost all five public decks with it. Every deck is
     tried; whatever arrives is what the app opens with. */
  function loadAll() {
    return loadIndex().then(function (ix) {
      var got = 0;
      return Promise.all(ix.courses.map(function (c) {
        return loadDeck(c.id).then(function (d) { got++; return d; }, function () { return null; });
      })).then(function (all) {
        if (!got) throw new Error('no decks');    // nothing at all IS an error
        return all.filter(Boolean);
      });
    });
  }

  /* ---- card state ------------------------------------------------------- */
  function cs(id) { return state.cards[id] || null; }
  function isNew(id) { return !state.cards[id]; }
  /* A starred-but-unstudied card has a record — toggleStar makes one — and
     that record carries today's date. Due has to mean "you have seen this and
     it is time again", or a star reads as a schedule everywhere it is asked. */
  function isSeen(id) { var s = state.cards[id]; return !!s && !!(s.r || s.t || s.l); }
  function isDue(id, today) {
    var s = state.cards[id];
    return !!s && isSeen(id) && s.d <= (today === undefined ? dayNum() : today);
  }
  function isKnown(id) {
    var s = state.cards[id];
    return !!s && s.r >= 2 && s.i >= 7;
  }
  function isStarred(id) { var s = state.cards[id]; return !!(s && s.s); }
  function toggleStar(id) {
    var s = state.cards[id] || blank();
    s.s = s.s ? 0 : 1;
    // The star gets its OWN timestamp. Stamping `t` would have been a quiet
    // disaster: `t` means "last studied", and both deckStats and the daily
    // deal read it — starring a card you had never opened would have counted
    // it as seen and dealt it as due.
    s.sa = dayNum();
    state.cards[id] = s; save();
    return !!s.s;
  }
  function blank() { return { e: 2.5, r: 0, i: 0, d: dayNum(), l: 0, s: 0, sa: 0, n: -1, t: 0 }; }
  /* A card record can arrive from a backup file or a sync blob, and JSON's
     1e999 parses to Infinity: one non-finite interval put a card a hundred
     million days out and left the grade buttons printing nonsense about it.
     Every number that governs the schedule is pinned to a real range. */
  function num(v, lo, hi, dflt) {
    v = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(v)) return dflt;
    return Math.min(hi, Math.max(lo, v));
  }
  function sane(c) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
    var t = dayNum();
    c.e = num(c.e, 1.3, 3.0, 2.5);
    c.r = Math.round(num(c.r, 0, 9999, 0));
    c.i = Math.round(num(c.i, 0, 36500, 0));
    c.d = Math.round(num(c.d, t - 36500, t + 36500, t));
    c.l = Math.round(num(c.l, 0, 9999, 0));
    c.t = Math.round(num(c.t, 0, t + 36500, 0));
    c.sa = Math.round(num(c.sa, 0, t + 36500, 0));
    c.na = Math.round(num(c.na, 0, t + 36500, 0));
    c.s = c.s ? 1 : 0;
    if (c.nt != null && typeof c.nt !== 'string') delete c.nt;
    return c;
  }
  function saneAll(cards) {
    if (!cards || typeof cards !== 'object' || Array.isArray(cards)) return {};
    var out = {};
    for (var k in cards) { var v = sane(cards[k]); if (v) out[k] = v; }
    return out;
  }

  /* ---- the reader's own note on a card ----------------------------------
     A flashcard sticks when you say it in your own words: the mnemonic, the
     trap you keep falling into, the way your teacher put it. `nt` holds that
     text and `na` the day it was written, so a note survives a merge with a
     device that only graded the card. */
  var NOTE_MAX = 400;
  function noteOf(id) { var s = state.cards[id]; return (s && s.nt) || ''; }
  function setNote(id, text) {
    var t = String(text == null ? '' : text).replace(/\s+$/, '').slice(0, NOTE_MAX);
    var s = state.cards[id] || blank();
    if ((s.nt || '') === t) return t;
    if (t) s.nt = t; else delete s.nt;
    s.na = dayNum();
    state.cards[id] = s; save();
    return t;
  }
  /* Whoever wrote last wins; with no evidence either way the text that exists
     survives, because losing what you wrote is the mistake you would notice. */
  function pickNote(mine, theirs) {
    var ma = mine ? (mine.na || 0) : -1, ta = theirs ? (theirs.na || 0) : -1;
    if (ta > ma) return theirs.nt || '';
    if (ma > ta) return mine.nt || '';
    return (mine && mine.nt) || (theirs && theirs.nt) || '';
  }

  /* The interval a rating would produce, in days — what the card-list preview
     prints as a word, the week-ahead forecast needs as a number. */
  function ivl(id, g) { return nextInterval(state.cards[id] || blank(), g).i; }

  /* Intervals a rating would produce, for the button captions. */
  function preview(id, grade, capDay) {
    var s = state.cards[id] || blank();
    var i = nextInterval(s, grade).i;
    if (capDay) i = Math.min(i, Math.max(1, capDay - dayNum()));   // never past the exam
    // in words: "3 d" was read as anything but three days. A week band,
    // because 52 and 68 days both printed "2 months" — two different
    // outcomes reading as the same promise — and months stop before a year.
    if (grade === 0) return 'now';
    if (i < 1) return 'today';
    if (i < 14) return i + (i === 1 ? ' day' : ' days');
    if (i < 60) { var w = Math.round(i / 7); return w + (w === 1 ? ' week' : ' weeks'); }
    if (i < 330) { var m = Math.round(i / 30); return m + (m === 1 ? ' month' : ' months'); }
    var y = (i / 365).toFixed(1).replace(/\.0$/, '');
    return y + (y === '1' ? ' year' : ' years');
  }

  /* 0 again · 1 hard · 2 good · 3 easy.
     One ladder, read off the card's last interval, so the four captions are
     four different promises on every card. A card met for the first time
     (or one that just came back from Again) reads now · 1 d · 3 d · 7 d:
     each grade roughly doubles the one before it, the way the schedule keeps
     doing from then on. It used to read now · 1 d · 2 d · 3 d, a countdown
     rather than a judgement — Easy was two days better than Hard.
       Hard   you had it, only just. A fifth more than last time, never less
              than a day more, and the ease slips so the steps after stay
              short; the card keeps its place instead of starting over.
       Good   the interval times the ease, about two and a half: 3 · 8 · 20 · 50.
       Easy   half again as far as Good would send it, and the ease grows so
              the later steps stretch further still.
     Whatever the ease, Hard < Good < Easy holds — a leech at the bottom of
     its ease with a two-day interval would otherwise print 3 d twice. */
  function nextInterval(s, grade) {
    var e = s.e || 2.5, r = s.r || 0, i = s.i || 0;
    if (grade === 0) { return { e: Math.max(1.3, e - 0.2), r: 0, i: 0 }; }
    var first = r < 1 || i < 1;
    var hard = first ? 1 : Math.max(i + 1, Math.round(i * 1.2));
    var good = first ? 3 : Math.max(hard + 1, Math.round(i * e));
    var easy = first ? 7 : Math.max(good + 1, Math.round(good * 1.5));
    if (grade === 1) return { e: Math.max(1.3, e - 0.15), r: r + 1, i: hard };
    if (grade === 2) return { e: e, r: r + 1, i: good };
    return { e: Math.min(3.0, e + 0.1), r: r + 1, i: easy };
  }

  /* grade: 0 again, 1 good, 2 easy */
  function grade(id, g, capDay) {
    var today = dayNum();
    var s = state.cards[id] || blank();
    var nx = nextInterval(s, g);
    s.e = nx.e; s.r = nx.r; s.i = nx.i;
    s.d = today + nx.i;
    // A card scheduled past its exam is a card you will never see again in
    // time: five Easy presses parked one until August for a May exam. The
    // interval it earned still stands; only the date is pulled back.
    if (capDay && s.d > capDay) s.d = Math.max(today + 1, capDay);
    if (g === 0) s.l = (s.l || 0) + 1;
    s.n = g; s.t = today;
    state.cards[id] = s;
    state.log[dayKey(today)] = (state.log[dayKey(today)] || 0) + 1;
    save();
    return s;
  }

  /* Move a card's next appearance without touching what it has earned. The
     interval, the ease and the repetition count all stand; only the day
     changes. This is what lets a buried pile be spread over the days ahead
     instead of being forgotten or reset. A remote copy that was actually
     studied later still wins the merge, because `t` is untouched here. */
  function reschedule(id, day) {
    var s = state.cards[id];
    if (!s) return false;
    var d = Math.round(num(day, dayNum() - 36500, dayNum() + 36500, s.d));
    if (d === s.d) return false;
    s.d = d;
    return true;
  }
  /* A whole spread is one write, not one per card — and an immediate one:
     the debounce is 120ms, and a deliberate one-shot action must not be
     lost by a tab closed in the same breath. */
  function commit() { save(true); }

  /* ---- session building -------------------------------------------------- */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* scope: {deck, unit?, mode: 'smart'|'all'|'core'|'starred'|'due'|'hard'} */
  function pool(deck, unit, mode) {
    var cards = deck.cards.filter(function (c) { return !unit || c.u === unit; });
    if (mode === 'core') cards = cards.filter(function (c) { return c.c; });
    if (mode === 'starred') cards = cards.filter(function (c) { return isStarred(c.i); });
    if (mode === 'due') cards = cards.filter(function (c) { return isDue(c.i); });
    if (mode === 'hard') cards = cards.filter(function (c) {
      var s = cs(c.i); return s && (s.l >= 2 || s.n === 0);
    });
    return cards;
  }

  function buildSession(deck, unit, mode, limit) {
    var today = dayNum();
    var cards = pool(deck, unit, mode === 'smart' ? null : mode);
    var settings = state.settings;
    limit = limit || settings.sessionSize;

    if (mode === 'all' || mode === 'core' || mode === 'starred' || mode === 'hard') {
      var list = shuffle(cards.slice());
      if (settings.coreFirst) list.sort(function (a, b) { return (b.c || 0) - (a.c || 0); });
      return list.slice(0, Math.max(limit, 10));
    }

    var due = [], fresh = [];
    cards.forEach(function (c) {
      if (isNew(c.i)) fresh.push(c);
      else if (cs(c.i).d <= today) due.push(c);
    });
    due.sort(function (a, b) { return cs(a.i).d - cs(b.i).d; });
    shuffle(fresh);
    if (settings.coreFirst) fresh.sort(function (a, b) { return (b.c || 0) - (a.c || 0); });
    var take = fresh.slice(0, settings.newPerSession);
    var out = due.slice(0, limit).concat(take);
    if (out.length > limit) out = out.slice(0, limit);
    return shuffle(out);
  }

  function retiredDeck(id) { var r = state.settings.retired; return !!(id && plain(r) && r[id]); }
  function setRetired(id, on) {
    var r = plain(state.settings.retired) ? state.settings.retired : {};
    if (on) r[id] = dayNum(); else delete r[id];
    state.settings.retired = r; save(true);
  }
  /* `due` is what the app counts and deals; on a course whose exam is over
     it is zero and the real pile sits in `paused`, for the course page to
     name. A deck object carries no id when it is a unit's slice, so the
     caller says which course it belongs to. */
  function deckStats(deck, deckId) {
    var today = dayNum(), total = deck.cards.length, seen = 0, known = 0, due = 0, starred = 0;
    deck.cards.forEach(function (c) {
      var s = state.cards[c.i];
      if (!s) return;
      if (s.s) starred++;
      if (!s.r && !s.t && !s.l) return;   // starred only, never studied
      seen++;
      if (s.r >= 2 && s.i >= 7) known++;
      if (s.d <= today) due++;
    });
    var off = retiredDeck(deckId || deck.id);
    return { total: total, seen: seen, known: known, due: off ? 0 : due, paused: off ? due : 0, starred: starred,
             fresh: total - seen, pct: total ? known / total : 0 };
  }
  function unitStats(deck, unitId) {
    var sub = { cards: deck.cards.filter(function (c) { return c.u === unitId; }) };
    return deckStats(sub, deck.id);
  }

  /* ---- the daily reminder -----------------------------------------------
     A push subscription on this device and, beside it, the days ahead: for
     each of the next few weeks' dates, how many cards will be due by then if
     nothing is reviewed in between. The server keeps that list and sends one
     note a day, so it never needs to read a card — and a retired course is
     left out here, where the decks are known. */
  var REM_DAYS = 45;
  function dueProjection() {
    var today = dayNum(), counts = [], k;
    for (k = 0; k < REM_DAYS; k++) counts.push(0);
    ((index && index.courses) || []).forEach(function (c) {
      var d = decks[c.id]; if (!d || retiredDeck(c.id)) return;
      d.cards.forEach(function (card) {
        var st = state.cards[card.i];
        if (!st || !(st.r || st.t || st.l)) return;
        var n = st.d - today; if (n < 0) n = 0;
        if (n < REM_DAYS) counts[n]++;
      });
    });
    var out = {}, run = 0;
    for (k = 0; k < REM_DAYS; k++) { run += counts[k]; out[dayKey(today + k)] = run; }
    return out;
  }
  var PUSH_API = '/api/push';
  function remindRec() { return read('remind', null); }
  function pushable() {
    return !!(global.navigator && 'serviceWorker' in global.navigator && 'PushManager' in global && 'Notification' in global);
  }
  function remindStatus() {
    if (!pushable()) return 'unsupported';
    if (global.Notification.permission === 'denied') return 'denied';
    return remindRec() ? 'on' : 'off';
  }
  function b64ToBytes(b64) {
    var pad = '='.repeat((4 - b64.length % 4) % 4);
    var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function subscription() {
    return global.navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); });
  }
  /* post this device's subscription and the days ahead; the account token
     rides along when there is one, so every device of one account can be
     told the truth the last-studied device knows */
  var remTimer = null;
  function remindSync(sub) {
    if (!remindRec() || !pushable()) return Promise.resolve(false);
    var got = sub ? Promise.resolve(sub) : subscription();
    return got.then(function (s) {
      if (!s) return false;
      var hdr = { 'content-type': 'application/json' };
      if (token()) hdr.Authorization = 'Bearer ' + token();
      var tz = '';
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
      return fetch(PUSH_API, {
        method: 'POST', headers: hdr,
        body: JSON.stringify({ sub: s.toJSON(), tz: tz, dueOn: dueProjection() })
      }).then(function (r) { if (r.ok) write('remindat', Date.now()); return r.ok; });
    }).catch(function () { return false; });
  }
  function scheduleRemind() {
    if (!remindRec()) return;
    if (remTimer) clearTimeout(remTimer);
    remTimer = setTimeout(function () { remindSync(); }, 4000);   // one POST per burst of reviews
  }
  /* Turn the reminder on. The permission is asked for FIRST, inside the tap
     that asked for it — Safari refuses the question once anything has been
     awaited — and only then is the key fetched and the subscription made.
     Resolves to 'on', 'denied', 'unsupported', 'off-server' or 'failed'. */
  function remindOn() {
    if (!pushable()) return Promise.resolve('unsupported');
    var ask;
    try { ask = global.Notification.requestPermission(); } catch (e) { ask = null; }
    if (!ask || typeof ask.then !== 'function') {
      ask = new Promise(function (res) { global.Notification.requestPermission(res); });
    }
    return ask.then(function (perm) {
      if (perm !== 'granted') return 'denied';
      return fetch(PUSH_API, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (cfg) {
        if (!cfg || !cfg.publicKey) return 'off-server';
        return global.navigator.serviceWorker.ready.then(function (reg) {
          return reg.pushManager.getSubscription().then(function (have) {
            return have || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(cfg.publicKey) });
          });
        }).then(function (sub) {
          write('remind', { endpoint: sub.endpoint, at: Date.now() });
          return remindSync(sub).then(function (ok) {
            if (ok) return 'on';
            write('remind', null);
            return 'failed';
          });
        });
      });
    }).catch(function () { return 'failed'; });
  }
  function remindOff() {
    write('remind', null);
    if (!pushable()) return Promise.resolve(true);
    return subscription().then(function (sub) {
      if (!sub) return true;
      var ep = sub.endpoint;
      return sub.unsubscribe().catch(function () { return true; }).then(function () {
        return fetch(PUSH_API, { method: 'DELETE', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: ep }) }).then(function () { return true; }, function () { return true; });
      });
    }).catch(function () { return true; });
  }

  /* ---- streak ----------------------------------------------------------- */
  function streak() {
    var n = dayNum(), count = 0;
    if (!state.log[dayKey(n)]) n -= 1;              // today not studied yet is fine
    while (state.log[dayKey(n)]) { count++; n--; }
    return count;
  }
  function studiedToday() { return state.log[dayKey(dayNum())] || 0; }
  function history(days) {
    var out = [], n = dayNum();
    for (var i = days - 1; i >= 0; i--) out.push({ day: n - i, count: state.log[dayKey(n - i)] || 0 });
    return out;
  }

  /* ---- settings & profiles API ------------------------------------------ */
  function setSetting(k, v) { state.settings[k] = v; save(true); }
  function getSettings() { return state.settings; }

  function listProfiles() { return profiles.slice(); }
  function activeProfile() {
    return profiles.filter(function (p) { return p.id === activeId; })[0];
  }
  function switchProfile(id) {
    if (!profiles.some(function (p) { return p.id === id; })) return;
    save(true);
    activeId = id; write('active', activeId); loadState();
  }
  function addProfile(name) {
    var p = newProfile(name); profiles.push(p); write('profiles', profiles);
    switchProfile(p.id); return p;
  }
  function renameProfile(id, name) {
    profiles.forEach(function (p) { if (p.id === id) p.name = name; });
    write('profiles', profiles);
  }
  function removeProfile(id) {
    if (profiles.length < 2) return false;
    profiles = profiles.filter(function (p) { return p.id !== id; });
    write('profiles', profiles);
    try { localStorage.removeItem(NS + '.state.' + id); } catch (e) {}
    if (activeId === id) switchProfile(profiles[0].id);
    return true;
  }
  function resetProgress(deckId) {
    // the reader's done marks are progress too, not a preference — leaving
    // them behind made "Progress reset" a lie on the Ladders index
    if (!deckId) { state.cards = {}; state.log = {}; delete state.settings.ladderDone; delete state.settings.ladderChecks; }
    else {
      var d = decks[deckId];
      if (d) d.cards.forEach(function (c) { delete state.cards[c.i]; });
    }
    save(true);
  }
  function exportData() {
    return JSON.stringify({ v: 1, profile: activeProfile().name, exported: new Date().toISOString(), state: state });
  }
  function importData(text) {
    var j = JSON.parse(text);
    // "truthy" is not a shape: a backup whose cards were the string "xxxx"
    // passed this check, overwrote real progress, and then made every later
    // grade throw — silently, for good
    if (!j || !plain(j.state) || !plain(j.state.cards)) throw new Error('Not an AP Decks backup');
    state = j.state;
    state.cards = saneAll(state.cards);
    if (!plain(state.log)) state.log = {};
    if (!plain(state.settings)) state.settings = {};
    loadStateMerge();
    save(true);
    return true;
  }
  function loadStateMerge() {
    var s = {};
    for (var k in DEFAULT_SETTINGS) s[k] = DEFAULT_SETTINGS[k];
    for (var j in (state.settings || {})) s[j] = state.settings[j];
    state.settings = s;
  }

  function restore(id, before, day) {
    if (before) state.cards[id] = before; else delete state.cards[id];
    // grade() wrote two things; undo used to put back only one, so undoing
    // every card of a session still left the day counted and the streak lit
    if (day != null) {
      var k = dayKey(day), n = (state.log[k] || 0) - 1;
      if (n > 0) state.log[k] = n; else delete state.log[k];
    }
    save(true);
  }

  if (global.addEventListener) {
    global.addEventListener('pagehide', function () { save(true); });
    global.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') save(true);
    });
  }

  global.Store = {
    restore: restore,
    dayNum: dayNum, dayKey: dayKey,
    loadIndex: loadIndex, loadDeck: loadDeck, loadAll: loadAll, refreshIndex: refreshIndex,
    /* An index that has not landed used to be null, and every one of the two
       dozen `S.getIndex().courses` calls threw on it — tapping a tab in the
       first second of a cold start raised "Cannot read properties of null".
       An empty shelf is the honest shape of "nothing yet", and it is the same
       shape as the real thing. */
    getIndex: function () { return index || { courses: [], total: 0 }; },
    indexReady: function () { return !!index; },
    getDeck: function (id) { return decks[id]; },
    deckPending: function (id) { return !!loading[id]; },
    cs: cs, isNew: isNew, isDue: isDue, isSeen: isSeen, isKnown: isKnown, isStarred: isStarred,
    ivl: ivl,
    toggleStar: toggleStar, grade: grade, preview: preview, next: nextInterval, reschedule: reschedule, commit: commit,
    noteOf: noteOf, setNote: setNote, NOTE_MAX: NOTE_MAX,
    pool: pool, buildSession: buildSession, deckStats: deckStats, unitStats: unitStats,
    retired: retiredDeck, setRetired: setRetired, dueProjection: dueProjection,
    remind: { status: remindStatus, on: remindOn, off: remindOff, sync: remindSync,
              lastAt: function () { return read('remindat', 0); } },
    streak: streak, studiedToday: studiedToday, history: history,
    setSetting: setSetting, getSettings: getSettings, save: save,
    listProfiles: listProfiles, activeProfile: activeProfile, switchProfile: switchProfile,
    addProfile: addProfile, renameProfile: renameProfile, removeProfile: removeProfile,
    resetProgress: resetProgress, exportData: exportData, importData: importData,
    shuffle: shuffle,
    storageFailed: function () { return saveFailed; },
    account: {
      connected: function () { return !!token(); },
      setToken: setToken, clearToken: clearToken,
      pull: pull, lastSyncAt: function () { return lastSyncAt; },
      lastFail: function () { return lastFail; },
      offWhy: function () { return offWhy; },
      ownerId: function () { return ownerHex; }
    }
  };
})(window);
