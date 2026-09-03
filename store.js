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
    var d = new Date((n * DAY) + new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
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
    glass: true           // liquid glass material on/off
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
  function loadState() {
    state = read(stateKey(), null) || { cards: {}, log: {}, settings: {}, created: dayNum() };
    if (!state.cards) state.cards = {};
    if (!state.log) state.log = {};
    var s = {};
    for (var k in DEFAULT_SETTINGS) s[k] = DEFAULT_SETTINGS[k];
    for (var j in (state.settings || {})) s[j] = state.settings[j];
    state.settings = s;
    return state;
  }
  loadState();

  var saveTimer = null, saveFailed = false;
  function save(now) {
    if (saveTimer) clearTimeout(saveTimer);
    if (now) { saveFailed = !write(stateKey(), state); schedulePush(); return; }
    saveTimer = setTimeout(function () { saveFailed = !write(stateKey(), state); schedulePush(); }, 120);
  }

  /* ---- account: sync ----------------------------------------------------
     One JSON blob per account behind /api on this same origin; the merge
     happens here. Cards merge per card by last-touched day (t), so two
     devices reviewing offline both keep their work; the day log takes the
     max per day; settings follow whichever side wrote the blob later. */
  var API = '/api/state';
  var pushTimer = null, lastSyncAt = read('syncat', 0), syncing = false;

  function mergeRemote(remote) {
    if (!remote || typeof remote !== 'object') return false;
    var changed = false;
    var rc = remote.cards || {};
    for (var id in rc) {
      var mine = state.cards[id], theirs = rc[id];
      if (!mine || (theirs.t || 0) > (mine.t || 0) ||
          ((theirs.t || 0) === (mine.t || 0) && (theirs.r || 0) > (mine.r || 0))) {
        state.cards[id] = theirs; changed = true;
      }
    }
    var rl = remote.log || {};
    for (var day in rl) {
      if ((rl[day] || 0) > (state.log[day] || 0)) { state.log[day] = rl[day]; changed = true; }
    }
    if (remote.settings && (remote._at || 0) > lastSyncAt) {
      for (var k in remote.settings) state.settings[k] = remote.settings[k];
      changed = true;
    }
    return changed;
  }

  function pull() {
    if (!token()) return Promise.resolve(false);
    return fetch(API, { headers: { Authorization: 'Bearer ' + token() } })
      .then(function (r) {
        if (r.status === 401) { return false; }
        if (!r.ok) return false;
        return r.json().then(function (j) {
          var changed = j && j.state ? mergeRemote(j.state) : false;
          lastSyncAt = Date.now(); write('syncat', lastSyncAt);
          if (changed) { write(stateKey(), state); }
          try { window.dispatchEvent(new CustomEvent('apdecks-sync', { detail: { changed: changed } })); } catch (e) {}
          return changed;
        });
      })
      .catch(function () { return false; });
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
    }).then(function (r) { if (r.ok) { lastSyncAt = at; write('syncat', at); } })
      .catch(function () { /* offline: the next save retries */ })
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
        return d;
      });
    return loading[id];
  }
  function loadAll() {
    return loadIndex().then(function (ix) {
      return Promise.all(ix.courses.map(function (c) { return loadDeck(c.id); }));
    });
  }

  /* ---- card state ------------------------------------------------------- */
  function cs(id) { return state.cards[id] || null; }
  function isNew(id) { return !state.cards[id]; }
  function isDue(id, today) {
    var s = state.cards[id];
    return !!s && s.d <= (today === undefined ? dayNum() : today);
  }
  function isKnown(id) {
    var s = state.cards[id];
    return !!s && s.r >= 2 && s.i >= 7;
  }
  function isStarred(id) { var s = state.cards[id]; return !!(s && s.s); }
  function toggleStar(id) {
    var s = state.cards[id] || blank();
    s.s = s.s ? 0 : 1;
    state.cards[id] = s; save();
    return !!s.s;
  }
  function blank() { return { e: 2.5, r: 0, i: 0, d: dayNum(), l: 0, s: 0, n: -1, t: 0 }; }

  /* Intervals a rating would produce, for the button captions. */
  function preview(id, grade) {
    var s = state.cards[id] || blank();
    var i = nextInterval(s, grade).i;
    if (grade === 0) return 'now';
    if (i < 1) return 'today';
    if (i === 1) return '1 d';
    if (i < 30) return i + ' d';
    if (i < 365) return Math.round(i / 30) + ' mo';
    return (i / 365).toFixed(1) + ' y';
  }

  function nextInterval(s, grade) {
    var e = s.e || 2.5, r = s.r || 0, i = s.i || 0;
    if (grade === 0) { return { e: Math.max(1.3, e - 0.2), r: 0, i: 0 }; }
    if (grade === 1) {
      r += 1;
      i = r === 1 ? 1 : r === 2 ? 3 : Math.round(i * e);
      return { e: e, r: r, i: Math.max(1, i) };
    }
    r += 1;
    i = r === 1 ? 3 : r === 2 ? 6 : Math.round(i * e * 1.3);
    return { e: Math.min(3.0, e + 0.1), r: r, i: Math.max(1, i) };
  }

  /* grade: 0 again, 1 good, 2 easy */
  function grade(id, g) {
    var today = dayNum();
    var s = state.cards[id] || blank();
    var nx = nextInterval(s, g);
    s.e = nx.e; s.r = nx.r; s.i = nx.i;
    s.d = today + nx.i;
    if (g === 0) s.l = (s.l || 0) + 1;
    s.n = g; s.t = today;
    state.cards[id] = s;
    state.log[dayKey(today)] = (state.log[dayKey(today)] || 0) + 1;
    save();
    return s;
  }

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

  function deckStats(deck) {
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
    return { total: total, seen: seen, known: known, due: due, starred: starred,
             fresh: total - seen, pct: total ? known / total : 0 };
  }
  function unitStats(deck, unitId) {
    var sub = { cards: deck.cards.filter(function (c) { return c.u === unitId; }) };
    return deckStats(sub);
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
    if (!deckId) { state.cards = {}; state.log = {}; }
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
    if (!j || !j.state || !j.state.cards) throw new Error('Not an AP Decks backup');
    state = j.state;
    if (!state.log) state.log = {};
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

  function restore(id, before) {
    if (before) state.cards[id] = before; else delete state.cards[id];
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
    loadIndex: loadIndex, loadDeck: loadDeck, loadAll: loadAll,
    getIndex: function () { return index; }, getDeck: function (id) { return decks[id]; },
    cs: cs, isNew: isNew, isDue: isDue, isKnown: isKnown, isStarred: isStarred,
    toggleStar: toggleStar, grade: grade, preview: preview,
    pool: pool, buildSession: buildSession, deckStats: deckStats, unitStats: unitStats,
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
      ownerId: function () { return ownerHex; }
    }
  };
})(window);
