/* ==========================================================================
   app.js — routing, views, and the study session.
   Content stays flat and typographic; Liquid Glass carries the chrome.
   ========================================================================== */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var tabs = document.getElementById('tabs');
  var tabbar = document.getElementById('tabbar');
  var toastEl = document.getElementById('toast');
  var S = window.Store, T = window.Tex;

  /* ---------------- tiny helpers ---------------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  // set by the router when the active tab changes; the next mount slides in
  // from the direction of travel, then the hint is spent
  var pendingDir = '';
  var shellStale = false;          // a newer worker took over while this page ran
  /* A session re-renders on every reveal, grade, star and mode flip, and
     mount() replaces the whole screen — so the keyboard landed on <body> and
     a desktop user tabbed thirteen times to get back to the grades. Remember
     which control was focused and hand focus back to it, or to the grade row
     that replaced it. */
  var KEEPF = ['data-grade', 'data-reveal', 'data-pick', 'data-next', 'data-star', 'data-note',
               'data-hint', 'data-qmode', 'data-undo', 'data-exit'];
  function focusKey() {
    var a = document.activeElement;
    if (!a || !a.getAttribute || !app.contains(a)) return '';
    for (var i = 0; i < KEEPF.length; i++) {
      if (a.hasAttribute(KEEPF[i])) {
        var v = a.getAttribute(KEEPF[i]);
        return v ? '[' + KEEPF[i] + '="' + v + '"]' : '[' + KEEPF[i] + ']';
      }
    }
    return '';
  }
  function restoreFocus(key) {
    if (!key) return;
    // …and when the remembered control is gone, fall back to the RECOMMENDED
    // grade. It used to fall back to the first button in the row, which is
    // Again: revealing with the mouse and then pressing space — the key the
    // card itself prints — buried the card for the day.
    var el = app.querySelector(key) || app.querySelector('.rate .r-good') ||
             app.querySelector('.rate button');
    if (el) try { el.focus({ preventScroll: true }); } catch (e) {}
  }

  /* Arrival is the only cue. A screen that re-renders under your hands — a
     grade, a star, a tick, a toggle, a filter, the decks landing — is the same
     screen, so its rows stay put instead of rising in again. The hash says
     which screen this is; the done screen clears the memory to count as new. */
  var lastMountHash = null;
  /* The rail as last drawn. On a wide screen it stands across mounts and is
     patched only when a number on it moved: it used to be rebuilt, and its
     rows re-run their entrance, on every card graded beside it. */
  var railHTML = '';

  /* Make a standing element match new markup by changing the least it can:
     a text node whose words moved gets new words, an attribute that differs is
     set, and only a node whose kind changed is swapped out. Rows keep their
     identity, so nothing re-lays out, re-animates or loses hover under the
     pointer. Children pair up by position, which is all the rail needs — its
     courses are a fixed list in a fixed order. */
  function syncHTML(el, html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    syncNodes(el, tpl.content);
  }
  function syncNodes(a, b) {
    var ac = Array.prototype.slice.call(a.childNodes), bc = Array.prototype.slice.call(b.childNodes);
    var n = Math.max(ac.length, bc.length);
    for (var i = 0; i < n; i++) {
      var x = ac[i], y = bc[i];
      if (!y) { a.removeChild(x); continue; }
      if (!x) { a.appendChild(y); continue; }
      if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { a.replaceChild(y, x); continue; }
      if (x.nodeType !== 1) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
      for (var j = x.attributes.length - 1; j >= 0; j--) {
        var an = x.attributes[j].name;
        if (!y.hasAttribute(an)) x.removeAttribute(an);
      }
      for (var k = 0; k < y.attributes.length; k++) {
        var at = y.attributes[k];
        if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
      }
      syncNodes(x, y);
    }
  }
  function mount(html, opts) {
    var keepFocus = opts && opts.session ? focusKey() : '';
    var dir = opts && opts.session ? '' : pendingDir;
    pendingDir = '';
    var here = location.hash || '#/';
    if (opts && opts.session && sess && !sess.h) sess.h = here.replace(/^#/, '') || '/';
    var still = here === lastMountHash && !dir;
    lastMountHash = here;
    // a device that cannot write is a device losing every grade you give it —
    // the store has known this all along and nothing ever said so
    var warn = S.storageFailed && S.storageFailed()
      ? '<div class="warnline">Not saving. This browser is refusing to store progress.</div>' : '';
    var shell = '<div class="screen' + (dir ? ' ' + dir : '') + (still ? ' still' : '') + '">' + warn + html + '</div>';
    if (isWide()) {
      // Two full-height panes: the deck list lives on the left, every view on
      // the right — the same content as the phone, never extra chrome.
      var pl = app.querySelector('.pane-l'), inner = app.querySelector('.pane-r > .inner');
      var rail = decksListHTML();
      if (!pl || !inner) {
        app.innerHTML = '<div class="pane-l">' + rail + '</div>' +
          '<div class="pane-r"><div class="inner">' + shell + '</div></div>';
      } else {
        // the rail is furniture: when a count on it moved, only that count is
        // touched — the rows, the head and the links stand. It used to be
        // torn down and rebuilt on every graded card, which read as the whole
        // sidebar reloading beside each answer.
        if (rail !== railHTML) syncHTML(pl, rail);
        inner.innerHTML = shell;
      }
      railHTML = rail;
      markRail();
    } else {
      app.innerHTML = shell;
      railHTML = '';
    }
    app.classList.toggle('is-wide', isWide());
    app.classList.toggle('is-session', !!(opts && opts.session));
    // a game round has no card stage to scroll inside, so the screen itself
    // has to be the scroller — a tall board used to clip with no way down.
    // (A study session always has `sess` set when it mounts; a game never
    // does. Sniffing the markup for "cardstage" was one card about CSS away
    // from being wrong.)
    app.classList.toggle('is-game', !!(opts && opts.session) && !sess);
    app.classList.toggle('is-quiz', !!(opts && opts.quiz));
    app.classList.toggle('is-book', !!(opts && opts.book));
    tabs.hidden = isWide() || !!(opts && opts.session) || !!(opts && opts.book);
    if (window.LG) window.LG.init(app);
    fitVals();
    if (!(opts && opts.keepScroll)) {
      var pr = app.querySelector('.pane-r');
      if (pr) pr.scrollTop = 0; else app.scrollTop = 0;
    }
    restoreFocus(keepFocus);
    // a new screen hands the keyboard its start — focus used to stay on
    // <body>, so a screen reader heard nothing change and a keyboard began
    // every screen from the top of the document
    if (!keepFocus && !still && !(opts && opts.keepScroll)) { try { app.focus({ preventScroll: true }); } catch (e) {} }
  }
  /* a screen with no rail: boot, and the failure to boot. On two panes it
     still takes the right pane's measure and padding — it inherited the flex
     row instead, and its heading and button sat side by side, flush with the
     window's corner. */
  function bare(html) {
    var shell = '<div class="screen">' + html + '</div>';
    app.innerHTML = isWide() ? '<div class="pane-r"><div class="inner">' + shell + '</div></div>' : shell;
    app.classList.toggle('is-wide', isWide());
    railHTML = '';
  }

  /* When a row's name wraps tall, its number grows to match the text block —
     but only when the name loses no room for it. A long title keeps its full
     measure and a plain baseline number; matching height there just collides. */
  function fitPair(row, name, val) {
    row.classList.remove('tallval'); val.style.fontSize = '';
    var base = parseFloat(getComputedStyle(val).fontSize);
    var lh = parseFloat(getComputedStyle(name).lineHeight) || base;
    var nh0 = name.getBoundingClientRect().height;
    // exactly two lines earns a two-line number; one line has nothing to
    // match, and three or more would put a shouting numeral beside a long name
    if (nh0 <= lh * 1.5 || nh0 > lh * 2.5) return;
    var target = Math.min(Math.round(nh0), Math.round(base * 2.6));
    if (target <= base + 2) return;
    row.classList.add('tallval');
    val.style.fontSize = target + 'px';
    if (name.getBoundingClientRect().height > nh0 + 1) {   // the name re-wrapped —
      row.classList.remove('tallval');                     // the number stole its
      val.style.fontSize = '';                             // room; keep it plain
    }
  }
  /* The detail hero wears title type — a long unit name at that size wraps
     word-per-line and fights the number. Step long names down a size first,
     then let the number grow only if the (settled) name stays two lines. */
  function fitHero(row, name, val) {
    row.classList.remove('longname');
    fitPair(row, name, val);
    var lh = parseFloat(getComputedStyle(name).lineHeight);
    if (name.getBoundingClientRect().height <= lh * 2.5 &&
        name.scrollWidth <= name.clientWidth + 1) return;
    row.classList.remove('tallval'); val.style.fontSize = '';
    row.classList.add('longname');
    fitPair(row, name, val);
  }
  function fitVals() {
    // Only the hero's number grows to its name. In a list the numbers are
    // quantities you compare down the column, and sizing them by how long
    // the title beside them happens to be made 140 smaller than 68.
    app.querySelectorAll('.dhero').forEach(function (hero) {
      var dn = hero.querySelector('.dn'), dv = hero.querySelector('.dv');
      if (dn && dv && dv.textContent.trim()) fitHero(hero, dn, dv);
    });
  }

  /* ---------------- two-pane wide layout (skill §5.6) -------------------- */
  var WIDE_MQ = matchMedia('(min-width:900px) and (min-height:500px)');
  function isWide() { return WIDE_MQ.matches; }
  var curDeckId = null;          // which deck the right pane is about (marks the left row)
  var lastDeckId = null;         // remembered so "/" can open somewhere sensible on wide

  /* real progress deserves a copy that survives the phone — nudge quietly
     after a month, on a key Reset progress never clears. It lived inside
     viewDecks(), which a wide screen never renders, so desktop never saw it. */
  function backupNudge(seen) {
    var lastBk = 0; try { lastBk = +localStorage.getItem('apdecks.backup.last') || 0; } catch (e) {}
    if (!(seen > 50 && Date.now() - lastBk > 30 * 864e5)) return '';
    return '<div class="foot"><button class="textbtn quiet" data-go="#/settings">' +
      (lastBk ? 'Last backup ' + Math.round((Date.now() - lastBk) / 864e5) + ' days ago'
              : 'Progress lives only on this phone — back it up') + '</button></div>';
  }

  function decksListHTML() {
    var ix = S.getIndex(), due = 0, seen = 0;
    var rows = ix.courses.map(function (c) {
      var d = S.getDeck(c.id);
      var st = d ? S.deckStats(d) : { due: 0 };
      due += st.due; seen += st.seen || 0;
      return '<li><button class="ledger" data-go="#/d/' + c.id + '">' +
        '<span class="lname">' + esc(nice(c.id)) + '</span>' +
        '<span class="lval num">' + (st.due || c.count).toLocaleString() + '</span>' +
        (st.due ? '<span class="lsub">' + esc('due · ' + plural(c.count, 'card')) + '</span>'
                : S.retired(c.id) ? '<span class="lsub">Exam over</span>' : '') +
        '</button></li>';
    }).join('');
    var hero = due ? plural(due, 'card') + ' due' : ix.total.toLocaleString() + ' cards';
    /* An evening's work used to leave no trace on the screen you land on: the
       headline went from 261 to 229 and said nothing about the hundred cards
       that moved it. The line under it is the day's own count. */
    var didToday = S.studiedToday();
    var note = [];
    if (didToday) note.push(plural(didToday, 'review') + ' today');
    if (S.streak() > 1) note.push(S.streak().toLocaleString() + '-day streak');
    return '<div class="rail"><div class="head">' +
        (due ? '<button class="hero-tap" data-go="#/review"><h1>' + esc(hero) + '</h1></button>'
             : '<h1>' + esc(hero) + '</h1>') +
        (note.length ? '<div class="sub">' + esc(note.join(' · ')) + '</div>' : '') + '</div>' +
      resumeHTML() +
      '<ul class="list tight still">' + rows + '</ul>' +
      backupNudge(seen) + '</div>' +
      '<div class="lnav">' +
        '<button class="textbtn" data-go="#/review">Review</button>' +
        '<button class="textbtn" data-go="#/search">Search</button>' +
        '<button class="textbtn" data-go="#/stats">Progress</button>' +
        // the two panes never show viewDecks(), so the deck list's own links
        // have to exist here too or Starred is unreachable on a laptop
        '<button class="textbtn" data-go="#/starred">Starred</button>' +
        '<button class="textbtn" data-go="#/games">Games</button>' +
        '<button class="textbtn" data-go="#/settings">Settings</button>' +
      '</div>';
  }

  /* The row for the deck the right pane is about — set on the standing rail,
     never by redrawing it. */
  function markRail() {
    var pl = app.querySelector('.pane-l');
    if (!pl) return;
    pl.querySelectorAll('.ledger').forEach(function (b) {
      var on = !!curDeckId && b.getAttribute('data-go') === '#/d/' + curDeckId;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  /* Spoken, not shown. The toast is a visual object with visual timing; this
     is the parallel channel for anything a reader has to be told. */
  var liveEl = null;
  function announce(msg) {
    if (!liveEl) {
      liveEl = document.createElement('div');
      liveEl.className = 'sr-only';
      liveEl.setAttribute('aria-live', 'polite');
      liveEl.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveEl);
    }
    // the same text twice is not re-announced unless the node changes
    liveEl.textContent = '';
    setTimeout(function () { liveEl.textContent = msg; }, 30);
  }

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    // 1.7s was under a reading speed for anything longer than a word
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); },
      Math.min(7000, Math.max(1900, String(msg).length * 85)));
  }
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var RING = '<div class="loadring" role="status" aria-label="Loading"></div>';
  var pushDepth = 0;   // in-app pushes behind us — back falls back to a parent at zero
  function go(hash) {
    var next = hash.charAt(0) === '#' ? hash : '#' + hash;
    if (location.hash === next) route();
    else { pushDepth++; location.hash = next; }
  }
  // replace, don't push: leaving no history entry behind
  function goReplace(hash) {
    var next = hash.charAt(0) === '#' ? hash : '#' + hash;
    if (location.hash === next) route(); else location.replace(next);
  }
  /* where "back" lands when the app was opened right here (deep link, PWA
     restore) and there is nothing behind us to go back to */
  function parentOf(h) {
    var p = h.replace(/^#/, '').split('/').filter(Boolean);
    if (p[0] === 'game') return '#/games';
    if (p[0] === 'games') return '#/';
    // a unit's free-response page goes back to the unit
    if (p[0] === 'd' && p[2] === 'u' && p[3] && p[4] === 'frq') return '#/d/' + p[1] + '/u/' + p[3];
    if (p[0] === 'd' && (p[2] === 'u' || p[2] === 'w' || p[2] === 'a' || p[2] === 'g' || p[2] === 'plan')) return '#/d/' + p[1];
    if (p[0] === 'd' && p[2] === 'l') { var bi = bookOf(p[1]), it = bi && bi.items[p[3]]; return '#/d/' + p[1] + (it ? '/u/' + it.u : ''); }
    if (p[0] === 'd' && p[2] === 'r') { var br = bookOf(p[1]), rp = br && br.resPhase[p[3]]; return '#/d/' + p[1] + (rp ? '/b/' + rp.n : ''); }
    if (p[0] === 'd' && p[2] === 'b') { var bp = bookOf(p[1]), ph = bp && bp.phases[p[3]]; return '#/d/' + p[1] + (ph ? '/u/' + ph.u : ''); }
    if ((p[0] === 'study' || p[0] === 'quiz') && p[1]) return '#/d/' + p[1] + (p[3] ? '/u/' + p[3] : '');
    // a grammar point's cram goes back to the list of points
    if (p[0] === 'cram' && p[1]) return !p[2] ? '#/d/' + p[1] : p[2].indexOf('g:') === 0 ? '#/d/' + p[1] + '/g' : '#/d/' + p[1] + '/u/' + p[2];
    if (p[0] === 'weak' || p[0] === 'stuck') return '#/stats';
    return '#/';
  }
  function plural(n, one, many) { return n.toLocaleString() + ' ' + (n === 1 ? one : (many || one + 's')); }
  /* a US keyboard cannot type é — search folds accents off both sides so
     "societe" finds "société". Older engines without \\p{M} keep their text. */
  var MARKS = null;
  try { MARKS = new RegExp('\\p{M}', 'gu'); } catch (e) { MARKS = null; }
  function fold(s) {
    s = String(s == null ? '' : s);
    if (!MARKS || !s.normalize) return s;
    return s.normalize('NFD').replace(MARKS, '');
  }
  // Shorten the label before the type (skill §3): the course identity, one line.
  var NICE = { lang: 'English', chem: 'Chemistry', french: 'French', calcbc: 'Calc BC', apush: 'US History',
               sat: 'SAT Vocab' };
  function nice(idOrDeck) {
    var id = typeof idOrDeck === 'string' ? idOrDeck : idOrDeck.id;
    if (NICE[id]) return NICE[id];
    if (typeof idOrDeck !== 'string') return idOrDeck.short || id;
    // a deck the map does not know (an owner's private one) names itself
    var ix = S.getIndex(), c = ix && ix.courses.filter(function (x) { return x.id === id; })[0];
    return (c && c.short) || id;
  }
  // "100%" only ever means all of them, "0%" only ever means none: rounding
  // printed 100% over a hero reading 4,440 of 4,441
  function pct(x) {
    if (x >= 1) return '100%';
    if (x <= 0) return '0%';
    return Math.min(99, Math.max(1, Math.floor(x * 100))) + '%';
  }
  // verbs arrive from the data in caps — never render them that way
  function verb(v) { return v ? v.charAt(0) + v.slice(1).toLowerCase() : ''; }

  /* Python's indentation is semantic, so a wrapped line that resumed at column
     zero misinformed: a trailing comment read as a top-level one. Each source
     line becomes its own block, which lets a hanging indent inset only the
     continuations. text-indent alone cannot do this — it applies once per
     block, not once per newline, and `each-line` is in no shipping engine. */
  function codeHTML(src) {
    return '<pre>' + String(src).split('\n').map(function (ln) {
      return '<span class="cl">' + (esc(ln) || '&#8203;') + '</span>';
    }).join('') + '</pre>';
  }

  function backbar(title, rightHtml) {
    // no arrows anywhere: the screen's name is the way back, like the heroes
    return '<div class="backbar">' +
      '<button class="bk" data-back>' + esc(title) + '</button>' +
      (rightHtml || '') + '</div>';
  }

  /* ==========================================================================
     THE YEAR — the app knows when the exams are, and says whether the
     high-yield core is on schedule. The whole deck is out of reach at any
     realistic pace; the core is the mission.
     ========================================================================== */
  var EXAM = { chem: [2027, 5, 3], apush: [2027, 5, 7], calcbc: [2027, 5, 10],
               lang: [2027, 5, 11], french: [2027, 5, 13] };
  var MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function examDayNum(id) {
    var e = EXAM[id];
    return e ? S.dayNum(new Date(e[0], e[1] - 1, e[2])) : 0;
  }
  function examName(id) { var e = EXAM[id]; return e ? MONTHS[e[1]] + ' ' + e[2] : ''; }
  function firstStudyDay() {
    var h = S.history(400);
    for (var i = 0; i < h.length; i++) if (h[i].count > 0) return h[i].day;
    return null;
  }
  function corePace(d) {
    var exam = examDayNum(d.id), today = S.dayNum();
    if (!exam || exam <= today) return null;
    var core = S.pool(d, null, 'core'), known = 0;
    core.forEach(function (c) { if (S.isKnown(c.i)) known++; });
    var out = { days: exam - today, left: core.length - known, drift: 0, rate: 0, sure: false };
    var start = firstStudyDay();
    // …and no verdict at all for a course with nothing in it: with known = 0
    // the drift collapses to -(today - start), which is the SAME confident,
    // course-specific-looking number for every deck you have never opened
    if (start === null || today - start < 14 || !core.length) return out;   // no verdict before two weeks
    if (!S.deckStats(d).seen) return out;
    var span = Math.max(1, exam - start);
    var expected = Math.min(1, (today - start) / span);
    out.drift = Math.round((known / core.length - expected) * span);
    out.rate = Math.ceil(out.left / Math.max(1, out.days - 14));
    out.sure = true;
    return out;
  }
  /* COVERAGE — will every card in this deck have been dealt before its exam?
     The daily deal takes newPerSession unseen cards and interleaves the decks,
     so one deck's share of that rate is it divided among the decks that still
     have unseen cards. The student cannot see any of this, and it is the one
     number that decides whether the syllabus gets covered in time — a session
     that reviews beautifully and never reaches Unit 7 is not revision. */
  /* The deal hands unseen cards out round-robin across the decks that still
     have any, so a deck's share rises as its neighbours finish. Run that
     rotation forward rather than assuming a fixed 1/5 share, which said APUSH
     would be 14 cards short when in fact the whole library lands in 222 days. */
  function coverRun(perDay) {
    var decks = [], out = {};
    S.getIndex().courses.forEach(function (c) {
      var dk = S.getDeck(c.id); if (!dk || S.retired(c.id)) return;
      decks.push({ id: c.id, left: S.deckStats(dk).fresh });
    });
    decks.forEach(function (x) { if (!x.left) out[x.id] = 0; });
    var day = 0, guard = 0;
    while (guard++ < 2000 && decks.some(function (x) { return x.left > 0; })) {
      day++;
      var n = perDay;
      while (n > 0) {
        var live = decks.filter(function (x) { return x.left > 0; });
        if (!live.length) break;
        for (var i = 0; i < live.length && n > 0; i++) {
          live[i].left--; n--;
          if (!live[i].left) out[live[i].id] = day;
        }
      }
    }
    return { byDeck: out, all: day };
  }
  /* the smallest new-cards-a-day that gets THIS deck finished in time, found
     by running the rotation rather than by scaling the current rate */
  var PACE = {};
  function paceFor(deckId, days) {
    var key = deckId + '|' + days + '|' + S.dayNum();
    if (PACE[key] !== undefined) return PACE[key];
    var lo = 1, hi = 120, ans = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var got = coverRun(mid).byDeck[deckId];
      if (got !== undefined && got <= days) { ans = mid; hi = mid - 1; } else lo = mid + 1;
    }
    return (PACE[key] = ans);
  }
  var COVER = null;
  function coverage(deckId) {
    var set = S.getSettings(), exam = examDayNum(deckId), today = S.dayNum();
    if (!exam || exam <= today) return null;
    var perDay = Math.max(1, Math.min(set.newPerSession, set.sessionSize));
    if (!COVER || COVER.perDay !== perDay || COVER.at !== today) {
      COVER = coverRun(perDay); COVER.perDay = perDay; COVER.at = today;
    }
    var need = COVER.byDeck[deckId];
    return { need: need, days: exam - today, perDay: perDay, all: COVER.all };
  }
  function coverLine(deckId) {
    var cv = coverage(deckId);
    if (!cv || !cv.need) return '';                      // nothing unseen left
    if (cv.need <= cv.days) {
      var spare = cv.days - cv.need;
      return '<div class="ulabel cover">' + esc('Every card seen by ' + dateWord(S.dayNum() + cv.need) +
        (spare > 0 ? ' · ' + plural(spare, 'day') + ' spare' : '')) + '</div>';
    }
    // the honest version: name the shortfall, and make the rate that closes it
    // one tap away — a forecast you cannot act on is just bad news. The rate
    // is SOLVED for, not scaled: raising it changes every deck's share, so
    // "16 a day covers it" once set turned into "18 a day covers it".
    var want = paceFor(deckId, cv.days);
    if (!want) return '<div class="ulabel cover">' +
      esc('Not every card before the exam at ' + cv.perDay + ' new a day') + '</div>';
    return '<div class="ulabel cover">' +
      esc('Not every card before the exam at ' + cv.perDay + ' new a day') +
      '<span class="nowrap"> · <button class="pace" data-pace="' + want + '">' + want + ' a day covers it</button></span></div>';
  }
  function dateWord(dayN) {
    var dt = new Date(S.dayKey(dayN) + 'T12:00:00Z');
    return MONTHS[dt.getUTCMonth() + 1] + ' ' + dt.getUTCDate();   // MONTHS is 1-indexed; month first, as the exam date reads
  }

  function paceLine(d) {
    var p = corePace(d);
    if (!p) return '';
    // "May 3 · 241 days" in grey above the title read as a date with no
    // subject — it could have been a goal, or when the deck was written
    var out = 'Exam ' + examName(d.id) + ' · ' + plural(p.days, 'day');
    if (!p.left) return out + ' · core done';
    if (!p.sure) return out;                       // the countdown, no verdict yet
    if (p.drift <= -20) return out + ' · ' + (-p.drift) + ' days behind · ' + p.rate + ' a day';
    if (p.drift <= -3) return out + ' · ' + (-p.drift) + ' days behind';
    if (p.drift >= 3) return out + ' · ' + p.drift + ' days ahead';
    return out + ' · on pace';
  }
  function paceWord(d) {
    var p = corePace(d);
    if (!p) return '';
    if (!p.left) return 'Done';
    if (!p.sure) return '';
    if (p.drift <= -3) return (-p.drift) + ' days behind';
    if (p.drift >= 3) return p.drift + ' days ahead';
    return 'On pace';
  }
  /* What the next week actually looks like. The app knew every card's due day
     and never said it out loud: a reader who took Saturday off had no way to
     see the 180 cards landing on Monday until Monday. Day 0 carries every
     overdue card, because that is where they are. */
  /* The first version of this counted the cards already stamped with each
     date. That reads low every day but today, because most of tomorrow's work
     is created by today's session — grade thirty cards Good and thirty new
     dates appear. It walks the days forward instead: each day takes what a
     session takes, and every card it studies comes back on the day its own
     interval says. Everything is graded Good, which is the only assumption
     available and the one the app's own preview makes. */
  function forecast(days, opts) {
    var today = S.dayNum(), set = S.getSettings();
    var size = (opts && opts.size) || set.sessionSize || 30;
    var fresh = (opts && opts.fresh != null) ? opts.fresh : (set.newPerSession || 0);
    // one light record per scheduled card: the day it lands and the interval
    // a Good would earn it next
    var sched = [], newLeft = 0;
    S.getIndex().courses.forEach(function (c) {
      var d = S.getDeck(c.id); if (!d) return;
      d.cards.forEach(function (card) {
        if (!S.isSeen(card.i)) { newLeft++; return; }
        var st = S.cs(card.i);
        sched.push({ d: Math.max(today, st.d), i: st.i || 1, e: st.e || 2.5, r: st.r || 0 });
      });
    });
    var due = [], out = [];
    for (var k = 0; k < days; k++) out.push(0);
    for (var day = today; day < today + days; day++) {
      due.length = 0;
      for (var j = 0; j < sched.length; j++) if (sched[j].d <= day) due.push(sched[j]);
      out[day - today] = due.length;
      // what the day's session actually takes: reviews first, then new cards
      var take = Math.min(due.length, Math.max(0, size - Math.min(fresh, newLeft)));
      for (var q = 0; q < take; q++) {
        var cd = due[q];
        // the store's own ladder, not a copy of it: this walk once carried
        // its own 1 · 3 · ×ease while the grades had moved on to 2 · 3, and
        // then to 3 · 8, and a week-ahead built on the wrong rungs is wrong
        var nx = S.next(cd, 2);
        cd.r = nx.r; cd.i = nx.i; cd.e = nx.e;
        cd.d = day + cd.i;
      }
      // and the new cards it introduces, which come back when a first Good
      // says — a new card is not seen again tomorrow
      var got = Math.min(fresh, newLeft, Math.max(0, size - take));
      newLeft -= got;
      for (var g = 0; g < got; g++) {
        var fn = S.next({}, 2);
        sched.push({ d: day + fn.i, i: fn.i, e: fn.e, r: fn.r });
      }
    }
    return out;
  }
  /* how many days of sessions the overdue pile alone is worth */
  /* The two session settings interact, and nothing said so. A 30-card session
     that deals 20 new cards has ten places for reviews; introduce twenty a day
     and you owe more than ten a day back, so the pile grows for as long as
     there are new cards left. This runs the same forward walk the week ahead
     uses, out to thirty days, and says which way the line is going. */
  var SIZES = [15, 20, 30, 50, 100];      // the values the Session word cycles
  function driftAt(size) {
    var f = forecast(30, { size: size });
    return f.length ? (f[29] - f[0]) / 29 : 0;
  }
  var STEADY = 2;      // a couple of cards a day either way is level enough
  function paceVerdict() {
    var set = S.getSettings(), size = set.sessionSize || 30, fresh = set.newPerSession || 0;
    var slots = rawSlots(size, fresh);
    if (!slots) return fresh + ' new cards fill a session of ' + size +
      ', so there is no room for a review at all. Fewer new cards, or a longer session.';
    // …and what a session actually deals when there is nothing due yet, which
    // is where "Session 30" and a screen reading "1 of 20" part company
    var head = plural(slots, 'review') + ' a session after ' + fresh + ' new' +
      (fresh < size ? '; with nothing due, a session is ' + fresh : '');
    var drift = driftAt(size);
    if (Math.abs(drift) <= STEADY) return head + '. At this pace the pile holds steady.';
    if (drift < 0) return head + '. At this pace the pile falls by about ' +
      Math.round(-drift) + ' a day.';
    // it grows — say by how much, and name the smallest session that would not
    var fix = null;
    for (var i = 0; i < SIZES.length; i++) {
      if (SIZES[i] <= size) continue;
      if (driftAt(SIZES[i]) <= STEADY) { fix = SIZES[i]; break; }
    }
    return head + '. At this pace the review pile grows by about ' + Math.round(drift) + ' a day' +
      (fix ? '. A session of ' + fix + ' would hold it.'
           : ', and no session length here holds it: fewer new cards a day would.');
  }

  function reviewSlots() {
    var set = S.getSettings(), size = set.sessionSize || 30;
    // a session deals new cards first, so the review slots are what is left
    return Math.max(1, size - Math.min(set.newPerSession || 0, size));
  }
  /* the same number without the floor: it can genuinely be zero */
  function rawSlots(size, fresh) { return Math.max(0, size - Math.min(fresh, size)); }
  function backlogDays(overdue) { return Math.ceil(overdue / reviewSlots()); }
  /* The pile's real horizon. Dividing it by the session's review slots assumes
     a reviewed card never comes back — the one thing every reviewed card does.
     It printed "27 days" for a pile that at those settings never clears at
     all. This runs the same forward walk the week ahead uses and reports the
     first day it finds nothing due, or nothing when there isn't one. */
  var CLEAR_HORIZON = 180;
  function clearDays() {
    var f = forecast(CLEAR_HORIZON);
    for (var i = 0; i < f.length; i++) if (!f[i]) return i;
    return null;
  }
  /* THE WAY OUT. Every overdue card is restamped across the days ahead so no
     day carries more than a session's review slots. Nothing is forgotten and
     nothing is reset: the interval, the ease and the count a card earned all
     stand, and only the date it comes back moves. Oldest first, so what has
     waited longest is what returns first. Before this the only relief in the
     whole app was Reset progress, which throws the work away. */
  function spreadBacklog() {
    var today = S.dayNum(), per = reviewSlots(), ids = [], load = {};
    S.getIndex().courses.forEach(function (c) {
      var d = S.getDeck(c.id); if (!d) return;
      d.cards.forEach(function (card) {
        if (S.isDue(card.i, today)) { ids.push(card.i); return; }
        // …and what the days ahead ALREADY hold. Filling each day to the cap
        // while ignoring its existing load would have handed a day its
        // session twice over, which is the promise this control makes.
        var st = S.cs(card.i);
        if (st && S.isSeen(card.i)) load[st.d] = (load[st.d] || 0) + 1;
      });
    });
    if (ids.length <= per) return 0;
    ids.sort(function (a, b) { return ((S.cs(a) || {}).d || 0) - ((S.cs(b) || {}).d || 0); });
    // A card due today that stays on today has still been placed. Counting
    // writes instead of placements told a student who spread eleven cards
    // that two had moved, which reads as a control that half-worked.
    var wrote = 0, day = today;
    for (var k = 0; k < ids.length; k++) {
      while ((load[day] || 0) >= per) day++;
      load[day] = (load[day] || 0) + 1;
      if (S.reschedule(ids[k], day)) wrote++;
    }
    if (wrote) S.commit();
    return ids.length;
  }

  function overdueCount() {
    var today = S.dayNum(), n = 0;
    S.getIndex().courses.forEach(function (c) {
      var d = S.getDeck(c.id); if (!d) return;
      d.cards.forEach(function (card) { if (S.isDue(card.i, today)) n++; });
    });
    return n;
  }
  var WDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function dayWord(n) {
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    return WDAY[new Date(S.dayKey(S.dayNum() + n) + 'T12:00:00Z').getUTCDay()];
  }

  /* the units that keep biting back — enough attempts, too many misses */
  function weakBuckets() {
    var out = [];
    S.getIndex().courses.forEach(function (c) {
      var d = S.getDeck(c.id); if (!d) return;
      var per = {};
      d.cards.forEach(function (card) {
        var s = S.cs(card.i);
        if (!s || !(s.r || s.t || s.l)) return;
        var b = per[card.u] || (per[card.u] = { studied: 0, bad: 0 });
        b.studied++;
        if ((s.l || 0) > 0 && !S.isKnown(card.i)) b.bad++;
      });
      Object.keys(per).forEach(function (uid) {
        var b = per[uid];
        // eight attempts before a unit may be called weak — the ranking is the
        // plain miss rate now, so the column the reader sees IS the ordering
        if (b.studied >= 8 && b.bad >= 3 && d.unitById[uid])
          out.push({ deck: d, unit: d.unitById[uid], studied: b.studied, bad: b.bad,
                     score: b.bad / b.studied });
      });
    });
    out.sort(function (a, b) { return (b.score - a.score) || (b.bad - a.bad); });
    return out;
  }
  /* "18–22%" → 20; anything unparseable is neutral */
  var W_CACHE = {};
  /* A unit's weight is its share of the exam — "7–9%", "18–22%". The LAST unit
     of every deck carries something else entirely: a format breakdown, "MC 50%
     · FRQ 50%". A loose /(\d+)%/ pulled 50 out of that, so Exam Craft scored
     higher than any real unit and every card a new user was dealt came from
     it. Only a bare share counts; anything with a label is not a weight. */
  var SHARE_RE = /^\s*(\d+)\s*(?:[–-]\s*(\d+)\s*)?%\s*$/;
  function shareOf(u) {
    var m = u && u.weight ? SHARE_RE.exec(String(u.weight)) : null;
    return m ? (m[2] ? (+m[1] + +m[2]) / 2 : +m[1]) : null;
  }
  function unitWeight(d, unitId) {
    var k = d.id + unitId;
    if (W_CACHE[k] !== undefined) return W_CACHE[k];
    var w = shareOf(d.unitById[unitId]);
    return (W_CACHE[k] = w === null ? 10 : w);
  }
  function weightText(u) {
    if (!u || !u.weight) return '';
    var w = String(u.weight);
    // A bare share is a claim about the exam and says so. A format breakdown
    // is printed as itself — "MC 50% · FRQ 50% of the exam" read as a claim
    // about that unit's share, and nothing told the reader otherwise. Anything
    // with no percentage in it ("Big Idea 1", "Thème 1") only repeats the unit
    // number printed directly above, so it stays off the row.
    if (shareOf(u) !== null) return w + ' of the exam';
    return w.indexOf('%') > -1 ? w : '';
  }

  /* ==========================================================================
     THE CHOSEN QUEUE — the daily session admits high-yield, heavily weighted,
     overdue and stuck cards first, always keeps room for new ones, and never
     lets one deck own a mixed session.
     ========================================================================== */
  function cardScore(c, d, today) {
    var s = S.cs(c.i);
    var score = 1;
    if (c.c) score += 2;                                      // high-yield core
    score += unitWeight(d, c.u) / 10;                         // 18–22% → +2
    if (S.isStarred(c.i)) score += 1.5;
    if (s) {
      if ((s.l || 0) >= 5) score += 1;                        // stuck
      // lateness used to saturate at a fortnight, so with a median 26 days
      // late the order fell back to syllabus weight and 34-day-old cards sat
      // while 21-day-old ones were dealt
      if (s.d <= today && (s.r || s.t || s.l)) score += Math.min(3, (today - s.d) / 10);
    }
    return score;
  }
  /* Deck by deck in rotation — the same rotation the coverage forecast runs,
     so what the forecast promises is what the deal does. Within a deck the
     rotation goes UNIT by unit as well: new cards are ranked by unit weight,
     and Chemistry's Unit 3 is 18–22% of the exam, so twenty new cards were
     twenty solubility cards and eight of nine units were never dealt. The
     lane key is deck+unit, and the units stay in weight order. */
  function roundRobin(list, n) {
    var lanes = {}, order = [];
    list.forEach(function (c) {
      var k = c.deck + '\u0000' + (c.u || '');
      if (!lanes[k]) { lanes[k] = []; order.push(k); }
      lanes[k].push(c);
    });
    var out = [];
    while (out.length < n) {
      var moved = false;
      for (var i = 0; i < order.length && out.length < n; i++) {
        if (lanes[order[i]].length) { out.push(lanes[order[i]].shift()); moved = true; }
      }
      if (!moved) break;
    }
    return out;
  }
  function interleave(list) {                                 // one deck never runs deep
    var lanes = {}, order = [];
    list.forEach(function (c) {
      if (!lanes[c.deck]) { lanes[c.deck] = []; order.push(c.deck); }
      lanes[c.deck].push(c);
    });
    var out = [], left = list.length;
    while (left) order.forEach(function (k) {
      if (lanes[k].length) { out.push(lanes[k].shift()); left--; }
    });
    return out;
  }
  function buildDaily(opts) {
    var today = S.dayNum(), set = S.getSettings();
    var limit = (opts && opts.limit) || set.sessionSize;
    var decks = opts && opts.deck ? [opts.deck]
      : S.getIndex().courses.map(function (c) { return S.getDeck(c.id); }).filter(Boolean);
    // a course whose exam is over is not dealt: its pile is paused, not owed
    decks = decks.filter(function (d) { return !S.retired(d.id); });
    var due = [], fresh = [];
    decks.forEach(function (d) {
      S.pool(d, (opts && opts.unit) || null, null).forEach(function (c) {
        var s = S.cs(c.i);
        var studied = s && (s.r || s.t || s.l);
        c._sc = cardScore(c, d, today);
        // a table (the ions, the shapes) is drilled on purpose from its own
        // buttons, never dealt as the day's new cards; once studied, its
        // cards come back due like any other
        var table = d.unitById && d.unitById[c.u] && d.unitById[c.u].table;
        if (S.isNew(c.i) || !studied) { if (!table || (opts && opts.unit)) fresh.push(c); }
        else if (S.isDue(c.i, today)) due.push(c);
      });
    });
    /* New cards are the BUDGET, not the leftovers.
       There are 4,441 cards and 241 days to the first exam. Whether the
       syllabus gets covered is decided by one number — how many unseen cards
       are dealt per day — so that number is reserved first and the reviews
       fill what is left. Computing it as "whatever the reviews did not want"
       capped the rate at two a day once the due pile passed the session size,
       which showed a daily student 849 of 4,441 cards by May and never dealt
       one card from seven Chemistry units. */
    /* …but a budget nobody can pay is not a plan. Two brakes on that reserve:
       an explicitly sized deal keeps the SESSION'S proportion rather than
       spending itself entirely on new cards — "Quick ten" with 261 overdue
       dealt ten cards nobody had ever seen and moved the due count by zero —
       and once the pile is three sessions deep the reserve yields so reviews
       take at least half of every deal. Neither brake touches a student who
       is keeping up. */
    var want = (opts && opts.noNew) ? 0
      : (opts && opts.limit)
        ? Math.round(limit * (set.newPerSession || 0) / Math.max(1, set.sessionSize || 30))
        : set.newPerSession;
    var newCap = due.length > (set.sessionSize || 30) * 3
      ? Math.min(want, Math.floor(limit / 2))
      : want;
    var byScore = function (a, b) { return b._sc - a._sc; };
    S.shuffle(due); S.shuffle(fresh);          // ties break fresh every day
    due.sort(byScore); fresh.sort(byScore);
    var wantNew = Math.min(newCap, fresh.length, limit);
    var takeDue = due.slice(0, Math.max(0, limit - wantNew));
    // reviews came up short — the room they left goes back to new cards, and
    // the new cards are taken deck by deck in rotation, so a first session
    // touches every course instead of twenty cards of the heaviest unit
    // …and when the reviews come up short the room goes back to new cards. A
    // full session stops at the reserve, so with nothing due it deals exactly
    // the new-card number and Settings' "with nothing due, a session is 20"
    // stays true; an explicitly sized deal is a request for that many cards,
    // so "Quick ten" is ten whether or not anything is owed.
    var topCap = (opts && opts.limit) ? limit : newCap;
    var picked = takeDue.concat(roundRobin(fresh,
      Math.max(0, Math.min(topCap, limit - takeDue.length))));
    if (decks.length > 1 && picked.length) {
      var cap = Math.ceil(limit * 0.4), per = {}, kept = [], spill = [];
      picked.forEach(function (c) {
        per[c.deck] = (per[c.deck] || 0) + 1;
        (per[c.deck] <= cap ? kept : spill).push(c);
      });
      picked = interleave(kept.concat(spill).slice(0, limit));
    } else {
      picked = S.shuffle(picked);
    }
    return picked;
  }

  /* ---------------- theme ------------------------------------------------ */
  function applyTheme() {
    // the theme is always the system's — one fewer thing to set. The store's
    // `theme` field and the CSS [data-theme] ladders stay for the viewer that
    // pins a theme around us; nothing in here ever writes one.
    document.documentElement.removeAttribute('data-theme');
    // the status-bar colour comes from the two media-scoped <meta> tags in
    // index.html, which are right before first paint; rewriting them from
    // here flashed the wrong colour on every cold start
  }

  /* ==========================================================================
     VIEW · Decks
     ========================================================================== */
  function viewDecks() {
    var ix = S.getIndex();
    var due = 0, seen = 0;
    var rows = ix.courses.map(function (c) {
      var d = S.getDeck(c.id);
      var st = d ? S.deckStats(d) : { due: 0, known: 0, total: c.count, pct: 0, fresh: c.count };
      due += st.due; seen += st.seen || 0;
      // one meaning per column: every row shows its total; a due count is a
      // second line on the rows where it is true (skill §4.1), and a course
      // that carries a book counts its pages read on the same line
      var bits = [];
      if (st.due) bits.push('due · ' + plural(c.count, 'card'));
      else if (S.retired(c.id)) bits.push('Exam over');
      var bk = d && bookOf(c.id);
      if (bk && bk.order.length) {
        var dn = bookDone(), rd = bk.order.filter(function (id) { return dn[id]; }).length;
        if (rd) bits.push(rd + ' of ' + bk.order.length + ' read');
      }
      return '<li><button class="ledger" data-go="#/d/' + c.id + '">' +
        '<span class="lname">' + esc(nice(c.id)) + '</span>' +
        '<span class="lval num">' + (st.due || c.count).toLocaleString() + '</span>' +
        (bits.length ? '<span class="lsub">' + esc(bits.join(' · ')) + '</span>' : '') +
        '</button></li>';
    }).join('');

    var nudge = backupNudge(seen);
    var nStarred = starredCards().length;

    // The hero is the fact, and when there is one obvious action it IS the tap.
    var hero = due ? plural(due, 'card') + ' due' : ix.total.toLocaleString() + ' cards';
    // Nothing is due on the first day, so the screen was five grey rows and no
    // way in — a student who had never seen the app had to guess. The deal
    // exists from the first minute; the screen offers it.
    var deal0 = due ? 0 : buildDaily().length;
    /* An evening's work left no trace on the screen you land on: the headline
       went from 261 to 229 and said nothing about the hundred cards that moved
       it. The line under it is the day's own count. */
    var todayN = S.studiedToday(), note0 = [];
    if (todayN) note0.push(plural(todayN, 'review') + ' today');
    if (S.streak() > 1) note0.push(S.streak().toLocaleString() + '-day streak');
    mount(
      '<div class="head">' +
        (due ? '<button class="hero-tap" data-go="#/review"><h1>' + esc(hero) + '</h1></button>'
             : '<h1>' + esc(hero) + '</h1>') +
        (note0.length ? '<div class="sub">' + esc(note0.join(' · ')) + '</div>'
          : !seen ? '<div class="sub">Pick a course, or start with twenty from all of them.</div>' : '') +
      '</div>' +
      resumeHTML() +
      (deal0 ? '<button class="act" data-go="#/review">Start · ' + plural(deal0, 'card') + '</button>' : '') +
      '<ul class="list tight">' + rows + '</ul>' +
      // these three are navigation, not modes: as a stack of 26px words they
      // pushed themselves 92px below the fold, under the tab bar, where the
      // first tap on "Starred" landed on the Search tab instead
      '<div class="modes nav mt5">' +
        '<button class="textbtn" data-go="#/ten">Quick ten</button>' +
        '<button class="textbtn" data-go="#/games">Games</button>' +
        // starring a card in a session used to be a one-way trip: the star was
        // only reachable from the deck it belonged to, and never as a list.
        // The word is here before the first star, or there is nowhere for one
        // to go and no way to find out what the star is for.
        '<button class="textbtn" data-go="#/starred">Starred' +
          (nStarred ? ' · ' + nStarred.toLocaleString() : '') + '</button>' +
        '<button class="textbtn" data-go="#/how">How it works</button>' +
      '</div>' + nudge
    );
  }

  /* A mode is a word and, under it, the one line that says what it deals.
     "High-yield" and "Trouble spots" were guesses until you tapped them; the
     line is the deal, in the same words the session will keep. */
  var MODE_DESC = {
    core: 'The high-yield cards only, the ones most likely on the exam',
    quiz: 'The same deal as four choices, marked for you',
    starred: 'The cards you starred, shuffled',
    due: 'Only what is due, nothing new',
    hard: 'Cards missed twice, or missed the last time',
    all: 'A session\'s worth, shuffled from the whole course',
    mix: 'Every unit, in proportion to its weight on the exam',
    games: 'Rounds built from this course',
    plan: 'The units week by week to the exam, from what is left',
    cram: 'Every card in the unit, one pass, nothing rescheduled',
    focus: 'One point at a time: the subjonctif, the passé composé, the pronouns',
    justify: 'Every explain-why in the unit: the chain, the argument, what loses the point',
    score: 'One answer at a time: decide whether it earns the point, then see why',
    skills: 'One exam skill at a time, with cards from every unit',
    frq: 'Long and short questions in the exam\'s own format, model answers by point',
    print: 'Questions and answers on paper, two columns'
  };
  function modeBtn(go, label, desc) {
    return '<button class="textbtn mode" data-go="' + go + '"><span class="mlab">' + esc(label) + '</span>' +
      (desc ? '<span class="mdesc">' + esc(desc) + '</span>' : '') + '</button>';
  }
  /* what the big button will deal, counted: "12 due · 8 new" says why the
     number is 20 today and 31 tomorrow */
  function dealLine(queue) {
    if (!queue || !queue.length) return '';
    var fresh = queue.filter(function (c) { return S.isNew(c.i); }).length, due = queue.length - fresh;
    var bits = [];
    if (due) bits.push(due.toLocaleString() + ' due');
    if (fresh) bits.push(fresh.toLocaleString() + ' new');
    return '<div class="actsub">' + esc(bits.join(' · ')) + (due && fresh ? ', due first' : '') + '</div>';
  }
  /* a course whose grammar is spread over units can name its points — the
     subjonctif, the pronouns — each drawn by topic from whichever units hold
     it. "g:subj" in a cram route is one of them. */
  function focusPoints(d) { return (d && d.focus) || []; }
  function focusOf(d, id) {
    if (!id || id.indexOf('g:') !== 0) return null;
    return focusPoints(d).filter(function (f) { return f.id === id.slice(2); })[0] || null;
  }
  function focusCards(d, f) {
    return d.cards.filter(function (c) { return f.topics.indexOf(c.t || '') > -1; });
  }
  /* the CED frame a unit carries, when it does: its topics in order, each
     with a title and a suggested skill, the exclusion statements, the
     progress-check format and the free-response set */
  function topicOf(u, code) {
    var ts = (u && u.topics) || [];
    for (var i = 0; i < ts.length; i++) if (ts[i].c === code) return ts[i];
    return null;
  }
  function topicTitle(u, code) {
    var t = topicOf(u, code);
    if (t) return [cedCode(t.c), t.t, cedCode(t.c) ? skillWord(t.s) : ''].filter(Boolean).join(' · ');
    return /^\d+\.\d+$/.test(code || '') ? 'CED ' + code : (code || 'Other');
  }
  /* a topic's own code is worth showing when it is the CED's (3.4, RHS-1.A);
     a French context's slug is not */
  function cedCode(c) { return /^\d+\.\d+$|^[A-Z]{3}-\d/.test(c || '') ? 'CED ' + c : ''; }
  function skillWord(s) { return !s ? '' : /^\d\.[A-Z]$/.test(s) ? 'Skill ' + s : s; }
  function unitFrame(u) {
    var bits = [];
    if (u.topics && u.topics.length) bits.push(plural(u.topics.length, 'topic'));
    if (u.check) bits.push(u.check);
    return bits.join(' · ');
  }
  function frqLine(u) {
    var n = { long: 0, short: 0 }, other = 0;
    (u.frq || []).forEach(function (f) { if (n[f.kind] != null) n[f.kind]++; else other++; });
    var bits = [];
    if (n.long) bits.push(n.long + ' long');
    if (n.short) bits.push(n.short + ' short');
    if (other) bits.push(plural(other, 'question'));
    return bits.join(', ') + ' · ' + MODE_DESC.frq;
  }

  /* ==========================================================================
     VIEW · one course
     ========================================================================== */
  function viewCourse(deckId) {
    var d = S.getDeck(deckId);
    // a deck the index does not list is not ours — bounce. A deck the index
    // DOES list but that failed to load is a different thing, and bouncing
    // silently back to the deck list made it look like a dead row.
    var listed = S.getIndex().courses.some(function (c) { return c.id === deckId; });
    if (!d && !listed) return go('#/');
    // …and one still on its way is neither: it says so and repaints on arrival
    if (!d && S.deckPending && S.deckPending(deckId)) return mount(
      '<div class="head"><h1>' + esc(nice(deckId)) + '</h1>' + RING + '</div>');
    if (!d) return mount(
      '<div class="head"><h1>' + esc(nice(deckId) + ' did not download') + '</h1>' +
      '<div class="sub">Open it once with a connection.</div></div>' +
      '<button class="act" onclick="location.reload()">Try again</button>' +
      '<button class="textbtn" data-back>Courses</button>');
    curDeckId = lastDeckId = deckId;
    var st = S.deckStats(d);
    // units in course order, each under a small muted label — never a header (skill §4.2)
    // once anything in the deck is studied the column flips to mastery, all
    // rows at once — never a % beside a count in the same column
    var anySeen = st.seen > 0;
    // a course that carries a book counts its pages read beside its cards
    var bk = bookOf(deckId), done = bk ? bookDone() : {};
    var over = S.retired(deckId);
    var examPast = !!examDayNum(deckId) && examDayNum(deckId) < S.dayNum();
    var tables = d.units.filter(function (u) { return u.table; });
    var units = d.units.map(function (u) {
      var us = S.unitStats(d, u.id);
      if (!us.total) return '';
      var bits = [];
      var wt = weightText(u);
      if (wt) bits.push(wt);
      if (bk && bk.byUnit[u.id]) {
        var lt = 0, ld = 0;
        bk.byUnit[u.id].forEach(function (ph) { ph.items.forEach(function (it) { lt++; if (done[it.id]) ld++; }); });
        if (lt) bits.push(ld + ' of ' + lt + ' read');
      }
      // the column flips to mastery once anything is studied, and the count
      // used to vanish with it — "0%" beside nothing is not progress
      if (anySeen) bits.push(us.seen ? us.seen.toLocaleString() + ' of ' + us.total.toLocaleString() + ' seen'
                                     : 'not started · ' + us.total.toLocaleString() + ' cards');
      if (us.due) bits.push(us.due.toLocaleString() + ' due');
      return '<li>' +
        '<div class="ulabel">' + (u.table ? 'Table' : 'Unit ' + u.n) + '</div>' +
        '<button class="ledger mid' + (us.pct >= 0.9 ? ' done' : '') + '" data-go="#/d/' + deckId + '/u/' + u.id + '">' +
        '<span class="lname">' + esc(u.title) + '</span>' +
        '<span class="lval num">' + (anySeen ? pct(us.pct) : us.total.toLocaleString()) + '</span>' +
        (bits.length ? '<span class="lsub">' + esc(bits.join(' · ')) + '</span>' : '') +
        // what the unit holds, in a line, so the title is not the only clue
        (u.blurb ? '<span class="lsub ublurb">' + esc(u.blurb) + '</span>' : '') +
        '</button></li>';
    }).join('');

    // the app knows when the exam is — the countdown sits over the course name
    var pl = paceLine(d);
    var cl = (over || examPast) ? '' : coverLine(deckId);
    var deal = over ? [] : buildDaily({ deck: d }), dealNow = deal.length;
    // the tables: each on its own, or both in one deal — every card, the
    // least-known first, the way a cram deals
    var tableBlock = '';
    if (tables.length) {
      var tAll = 0;
      tableBlock = '<div class="ulabel mt4">Tables</div><div class="modes">' +
        tables.map(function (u) {
          var n = S.unitStats(d, u.id).total; tAll += n;
          return modeBtn('#/cram/' + deckId + '/' + u.id, u.title + ' · ' + n, u.blurb || 'Every card, the least-known first.');
        }).join('') +
        (tables.length > 1
          ? modeBtn('#/cram/' + deckId + '/' + tables.map(function (u) { return u.id; }).join('+'),
              'Both · ' + tAll, 'The tables together, shuffled into one deal, the least-known first.')
          : '') +
        '</div>';
    }
    // a course that carries its book has pages before its first unit: the
    // rules, the project laid out file by file, how to study
    var about = aboutPages(d).map(function (a) {
      return '<li><button class="ledger mid" data-go="#/d/' + deckId + '/a/' + esc(a.id) + '">' +
        '<span class="lname">' + esc(a.title) + '</span></button></li>';
    }).join('');
    if (bk && Object.keys(bk.terms).length) {
      about += '<li><button class="ledger mid" data-go="#/d/' + deckId + '/w">' +
        '<span class="lname">Every word, explained</span><span class="lval num">' + Object.keys(bk.terms).length + '</span></button></li>';
    }
    // where you are in the book, and the next page one tap away: the course
    // page listed eight units and left "which one am I on" to memory
    var where = '';
    if (bk && bk.order.length) {
      var read = bk.order.filter(function (id) { return done[id]; }).length, nextId = null;
      for (var oi = 0; oi < bk.order.length; oi++) if (!done[bk.order[oi]]) { nextId = bk.order[oi]; break; }
      var nx = nextId && bk.items[nextId];
      var ck = bookChecks(), nCk = 0, dCk = 0;
      bk.phaseList.forEach(function (ph) {
        (ph.after || []).forEach(function (s) {
          if (s.k !== 'done-when') return;
          (s.b || []).forEach(function (b) { if (b.t === 'ul' || b.t === 'ol') b.items.forEach(function (x, i) { nCk++; }); });
        });
        var i2 = 0;
        (ph.after || []).forEach(function (s) {
          if (s.k !== 'done-when') return;
          (s.b || []).forEach(function (b) { if (b.t === 'ul' || b.t === 'ol') b.items.forEach(function () { if (ck['p' + ph.n + '-' + i2]) dCk++; i2++; }); });
        });
      });
      var ckWord = nCk ? ' · ' + dCk + ' of ' + nCk + ' checks' : '';
      where = '<div class="ulabel mt4">Reading</div>' +
        (nx ? '<button class="act" data-go="#/d/' + deckId + '/l/' + nx.id + '">' + (read ? 'Continue' : 'Start reading') + '</button>' +
              '<div class="actsub">' + esc('Phase ' + nx.pn + ' · ' + lessonWord(nx) + ' · ') + mdT(nx.title) +
              (read ? esc(' · ' + read + ' of ' + bk.order.length + ' read') : '') + esc(dCk ? ckWord : '') + '</div>'
            : '<div class="actsub">All ' + plural(bk.order.length, 'lesson') + ' read' + esc(ckWord) + '</div>');
    }

    // the name is the way back; the number is a fact, not a hidden link
    // the line over the name: the countdown while the exam is ahead; once it
    // has passed, the way to stop the pile — and once stopped, what is paused
    var topLine = over
      ? '<div class="ulabel mt0">' + esc('Exam over' + (st.paused ? ' · ' + plural(st.paused, 'card') + ' paused' : '')) + '</div>'
      : examPast
      ? '<div class="ulabel mt0">' + esc('Exam was ' + examName(deckId) + ' · ') +
        '<button class="pace" data-deck-over="' + deckId + '">Clear what\'s due</button></div>'
      : (pl ? '<div class="ulabel mt0">' + esc(pl) + '</div>' : '');
    mount(
      '<div class="dhero">' +
        '<h1 class="dnh"><button class="dn" data-back>' + esc(nice(d)) + '</button></h1>' +
        '<span class="dv num">' + st.total.toLocaleString() + '</span>' +
      '</div>' +
      topLine +
      cl +
      resumeHTML() +
      (d.blurb ? '<div class="dblurb">' + esc(d.blurb) + '</div>' : '') +
      (over
        // the pile is paused; the one action is to take the pause off
        ? '<button class="act" data-deck-resume="' + deckId + '">Resume the schedule</button>' +
          '<div class="actsub">' + esc(st.paused ? plural(st.paused, 'card') + ' waiting, due as they were; nothing was lost.'
                                                 : 'Its cards come back due as they fall; nothing was lost.') + '</div>'
        // "Review 20" used to name the DUE count and then deal thirty, because
        // the deal is due cards plus the day's new ones. It names the deal.
        : '<button class="act" data-go="#/study/' + deckId + '/smart">' +
            (dealNow ? (st.due && dealNow === st.due ? 'Review ' : 'Study ') + dealNow.toLocaleString()
                     : 'Study') + '</button>' +
          dealLine(deal)) +
      '<div class="modes">' +
        modeBtn('#/study/' + deckId + '/core', 'High-yield', MODE_DESC.core) +
        modeBtn('#/quiz/' + deckId + '/smart', 'Quiz', MODE_DESC.quiz) +
        (scorePool(d, null, 1).length ? modeBtn('#/score/' + deckId, 'Score it', MODE_DESC.score) : '') +
        (d.skills && d.skills.length ? modeBtn('#/d/' + deckId + '/k', 'By skill', MODE_DESC.skills) : '') +
        (st.starred ? modeBtn('#/study/' + deckId + '/starred', 'Study starred', MODE_DESC.starred) : '') +
        (st.due > S.getSettings().sessionSize
          ? modeBtn('#/study/' + deckId + '/due', 'Catch up · ' + st.due.toLocaleString(), MODE_DESC.due) : '') +
        modeBtn('#/study/' + deckId + '/hard', 'Trouble spots', MODE_DESC.hard) +
        (mixUnits(d).length >= 3 ? modeBtn('#/study/' + deckId + '/mix', 'Exam mix', MODE_DESC.mix) : '') +
        modeBtn('#/study/' + deckId + '/all', 'Shuffle', MODE_DESC.all) +
        // the grammar by point, on a course that names its points
        (focusPoints(d).length ? modeBtn('#/d/' + deckId + '/g', 'Grammar', MODE_DESC.focus) : '') +
        (examDayNum(deckId) ? modeBtn('#/d/' + deckId + '/plan', 'Plan', MODE_DESC.plan) : '') +
        (window.Games && window.Games.linksFor(deckId).length
          ? modeBtn('#/games', 'Games', MODE_DESC.games) : '') +
      '</div>' +
      tableBlock +
      where +
      (about ? '<ul class="list mt4 gap0"><li><div class="ulabel">Before you start</div></li>' + about + '</ul>' : '') +
      '<ul class="list mt4 gap0">' + units + '</ul>' +
      // when the test is done the pile has to be stoppable from here, exam
      // date or none — a course with no date on file (the SAT) has one too
      (over ? '' : '<div class="data-list"><button class="textbtn quiet" data-deck-over="' + deckId + '">' +
        esc('Exam over' + (st.due ? ' · clear ' + plural(st.due, 'due card') : '')) + '</button></div>')
    );
  }

  /* ==========================================================================
     VIEW · the plan — the deck's units laid across the weeks to the exam,
     from what is still unseen, at the rate that gets there with days to spare
     for review. The pace line said "21 a day covers it"; this says which
     unit that means this week, and next.
     ========================================================================== */
  function planFor(d) {
    var exam = examDayNum(d.id), today = S.dayNum();
    if (!exam) return null;
    var days = exam - today;
    if (days <= 0) return { over: true };
    var units = d.units.map(function (u) {
      var us = S.unitStats(d, u.id);
      return { u: u, total: us.total, left: Math.max(0, us.total - us.seen) };
    }).filter(function (x) { return x.total; });
    var left = units.reduce(function (n, x) { return n + x.left; }, 0);
    // a review buffer before the exam: two weeks when there is room, a
    // seventh of the time when there is not
    var buffer = days > 28 ? 14 : Math.floor(days / 7);
    var studyDays = Math.max(1, days - buffer);
    var perDay = Math.ceil(left / studyDays);
    var weeks = [], cursor = 0, carried = 0;
    for (var w = 0; w * 7 < studyDays && cursor < units.length && left; w++) {
      var cap = perDay * Math.min(7, studyDays - w * 7), got = 0, items = [];
      while (cursor < units.length && got < cap) {
        var x = units[cursor], take = Math.min(x.left - carried, cap - got);
        if (x.left === 0) { cursor++; continue; }
        items.push({ u: x.u, n: take, cont: carried > 0, whole: take === x.left });
        got += take; carried += take;
        if (carried >= x.left) { cursor++; carried = 0; } else break;
      }
      weeks.push({ start: today + w * 7, items: items, n: got });
    }
    return { days: days, left: left, buffer: buffer, perDay: perDay, weeks: weeks, exam: exam };
  }
  function viewPlan(deckId) {
    var d = S.getDeck(deckId);
    if (!d) return go('#/');
    var plan = planFor(d);
    if (!plan) return go('#/d/' + deckId);
    curDeckId = lastDeckId = deckId;
    var set = S.getSettings();
    var head = '<div class="ulabel mt0">' + esc(nice(d) + ' · Exam ' + examName(deckId) + (plan.over ? '' : ' · in ' + plural(plan.days, 'day'))) + '</div>' +
      '<div class="dhero"><h1 class="dnh"><button class="dn" data-back>Plan</button></h1>' +
      '<span class="dv num">' + (plan.over || !plan.left ? '' : plan.left.toLocaleString()) + '</span></div>';
    if (plan.over) return mount(head + '<div class="sub">The exam has passed. Review what is due, and the course is still here.</div>');
    if (!plan.left) return mount(head +
      '<div class="how"><p>Every card has been seen. The ' + plural(plan.days, 'day') + ' left ' + (plan.days === 1 ? 'is' : 'are') + ' for what is due, Trouble spots and High-yield.</p></div>' +
      '<div class="modes">' + modeBtn('#/study/' + deckId + '/smart', 'Study', 'What is due today') + modeBtn('#/study/' + deckId + '/hard', 'Trouble spots', MODE_DESC.hard) + '</div>');
    var rate = plan.perDay, mine = set.newPerSession;
    var rateLine = rate + ' new a day sees every card ' + plural(plan.buffer, 'day') + ' before the exam';
    var setLine = mine >= rate
      ? 'Your setting is ' + mine + ' new a session, which is enough.'
      : 'Your setting is ' + mine + ' new a session. <button class="pace" data-pace="' + rate + '">Set it to ' + rate + '</button>';
    var rows = plan.weeks.map(function (w, i) {
      var name = i === 0 ? 'This week' : i === 1 ? 'Next week' : 'Week of ' + dateWord(w.start);
      var parts = w.items.map(function (it) {
        return 'Unit ' + it.u.n + ' · ' + T.plain(it.u.title) + (it.cont ? ' · continued' : (it.whole ? '' : ' · the first ' + it.n));
      });
      return '<li><button class="ledger mid' + (i === 0 ? ' now' : '') + '" data-go="#/d/' + deckId + '/u/' + w.items[0].u.id + '">' +
        '<span class="lname">' + esc(name) + '</span><span class="lval num">' + w.n.toLocaleString() + '</span>' +
        '<span class="lsub">' + esc(parts.join(' · ')) + '</span></button></li>';
    }).join('');
    mount(head +
      '<div class="how" style="margin-bottom:var(--s-3)"><p>' + esc(plan.left.toLocaleString() + ' cards not yet seen. ' + rateLine + '. ') + setLine + '</p></div>' +
      '<ul class="list" style="gap:0">' + rows +
      '<li><div class="ledger mid"><span class="lname">Last ' + plural(plan.buffer, 'day') + '</span><span class="lval num"></span>' +
      '<span class="lsub">Nothing new. What is due each day, then Trouble spots, then High-yield.</span></div></li></ul>');
  }

  /* ==========================================================================
     VIEW · the grammar by point — the subjonctif on its own, drawn from
     whichever units hold it. A row deals every card on the point, the
     least-known first, the way a cram does.
     ========================================================================== */
  function viewFocus(deckId) {
    var d = S.getDeck(deckId);
    if (!d || !focusPoints(d).length) return go('#/d/' + deckId);
    curDeckId = lastDeckId = deckId;
    var rows = focusPoints(d).map(function (f) { return { f: f, st: S.deckStats({ cards: focusCards(d, f) }, deckId) }; });
    var all = 0, anySeen = false;
    rows.forEach(function (r) { all += r.st.total; if (r.st.seen) anySeen = true; });
    var list = rows.map(function (r) {
      var st = r.st, bits = [];
      if (!st.total) return '';
      // the column flips to mastery once anything here is studied, all rows
      // at once, the way the course page does
      if (anySeen) bits.push(st.seen ? st.seen.toLocaleString() + ' of ' + st.total.toLocaleString() + ' seen'
                                     : 'not started · ' + plural(st.total, 'card'));
      if (st.due) bits.push(st.due.toLocaleString() + ' due');
      return '<li><button class="ledger mid' + (st.pct >= 0.9 ? ' done' : '') +
        '" data-go="#/cram/' + deckId + '/g:' + esc(r.f.id) + '">' +
        '<span class="lname">' + esc(r.f.title) + '</span>' +
        '<span class="lval num">' + (anySeen ? pct(st.pct) : st.total.toLocaleString()) + '</span>' +
        (bits.length ? '<span class="lsub">' + esc(bits.join(' · ')) + '</span>' : '') +
        (r.f.blurb ? '<span class="lsub ublurb">' + esc(r.f.blurb) + '</span>' : '') +
        '</button></li>';
    }).join('');
    mount(
      '<div class="ulabel mt0">' + esc(nice(d)) + ' · Grammar</div>' +
      '<div class="dhero"><h1 class="dnh"><button class="dn" data-back>Points de grammaire</button></h1>' +
        '<span class="dv num">' + all.toLocaleString() + '</span></div>' +
      '<div class="dblurb">One point at a time, from whichever units hold it. A point deals every card on it, the least-known first, and nothing the schedule owns moves.</div>' +
      resumeHTML() +
      '<ul class="list mt4 gap0">' + list + '</ul>'
    );
  }

  /* ==========================================================================
     VIEW · one unit
     ========================================================================== */
  /* VIEW · a unit's free-response set: the exam's own format, each part's
     model answer a tap away, point splits marked as estimates. Essays are
     laid out by rubric row instead of by part. */
  /* ==========================================================================
     FREE-RESPONSE PRACTICE — one question at a time, the way the exam asks
     it: write each part first, then check it against the model answer and
     score yourself part by part, as a reader would. The best score stays on
     this device beside the question.
     ========================================================================== */
  var FRQ_BEST_KEY = 'apdecks.frqbest';
  var frqState = null;
  function frqBestAll() {
    try { var o = JSON.parse(localStorage.getItem(FRQ_BEST_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; }
    catch (e) { return {}; }
  }
  function frqBest(key) { return frqBestAll()[key] || null; }
  function frqSaveBest(key, got, of) {
    var all = frqBestAll(), was = all[key];
    if (was && was.got >= got) return false;
    all[key] = { got: got, of: of, day: S.dayNum() };
    try { localStorage.setItem(FRQ_BEST_KEY, JSON.stringify(all)); } catch (e) { return false; }
    return true;
  }
  /* the scoring units of a question: its parts, or — for an essay scored by
     rubric rows — its rows */
  function frqUnits(f) {
    var parts = (f.parts || []).filter(function (pt) { return pt && pt.q; });
    if (parts.length) return parts.map(function (pt) {
      return { label: pt.l ? '(' + pt.l + ')' : '', q: pt.q, p: +pt.p || 0, a: pt.a, n: pt.n };
    });
    return (f.rows || []).map(function (r) {
      return { label: r.r || '', q: '', p: +r.p || 0, earns: r.earns, loses: r.loses, row: true };
    });
  }
  function frqKindLabel(d, u, i) {
    var KIND = { long: 'Long', short: 'Short', saq: 'Short answer', dbq: 'Document-based', leq: 'Long essay',
                 synthesis: 'Synthesis', rhetorical: 'Rhetorical analysis', argument: 'Argument',
                 mc: 'Multiple choice', essay: 'Essay', presentation: 'Presentation', qa: 'Conversation' };
    var counts = {}, label = '';
    u.frq.forEach(function (f, n) {
      counts[f.kind] = (counts[f.kind] || 0) + 1;
      if (n === i) label = (KIND[f.kind] || f.kind || 'Question') + ' ' + counts[f.kind];
    });
    return label;
  }
  function viewFRQPractice(deckId, unitId, i) {
    var d = S.getDeck(deckId), u = d && d.unitById[unitId], f = u && u.frq && u.frq[i];
    if (!f) return goReplace('#/d/' + deckId + (u ? '/u/' + unitId + '/frq' : ''));
    var key = deckId + '/' + unitId + '/' + i;
    if (!frqState || frqState.key !== key) frqState = { key: key, ans: {}, essay: '', checked: false, got: {}, mc: {} };
    if (f.kind === 'mc') return viewMCPractice(d, u, f, i, key);
    var units = frqUnits(f), essay = !(f.parts || []).length;
    var of = units.reduce(function (s, x) { return s + x.p; }, 0);
    var scored = units.filter(function (x, n) { return frqState.got[n] != null; }).length;
    var got = units.reduce(function (s, x, n) { return s + (frqState.got[n] || 0); }, 0);
    var best = frqBest(key);
    var label = [frqKindLabel(d, u, i), of ? plural(of, 'point') : '', f.calc ? 'Calculator' : '']
      .filter(Boolean).join(' · ');

    var picker = function (n, p) {
      var out = '';
      for (var k = 0; k <= p; k++) {
        var on = frqState.got[n] === k;
        out += '<button class="ptbtn' + (on ? ' on' : '') + '" data-fq-pt="' + n + ':' + k + '" aria-pressed="' + on + '">' + k + '</button>';
      }
      return '<div class="ptrow" role="group" aria-label="Points you earned">' +
        '<span class="ptk">You earned</span>' + out + '<span class="ptk">of ' + p + '</span></div>';
    };
    var body = '';
    if (essay) {
      // an essay is written on paper; here the thesis and the plan are the practice
      body += '<div class="fpw"><div class="ulabel">Your thesis and plan</div>' +
        (frqState.checked
          ? '<div class="recallecho">' + (frqState.essay.trim() ? esc(frqState.essay.trim()) : 'Nothing written.') + '</div>'
          : '<textarea class="recallin" data-fq-essay rows="7" placeholder="Thesis, then the line of reasoning, then the evidence for each step">' +
            esc(frqState.essay) + '</textarea>') + '</div>';
    }
    units.forEach(function (x, n) {
      var head = '<div class="fpqw"><span class="fpl">' + esc(x.label) + '</span>' +
        (x.q ? '<span class="fpq' + (stacked(x.q) ? ' mathy' : '') + '">' + T.html(x.q) + '</span>' : '') +
        (x.p ? '<span class="fpp num">' + esc(plural(x.p, 'pt')) + '</span>' : '') + '</div>';
      if (x.row) {
        if (!frqState.checked) return;
        body += '<div class="fpw">' + head +
          (x.earns ? '<div class="sva">' + T.html(x.earns) + '</div>' : '') +
          (x.loses ? '<div class="svn">' + T.html(x.loses) + '</div>' : '') +
          (x.p ? picker(n, x.p) : '') + '</div>';
        return;
      }
      var mine = frqState.ans[n] || '';
      body += '<div class="fpw">' + head +
        (frqState.checked
          ? '<div class="recallecho">' + (mine.trim() ? esc(mine.trim()) : 'Nothing written.') + '</div>' +
            '<div class="jl">The model answer</div><div class="sva' + (stacked(x.a || '') ? ' mathy' : '') + '">' + T.html(x.a || '') + '</div>' +
            (x.n ? '<div class="svn">' + T.html(x.n) + '</div>' : '') + (x.p ? picker(n, x.p) : '')
          : '<textarea class="recallin fpin" data-fq-ans="' + n + '" rows="4" placeholder="Your answer">' + esc(mine) + '</textarea>') +
        '</div>';
    });
    // parts and rubric rows together (a DBQ's model plan): the parts are
    // scored, and the rows are the reference a reader scores them against
    if (frqState.checked && !essay && (f.rows || []).length) {
      body += '<div class="fpw"><div class="ulabel">The rubric</div>' + (f.rows || []).map(function (r) {
        return '<div class="fprow"><div class="fpqw"><span class="fpq">' + esc(r.r || '') + '</span>' +
          (r.p != null ? '<span class="fpp num">' + esc(plural(+r.p, 'pt')) + '</span>' : '') + '</div>' +
          (r.earns ? '<div class="sva">' + T.html(r.earns) + '</div>' : '') +
          (r.loses ? '<div class="svn">' + T.html(r.loses) + '</div>' : '') + '</div>';
      }).join('') + '</div>';
    }
    var foot;
    if (!frqState.checked) {
      foot = '<button class="act" data-fq-check>Check against the model</button>' +
        '<div class="actsub">' + (best ? 'Your best: ' + best.got + ' of ' + best.of : 'Write first, then score each part as a reader would') + '</div>';
    } else {
      var all = units.filter(function (x) { return x.p; }).length;
      foot = '<div class="fqtotal"><span class="k">' + (scored < all ? 'Scored so far' : 'Your score') + '</span>' +
        '<span class="v num">' + got + ' of ' + of + '</span></div>' +
        (scored >= all && frqState.saved ? '<div class="actsub">' + esc(frqState.saved) + '</div>' : '') +
        '<button class="textbtn" data-fq-again>Try it again</button>';
    }
    var keepScroll = !!frqState.keepScroll; frqState.keepScroll = false;
    mount(
      backbar('Free response') +
      '<div class="head"><span class="k">' + esc(label) + '</span><h1 class="uhead">' + esc(f.title || u.title) + '</h1></div>' +
      (f.stem ? '<div class="fstem">' + T.html(f.stem) + '</div>' : '') +
      '<div class="fqwork">' + body + '</div>' + foot,
      keepScroll ? { keepScroll: true } : undefined
    );
    [].forEach.call(document.querySelectorAll('[data-fq-ans]'), function (ta) {
      ta.addEventListener('input', function () { frqState.ans[ta.getAttribute('data-fq-ans')] = ta.value; });
    });
    var es = document.querySelector('[data-fq-essay]');
    if (es) es.addEventListener('input', function () { frqState.essay = es.value; });
  }

  /* A multiple-choice set is answered the way the exam asks it: pick one
     letter, and the set says at once whether it was right, why, and what
     trap the other choices set. The score is kept like a free response's. */
  function mcParse(pt) {
    // "(A) text" in English sets, "A. text" in French ones; a letter counts
    // only as the next in order, so a question that opens "A." stays a question
    var lines = String(pt.q || '').split('\n'), stem = [], choices = [];
    lines.forEach(function (l) {
      var m = l.match(/^\(([A-E])\)\s+(.*)$/) || l.match(/^([A-E])[.)]\s+(.*)$/);
      if (m && m[1] === 'ABCDE'.charAt(choices.length)) choices.push({ L: m[1], t: m[2] });
      else if (choices.length) choices[choices.length - 1].t += ' ' + l;
      else stem.push(l);
    });
    var am = String(pt.a || '').match(/^\(([A-E])\)\.?\s*/) || String(pt.a || '').match(/^([A-E])[.)]\s+/);
    return { q: stem.join('\n').trim(), choices: choices, right: am ? am[1] : '', why: am ? String(pt.a).slice(am[0].length) : pt.a };
  }
  function viewMCPractice(d, u, f, i, key) {
    var qs = (f.parts || []).map(mcParse), picks = frqState.mc;
    var answered = qs.filter(function (q, n) { return picks[n]; }).length;
    var got = qs.filter(function (q, n) { return picks[n] && picks[n] === q.right; }).length;
    var best = frqBest(key);
    var label = [frqKindLabel(d, u, i) || 'Multiple choice', plural(qs.length, 'question'), f.calc ? 'Calculator' : '']
      .filter(Boolean).join(' · ');
    var keepScroll = !!frqState.keepScroll; frqState.keepScroll = false;
    mount(
      backbar('Free response') +
      '<div class="head"><span class="k">' + esc(label) + '</span><h1 class="uhead">' + esc(f.title || u.title) + '</h1></div>' +
      (f.stem ? '<div class="fstem">' + T.html(f.stem) + '</div>' : '') +
      '<div class="fqwork">' + qs.map(function (q, n) {
        var pick = picks[n];
        return '<div class="fpw mcq"><div class="fpqw"><span class="fpl">' + (n + 1) + '</span>' +
          '<span class="fpq' + (stacked(q.q) ? ' mathy' : '') + '">' + T.html(q.q) + '</span></div>' +
          '<div class="choices">' + q.choices.map(function (ch) {
            var state = pick ? (ch.L === q.right ? 'right' : ch.L === pick ? 'wrong' : 'mute') : '';
            return '<button class="choice' + (stacked(ch.t) ? ' mathy' : '') + (T.plain(ch.t).length > 110 ? ' small' : '') + '" data-mcp="' + n + ':' + ch.L + '" data-letter="' + ch.L + '"' +
              (state ? ' data-state="' + state + '"' : '') + (pick ? ' disabled' : '') + '>' + T.html(ch.t) + '</button>';
          }).join('') + '</div>' +
          (pick ? '<div class="scv"><p class="sv">' + (pick === q.right ? 'Right.' : 'Not quite: ' + esc(q.right) + '.') + '</p>' +
            '<div class="sva' + (stacked(q.why) ? ' mathy' : '') + '">' + T.html(q.why || '') + '</div>' +
            (f.parts[n].n ? '<div class="svn">' + T.html(f.parts[n].n) + '</div>' : '') + '</div>' : '') +
          '</div>';
      }).join('') + '</div>' +
      (answered
        ? '<div class="fqtotal"><span class="k">' + (answered < qs.length ? 'So far' : 'Your score') + '</span>' +
          '<span class="v num">' + got + ' of ' + (answered < qs.length ? answered : qs.length) + '</span></div>' +
          (answered >= qs.length && frqState.saved ? '<div class="actsub">' + esc(frqState.saved) + '</div>' : '') +
          (answered >= qs.length ? '<button class="textbtn" data-fq-again>Try it again</button>' : '')
        : '<div class="actsub">' + (best ? 'Your best: ' + best.got + ' of ' + best.of : 'Pick one letter for each question; each is marked as you go') + '</div>'),
      keepScroll ? { keepScroll: true } : undefined
    );
  }

  function frqClick(t) {
    if (!frqState) return false;
    if (t.closest('[data-fq-check]')) {
      [].forEach.call(document.querySelectorAll('[data-fq-ans]'), function (ta) { frqState.ans[ta.getAttribute('data-fq-ans')] = ta.value; });
      var es = document.querySelector('[data-fq-essay]'); if (es) frqState.essay = es.value;
      frqState.checked = true; route(); return true;
    }
    var pt = t.closest('[data-fq-pt]');
    if (pt) {
      var v = pt.getAttribute('data-fq-pt').split(':');
      frqState.got[v[0]] = parseInt(v[1], 10);
      // every part scored: the total is the attempt, and a better one is kept
      var p = frqState.key.split('/'), d = S.getDeck(p[0]), u = d && d.unitById[p[1]], f = u && u.frq[+p[2]];
      if (f) {
        var units = frqUnits(f), all = true, got = 0, of = 0;
        units.forEach(function (x, n) { if (!x.p) return; of += x.p; if (frqState.got[n] == null) all = false; else got += frqState.got[n]; });
        if (all) frqState.saved = frqSaveBest(frqState.key, got, of) ? 'Saved as your best on this device' : '';
      }
      frqState.keepScroll = true; route();
      var again = document.querySelector('[data-fq-pt="' + v[0] + ':' + v[1] + '"]');
      if (again) { try { again.focus({ preventScroll: true }); } catch (e) {} }
      return true;
    }
    var mp = t.closest('[data-mcp]');
    if (mp) {
      var v2 = mp.getAttribute('data-mcp').split(':');
      if (frqState.mc[v2[0]]) return true;
      frqState.mc[v2[0]] = v2[1];
      var pp = frqState.key.split('/'), dd = S.getDeck(pp[0]), uu = dd && dd.unitById[pp[1]], ff = uu && uu.frq[+pp[2]];
      if (ff) {
        var qs = (ff.parts || []).map(mcParse), all = qs.every(function (q, n) { return frqState.mc[n]; });
        if (all) {
          var g = qs.filter(function (q, n) { return frqState.mc[n] === q.right; }).length;
          frqState.saved = frqSaveBest(frqState.key, g, qs.length) ? 'Saved as your best on this device' : '';
        }
      }
      frqState.keepScroll = true; route();
      // the picked choice is disabled now; keyboard focus moves to the next open question
      var nx = document.querySelector('.fpw.mcq .choice:not([disabled])');
      if (nx) { try { nx.focus({ preventScroll: true }); } catch (e) {} }
      return true;
    }
    if (t.closest('[data-fq-again]')) { frqState = { key: frqState.key, ans: {}, essay: '', checked: false, got: {}, mc: {} }; route(); return true; }
    return false;
  }

  function viewFRQ(deckId, unitId) {
    var d = S.getDeck(deckId), u = d && d.unitById[unitId];
    if (!d || !u || !u.frq || !u.frq.length) return go('#/d/' + deckId + (u ? '/u/' + unitId : ''));
    var KIND = { long: 'Long', short: 'Short', saq: 'Short answer', dbq: 'Document-based', leq: 'Long essay',
                 synthesis: 'Synthesis', rhetorical: 'Rhetorical analysis', argument: 'Argument',
                 mc: 'Multiple choice', essay: 'Essay', presentation: 'Presentation', qa: 'Conversation' };
    var counts = {};
    var list = u.frq.map(function (f, i) {
      counts[f.kind] = (counts[f.kind] || 0) + 1;
      var kind = (KIND[f.kind] || f.kind || 'Question') + ' ' + counts[f.kind];
      var label = [kind, f.pts ? plural(f.pts, 'point') : '',
        f.b ? borrowWord(d, f.b) : ''].filter(Boolean).join(' · ');
      var parts = (f.parts || []).map(function (pt, n) {
        var id = 'fp-' + i + '-' + n;
        return '<li><button class="fpart" data-fp aria-expanded="false" aria-controls="' + id + '">' +
          '<span class="fpl">' + esc(pt.l ? '(' + pt.l + ')' : '') + '</span>' +
          '<span class="fpq">' + T.html(pt.q) + '</span>' +
          '<span class="fpp num">' + (pt.p != null ? esc(String(pt.p)) + ' pt' + (pt.p === 1 ? '' : 's') : '') + '</span></button>' +
          '<div class="fpa" id="' + id + '" hidden>' + T.html(pt.a) +
          (pt.n ? '<div class="fnote">' + T.html(pt.n) + '</div>' : '') + '</div></li>';
      }).join('');
      var rows = (f.rows || []).map(function (r) {
        return '<li class="frow"><div class="frn">' + esc(r.r) + (r.p != null ? ' · ' + esc(String(r.p)) + ' pt' + (r.p === 1 ? '' : 's') : '') + '</div>' +
          (r.earns ? '<div class="fre">' + T.html(r.earns) + '</div>' : '') +
          (r.loses ? '<div class="frl">' + T.html(r.loses) + '</div>' : '') + '</li>';
      }).join('');
      var best = frqBest(deckId + '/' + unitId + '/' + i);
      return '<section class="frq">' +
        '<div class="ulabel">' + esc(label) + '</div>' +
        '<h2 class="ftitle">' + esc(f.title || '') + '</h2>' +
        '<button class="textbtn fprac" data-go="#/d/' + deckId + '/u/' + unitId + '/frq/' + i + '">Practice it' +
          (best ? '<span class="fbest num"> · best ' + best.got + ' of ' + best.of + '</span>' : '') + '</button>' +
        (f.stem ? '<div class="fstem">' + T.html(f.stem) + '</div>' : '') +
        (parts ? '<ul class="fparts">' + parts + '</ul>' : '') +
        (rows ? '<ul class="fparts">' + rows + '</ul>' : '') +
        '</section>';
    }).join('');
    mount(
      '<div class="ulabel mt0">' + esc(nice(d)) + ' · Unit ' + u.n + ' · Free response</div>' +
      '<div class="dhero">' +
        '<h1 class="dnh"><button class="dn" data-back>' + esc(u.title) + '</button></h1>' +
        '<span class="dv num">' + u.frq.length + '</span>' +
      '</div>' +
      '<div class="dblurb">' + esc(frqLine(u).split(' · ')[0]) + ', in the exam\'s own format. Tap a part for its model answer, or practise one: write it, then score it. Point splits are estimates.</div>' +
      list
    );
  }

  function viewUnit(deckId, unitId) {
    var d = S.getDeck(deckId);
    if (!d || !d.unitById[unitId]) return go('#/d/' + deckId);
    curDeckId = lastDeckId = deckId;
    var u = d.unitById[unitId], us = S.unitStats(d, unitId);
    // a narrowed list is about THIS visit to THIS unit — carrying "Missed" to
    // the next unit, or back here tomorrow, shows a near-empty page that reads
    // like a deck that failed to load. Repaints of the same page keep it.
    if (unitFilterFor !== deckId + '/' + unitId) { unitFilter = 0; unitFilterFor = deckId + '/' + unitId; }
    var cards = d.cards.filter(function (c) { return c.u === unitId; });

    // unit-scoped games, same grammar as the other modes — text, no chrome;
    // nothing renders (and no space is held) when no game covers this unit
    var ugames = (window.Games && window.Games.forUnit)
      ? (window.Games.forUnit(deckId, unitId) || []) : [];
    var gameLinks = ugames.map(function (g) {
      return '<button class="textbtn" data-go="' + esc(g[1]) + '">' + esc(g[0]) + '</button>';
    }).join('');

    // The unit list was every card, always — 90 rows to scroll for the four
    // you keep missing. One cycling word, the same control search and the
    // games use, narrows it; the count beside it says how many that leaves.
    var shown = cards.filter(function (c) { return unitFilterKeep(c); });
    // Ninety rows in one run were a wall. When the unit's topics are real
    // groups (three cards or more to a topic, on average) the rows sit under
    // their topic, in the order the topics first appear; a unit whose every
    // card has its own topic stays a plain list.
    var topics = [], byTopic = {};
    shown.forEach(function (c) { var t = c.t || ''; if (!byTopic[t]) { byTopic[t] = []; topics.push(t); } byTopic[t].push(c); });
    var grouped = topics.length >= 2 && shown.length / topics.length >= 3;
    if (grouped) shown = topics.reduce(function (acc, t) { return acc.concat(byTopic[t]); }, []);
    var lastTopic = null;
    var list = shown.map(function (c, n) {
      var known = S.isKnown(c.i);
      var sep = '';
      if (grouped && c.t !== lastTopic) {
        lastTopic = c.t;
        var tl = topicTitle(u, c.t);
        var tk = byTopic[c.t].filter(function (x) { return S.isKnown(x.i); }).length, tn = byTopic[c.t].length;
        sep = '<li class="tsep"><div class="ulabel">' + esc(tl) + ' <span class="num">' +
          (tk ? tk.toLocaleString() + ' of ' + tn.toLocaleString() + ' known' : tn.toLocaleString()) + '</span>' +
          (recallCards(d, unitId, c.t || '').length >= 3
            ? '<button class="textbtn quiet tstudy" data-go="#/recall/' + deckId + '/' + unitId + '/' + encodeURIComponent(c.t || '') + '">Recall</button>' : '') +
          '<button class="textbtn quiet tstudy" data-go="#/study/' + deckId + '/t:' + encodeURIComponent(c.t || '') + '/' + unitId + '">Study</button></div></li>';
      }
      return sep + '<li><button class="qrow' + (known ? ' done' : '') + '" data-peek="' + c.i + '">' +
        '<span class="qq' + (known ? ' dim' : '') + '">' + T.html(c.q) + '</span>' +
        '<span class="qa" hidden>' + T.html(c.a) + '</span>' +
        (S.noteOf(c.i) ? '<span class="qn" hidden>' + esc(S.noteOf(c.i)) + '</span>' : '') +
        (verb(c.v) || topicLabel(c)
          ? '<span class="qmeta">' + esc([verb(c.v), topicLabel(c)].filter(Boolean).join(' · ')) + '</span>' : '') +
        '</button>' + rowActs(c) + '</li>';
    }).join('');

    mount(
      '<div class="ulabel mt0">' + esc(nice(d)) + ' · Unit ' + u.n +
        (weightText(u) ? ' · ' + esc(weightText(u)) : '') + '</div>' +
      '<div class="dhero">' +
        '<h1 class="dnh"><button class="dn" data-back>' + esc(u.title) + '</button></h1>' +
        '<span class="dv num">' + us.total.toLocaleString() + '</span>' +
      '</div>' +
      (u.blurb ? '<div class="dblurb">' + esc(u.blurb) + '</div>' : '') +
      // the unit as the CED frames it: how many topics, and what its progress check asks
      (unitFrame(u) ? '<div class="dblurb frame">' + esc(unitFrame(u)) + '</div>' : '') +
      '<button class="act" data-go="#/study/' + deckId + '/smart/' + unitId + '">' + (us.due ? 'Review ' + us.due.toLocaleString() : 'Study') + '</button>' +
      dealLine(buildDaily({ deck: d, unit: unitId })) +
      '<div class="modes">' +
        // a table has no high-yield subset: every row is the point
        (cards.some(function (c) { return c.c; })
          ? modeBtn('#/study/' + deckId + '/core/' + unitId, 'High-yield', MODE_DESC.core) : '') +
        modeBtn('#/quiz/' + deckId + '/smart/' + unitId, 'Quiz', MODE_DESC.quiz) +
        modeBtn('#/cram/' + deckId + '/' + unitId, 'Cram', MODE_DESC.cram) +
        // the unit's explain-whys on their own, dealt like Cram
        (cards.some(function (c) { return c.y === 'j'; })
          ? modeBtn('#/cram/' + deckId + '/' + unitId + '/j', 'Justify', MODE_DESC.justify) : '') +
        (scorePool(d, unitId, 1).length ? modeBtn('#/score/' + deckId + '/' + unitId, 'Score it', MODE_DESC.score) : '') +
        // the exam's own question format, with model answers by point
        (u.frq && u.frq.length
          ? modeBtn('#/d/' + deckId + '/u/' + unitId + '/frq', 'Free response', frqLine(u)) : '') +
        // the grammar by point, when this unit's topics feed one
        (focusPoints(d).some(function (f) { return cards.some(function (c) { return f.topics.indexOf(c.t || '') > -1; }); })
          ? modeBtn('#/d/' + deckId + '/g', 'Grammar', MODE_DESC.focus) : '') +
        // the print sheet has existed in the stylesheet for months with no way
        // in: two columns, questions and answers, no chrome
        '<button class="textbtn mode" data-print><span class="mlab">Print</span><span class="mdesc">' + MODE_DESC.print + '</span></button>' +
        gameLinks +
      '</div>' +
      // the unit in five to eight sentences, before its ninety cards: what a
      // teacher would say on the first day, drawn from the cards themselves
      (u.keys && u.keys.length
        ? '<div class="ulabel mt4">Key ideas</div><ol class="keys">' +
          u.keys.map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') + '</ol>'
        : '') +
      // what the CED says is not assessed — so it is not over-studied
      (u.excl && u.excl.length
        ? '<div class="ulabel mt4">Not on the exam</div><ul class="excl">' +
          u.excl.map(function (x) {
            return '<li>' + (x.c ? '<span class="ec">' + esc(x.c) + '</span> · ' : '') + esc(x.s) + '</li>';
          }).join('') + '</ul>'
        : '') +
      bookUnitHTML(deckId, unitId) +
      '<div class="scoperow unit"><button class="textbtn quiet" data-unit-filter>' +
        esc(UNIT_FILTERS[unitFilter][0]) + '</button>' +
        '<span class="scount num">' + shown.length.toLocaleString() + '</span></div>' +
      '<ul class="list tight" id="unitlist">' + list + '</ul>' +
      (shown.length ? '' :
        '<div class="empty">' + esc(UNIT_EMPTY[unitFilter]) + '</div>' +
        '<button class="textbtn" data-unit-all>Show all ' + cards.length.toLocaleString() + '</button>')
    );
  }

  /* the unit list's filter: a word, not a row of chips, and in memory only —
     a filter that outlives the screen is a filter you forget you set */
  var UNIT_FILTERS = [
    ['All cards', function () { return true; }],
    ['Not seen', function (c) { var st = S.cs(c.i); return !st || !(st.r || st.t || st.l); }],
    ['Due', function (c) { return S.isDue(c.i); }],
    ['Missed', function (c) { var st = S.cs(c.i); return !!(st && st.l); }],
    ['Starred', function (c) { return S.isStarred(c.i); }]
  ];
  // an empty list has to say WHICH filter emptied it, on a page whose own
  // header says 86 — "Nothing here yet" reads as a unit nobody wrote
  var UNIT_EMPTY = ['No cards in this unit', 'Every card here has been seen',
    'Nothing due in this unit', 'Nothing missed here yet', 'No starred cards in this unit'];
  var unitFilter = 0, unitFilterFor = '';
  function unitFilterKeep(c) { return UNIT_FILTERS[unitFilter][1](c); }

  /* ==========================================================================
     VIEW · the book — a deck may carry its course text (Six Ladders). The
     reader picks one level at a time on a ladder; every lesson explains
     itself at every rung, and every word it uses, before anything asks the
     reader to do something.
     ========================================================================== */
  var LVL_KEYS = ['k5', 'ms', 'hs', 'ug', 'gr', 'phd'];
  var LVL_NAMES = ['Age 5', 'Middle school', 'High school', 'Stanford undergrad', 'Stanford grad', 'PhD at Apple'];
  var LVL_SHORT = ['Kid', 'Middle', 'High', 'Undergrad', 'Grad', 'PhD'];
  // the six words need 318px of segmented control; a 280px phone has 232px, so
  // "Grad" and "PhD" were simply off the screen. Both sets ship and CSS picks.
  var LVL_TINY = ['Kid', 'MS', 'HS', 'UG', 'Grad', 'PhD'];
  var ladder = { lvl: 2, all: false };
  try {
    var lp = JSON.parse(localStorage.getItem('apdecks.v1.ladder') || 'null');
    if (lp && typeof lp.lvl === 'number' && lp.lvl >= 0 && lp.lvl < 6) ladder = { lvl: lp.lvl, all: !!lp.all };
  } catch (e) {}
  function saveLadder() { try { localStorage.setItem('apdecks.v1.ladder', JSON.stringify(ladder)); } catch (e) {} }
  /* A tick is a wish, not a measurement, and it has to survive a sync with a
     device that ticked something else: each entry carries the moment it was
     set (positive) or cleared (negative), the newer moment wins per lesson in
     the store's merge, and the map the pages read holds only the ticks that
     are on. A value of 1 from before the moments were kept still reads as on. */
  function bookDone() {
    var raw = S.getSettings().ladderDone || {}, out = {};
    for (var k in raw) if (raw[k] > 0) out[k] = 1;
    return out;
  }
  function setBookDone(id, on) {
    var d = {}, cur = S.getSettings().ladderDone || {};
    for (var k in cur) d[k] = cur[k];
    d[id] = on ? Date.now() : -Date.now();
    S.setSetting('ladderDone', d);
  }
  /* A phase's "Done when" is a list of things to have seen with your own
     eyes. Each line is a tick, kept and merged exactly like a lesson's. */
  function bookChecks() {
    var raw = S.getSettings().ladderChecks || {}, out = {};
    for (var k in raw) if (raw[k] > 0) out[k] = 1;
    return out;
  }
  function setBookCheck(key, on) {
    var d = {}, cur = S.getSettings().ladderChecks || {};
    for (var k in cur) d[k] = cur[k];
    d[key] = on ? Date.now() : -Date.now();
    S.setSetting('ladderChecks', d);
  }
  function checklistHTML(ph, s) {
    var on = bookChecks(), items = [], n = 0, dn = 0;
    (s.b || []).forEach(function (b) {
      if (b.t !== 'ul' && b.t !== 'ol') { items.push(bookBlocks([b])); return; }
      b.items.forEach(function (x) {
        var key = 'p' + ph.n + '-' + n, is = !!on[key]; n++; if (is) dn++;
        items.push('<li class="' + (is ? 'on' : '') + '"><button class="chk' + (is ? ' on' : '') + '" data-book-check="' + key + '" aria-pressed="' + is + '" aria-label="Done"><i></i></button>' +
          '<div class="ckt">' + md(x) + '</div></li>');
      });
    });
    return '<div class="row ckrow"><h3>' + esc(secLabel(s)) + (n ? ' <span class="ckcnt num">' + dn + ' of ' + n + '</span>' : '') + '</h3>' +
      '<p class="note">Tick each line once you have seen it happen. The ticks sync with your lesson ticks.</p>' +
      '<ul class="cklist">' + items.join('') + '</ul></div>';
  }

  function bookOf(deckId) {
    var d = S.getDeck(deckId);
    if (!d || !d.book) return null;
    if (!d._bk) {
      var bk = { items: {}, res: {}, resPhase: {}, phases: {}, byUnit: {}, order: [], terms: {}, phaseList: d.book.phases };
      d.book.phases.forEach(function (ph) {
        bk.phases[String(ph.n)] = ph;
        (bk.byUnit[ph.u] = bk.byUnit[ph.u] || []).push(ph);
        ph.items.forEach(function (it) { bk.items[it.id] = it; bk.order.push(it.id); });
        ph.resources.forEach(function (r) { bk.res[r.id] = r; bk.resPhase[r.id] = ph; });
      });
      (d.book.terms || []).forEach(function (t) { if (t.def || (t.levels && t.levels.length)) bk.terms[t.id] = t; });
      // where each word is first used, in reading order: a lesson "builds on"
      // the earlier lessons that introduced the words it leans on
      bk.termFirst = {};
      bk.order.forEach(function (id) {
        (bk.items[id].terms || []).forEach(function (tid) { if (!(tid in bk.termFirst)) bk.termFirst[tid] = id; });
      });
      d._bk = bk;
    }
    return d._bk;
  }

  /* ---- inline text: the little markdown the source uses, plus term marks --- */
  var termCtx = null;      // { bk, list:[term], seen:{} } while a page renders
  function termRx(t) {
    if (!t._rx) {
      var alts = t.names.map(function (n) {
        var e = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return n.length <= 3 ? e : e + '(?:s|es)?';
      });
      t._rx = new RegExp('(^|[^\\w.])(' + alts.join('|') + ')(?![\\w])', 'i');
      // AP is not "ap", WHERE is not "where": these aliases keep their own case
      t._exact = t.names.filter(function (n) { return n.length <= 3 || (n.toUpperCase() === n && /[A-Z]{2}/.test(n)); });
    }
    return t._rx;
  }
  /* Mark the first use of each term. One left-to-right pass per text run: a
     button already written is never rescanned, or its own markup becomes prey. */
  function markRun(text) {
    var out = '', rest = text;
    while (rest) {
      var best = null, bestAt = -1, bestWord = '';
      for (var j = 0; j < termCtx.list.length; j++) {
        var t = termCtx.list[j];
        if (termCtx.seen[t.id] || t.nomark) continue;
        var m = termRx(t).exec(rest);
        if (!m) continue;
        var word = m[2], at = m.index + m[1].length;
        var strict = t.names.filter(function (n) { return n.toLowerCase() === word.toLowerCase(); })
                            .some(function (n) { return t._exact.indexOf(n) > -1; });
        if (strict && t._exact.indexOf(word) < 0) continue;
        if (bestAt < 0 || at < bestAt) { best = t; bestAt = at; bestWord = word; }
      }
      if (!best) return out + rest;
      out += rest.slice(0, bestAt) + '<button class="tm" data-term="' + best.id + '">' + bestWord + '</button>';
      termCtx.seen[best.id] = true;
      rest = rest.slice(bestAt + bestWord.length);
    }
    return out;
  }
  function markTerms(html) {
    if (!termCtx || !termCtx.list.length) return html;
    var parts = html.split(/(<[^>]+>)/), depth = 0, out = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) continue;
      if (p.charAt(0) === '<') {
        if (/^<(code|a|button)\b/i.test(p)) depth++;
        else if (/^<\/(code|a|button)/i.test(p)) depth = Math.max(0, depth - 1);
        out += p; continue;
      }
      out += depth ? p : markRun(p);
    }
    return out;
  }
  function md(s) {
    var h = esc(String(s || ''));
    h = h.replace(/`([^`]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
    h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    h = h.replace(/\*\*([^*<>]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/(^|[\s(])_([^_<>]+)_(?=[\s.,;:)]|$)/g, '$1<em>$2</em>');
    return markTerms(h);
  }
  /* titles and rows: the same inline markup, but no term buttons inside a heading */
  function mdT(x) { var c = termCtx; termCtx = null; var h = md(x); termCtx = c; return h; }
  function bookBlocks(bs) {
    return (bs || []).map(function (b) {
      if (b.t === 'p') {
        if (b.lead === 'Try this') return '<p class="try"><b>Try this.</b> ' + md(b.s) + '</p>';
        if (b.lead) return '<p><b>' + esc(b.lead) + '.</b> ' + md(b.s) + '</p>';
        return '<p>' + md(b.s) + '</p>';
      }
      if (b.t === 'ul' || b.t === 'ol') return '<' + b.t + ' class="learn">' + b.items.map(function (x) { return '<li>' + md(x) + '</li>'; }).join('') + '</' + b.t + '>';
      if (b.t === 'code') return codeHTML(b.s);
      if (b.t === 'qa') return '<details><summary>' + md(b.q) + '</summary><div class="a">' + bookBlocks(b.a) + '</div></details>';
      if (b.t === 'h3' || b.t === 'h4') return '<div class="gk">' + md(b.s) + '</div>';
      if (b.t === 'meta') return '<p class="note">' + md(b.s) + '</p>';
      // a file's contract on a Build page: its path, what kind of file it is,
      // and everything the reader must put in it
      if (b.t === 'file') return '<div class="fb"><div class="fbh"><code class="fn">' + esc(b.name) + '</code>' +
        (b.tag ? '<span class="ft">' + esc(b.tag) + '</span>' : '') + '</div>' + bookBlocks(b.b) + '</div>';
      return '';
    }).join('');
  }
  var SECNAME = { goal: 'Goal', 'guided-walkthrough': 'Guided walkthrough', 'check-yourself': 'Check yourself',
    misconceptions: 'Misconceptions', 'what-it-covers': 'What it covers', 'key-ideas-in-order': 'Key ideas, in order',
    'formulas-and-commands-to-remember': 'Formulas and commands to remember', 'three-takeaways': 'Three takeaways', practice: 'Practice',
    'what-you-need-to-learn': 'What you need to learn', build: 'Build', 'done-when': 'Done when', pitfalls: 'Pitfalls' };
  function secLabel(s) { return s.k === 'level' ? s.name : s.k === 'step' ? 'Step ' + s.n : s.k === 'h3' ? (s.title || '') : (SECNAME[s.k] || ''); }
  function secs(obj, k) { return (obj.sections || []).filter(function (s) { return s.k === k; }); }
  function sec(obj, k) { return secs(obj, k)[0] || null; }

  /* the six rungs of one thing, only the chosen one showing unless "all" */
  function levelsHTML(obj) {
    var out = '';
    secs(obj, 'level').forEach(function (s) {
      var i = LVL_NAMES.indexOf(s.name); if (i < 0) return;
      out += '<article class="lvl ' + LVL_KEYS[i] + '" data-level="' + LVL_KEYS[i] + '"' + (ladder.all || i === ladder.lvl ? '' : ' hidden') + '>' +
        '<div class="sub">' + esc(s.name) + '</div>' + bookBlocks(s.b) + '</article>';
    });
    return out;
  }
  function segHTML() {
    return '<div class="segwrap">' +
      '<div class="lg lg-bar lg-seg" id="lvlseg" role="tablist">' + LVL_SHORT.map(function (n, i) {
        // both labels ship and CSS picks one; the reader on a screen reader gets
        // the full rung name once, not "UndergradUG"
        return '<div class="lg-seg-item' + (i === ladder.lvl ? ' is-active' : '') + '" role="tab"' +
          ' aria-label="' + esc(LVL_NAMES[i]) + '">' +
          '<span class="ln" aria-hidden="true">' + n + '</span>' +
          '<span class="ls" aria-hidden="true">' + LVL_TINY[i] + '</span></div>';
      }).join('') + '</div></div>';
  }
  function readingWord() { return ladder.all ? 'Reading every level' : 'Reading at: ' + LVL_NAMES[ladder.lvl]; }
  function toplineHTML(back, pos) {
    // the breadcrumb is the only way out of a lesson — a chevron says so, and
    // the padding gives it a target a thumb can actually land on
    return '<div class="topline"><button class="pos" data-go="' + back + '"><span class="cv">\u2039</span> ' + esc(pos) + '</button>' +
      '<span class="now"><span data-book-now>' + esc(readingWord()) + '</span>' +
      '<button class="all" data-book-all>' + (ladder.all ? 'One level' : 'All six levels') + '</button></span></div>';
  }
  /* re-apply the chosen level to a rendered page without rebuilding it */
  function applyLevel() {
    var root = app.querySelector('.book'); if (!root) return;
    root.classList.toggle('all', ladder.all);
    root.querySelectorAll('.lvl').forEach(function (el) {
      var on = el.getAttribute('data-level') === LVL_KEYS[ladder.lvl];
      el.hidden = !ladder.all && !on;
      el.classList.toggle('cur', on);
    });
    root.querySelectorAll('[data-book-now]').forEach(function (el) { el.textContent = readingWord(); });
    root.querySelectorAll('[data-book-all]').forEach(function (el) { el.textContent = ladder.all ? 'One level' : 'All six levels'; });
    root.querySelectorAll('.tmx .lv').forEach(function (el) { el.classList.toggle('cur', el.getAttribute('data-level') === LVL_KEYS[ladder.lvl]); });
    var seg = document.getElementById('lvlseg');
    if (seg && seg.lgSelect) seg.lgSelect(ladder.lvl);
    saveLadder();
  }

  /* ---- words: every term a page uses, explained at all six rungs ---------- */
  function termPanelHTML(t, withDef) {
    var lv = (t.levels || []).map(function (s, i) {
      return '<div class="lv' + (i === ladder.lvl ? ' cur' : '') + '" data-level="' + LVL_KEYS[i] + '"><span class="lk ' + LVL_KEYS[i] + '">' + esc(LVL_NAMES[i]) + '</span> ' + md(s) + '</div>';
    }).join('');
    return '<div class="tmx">' + (withDef ? '<div class="tt">' + esc(t.term) + '</div>' + (t.def ? '<p class="d">' + md(t.def) + '</p>' : '') : '') + lv + '</div>';
  }
  function wordsHTML(bk, ids) {
    var list = (ids || []).map(function (i) { return bk.terms[i]; }).filter(Boolean);
    if (!list.length) return '';
    return '<details class="guide words"><summary>Words used here<span class="cnt">' + list.length + '</span></summary><div class="gb">' +
      list.map(function (t) {
        return '<div class="term"><button class="tq" data-term="' + t.id + '"><span class="k">' + esc(t.term) + '</span>' +
          (t.def ? '<span class="d">' + md(t.def) + '</span>' : '') + '</button></div>';
      }).join('') + '</div></details>';
  }
  function beginTerms(bk, ids) {
    termCtx = { bk: bk, list: (ids || []).map(function (i) { return bk.terms[i]; }).filter(Boolean), seen: {} };
  }
  function endTerms() { termCtx = null; }

  /* ---- pieces ------------------------------------------------------------ */
  function lessonWord(it) { return it.kind === 'lesson' ? 'Lesson ' + it.n : 'Topic'; }
  function plistHTML(deckId, rows) {
    return '<ul class="plist">' + rows.map(function (r) {
      return '<li><button class="pl' + (r.done ? ' done' : '') + '" data-go="' + r.go + '"><span class="n">' + esc(r.n) + '</span><span class="t">' + mdT(r.t) + '</span></button></li>';
    }).join('') + '</ul>';
  }
  function checkRow(deckId, it) {
    var done = !!bookDone()[it.id];
    return '<button class="chk' + (done ? ' on' : '') + '" data-book-done="' + it.id + '"><i></i><span>Done</span></button>';
  }
  function walkHTML(it) {
    var intro = sec(it, 'guided-walkthrough'), steps = secs(it, 'step');
    if (!steps.length) return '';
    var lis = steps.map(function (st) {
      var pre = [], doP = null, code = [], lines = null, rest = [];
      var mode = 'pre';
      st.b.forEach(function (b) {
        if (b.t === 'p' && b.lead === 'Do this') { doP = b; mode = 'do'; return; }
        if (b.t === 'p' && b.lead === 'What each line does') { mode = 'ln'; if (b.s) rest.push(b); return; }
        if (b.t === 'code') { code.push(b); mode = 'code'; return; }
        if (b.t === 'ul' && mode === 'ln') { lines = b; return; }
        if (mode === 'pre') pre.push(b); else rest.push(b);
      });
      var ln = lines ? '<div class="ln"><div class="gk">What each line does</div><ul>' + lines.items.map(function (x) {
        var m = /^(`[^`]+`)\s+[—–-]+\s+(.*)$/.exec(x);
        return m ? '<li>' + md(m[1]) + '<span>' + md(m[2]) + '</span></li>' : '<li><span>' + md(x) + '</span></li>';
      }).join('') + '</ul></div>' : '';
      return '<li class="step' + (code.length ? '' : ' nocode') + '">' +
        (pre.length ? '<div class="pre"><div class="gk">Before you do this</div>' + bookBlocks(pre.map(function (b) { var c = {}; for (var k in b) c[k] = b[k]; delete c.lead; return c; })) + '</div>' : '') +
        (doP ? '<p class="do"><b>Do this.</b> ' + md(doP.s) + '</p>' : '') +
        (code.length || ln ? '<div class="code">' + code.map(function (c) { return codeHTML(c.s); }).join('') + ln + '</div>' : '') +
        (rest.length ? bookBlocks(rest) : '') +
        '</li>';
    }).join('');
    return '<div class="row walk"><h3>Guided walkthrough</h3>' + (intro ? bookBlocks(intro.b).replace(/^<p>/, '<p class="note">') : '') + '<ol>' + lis + '</ol></div>';
  }
  function pagerHTML(deckId, bk, id) {
    var i = bk.order.indexOf(id), prev = bk.items[bk.order[i - 1]], next = bk.items[bk.order[i + 1]];
    if (!prev && !next) return '';
    return '<nav class="pager">' +
      (prev ? '<button class="prev" data-go="#/d/' + deckId + '/l/' + prev.id + '"><span class="n">Previous · ' + esc(lessonWord(prev)) + '</span><span class="t">' + mdT(prev.title) + '</span></button>' : '') +
      (next ? '<button class="next" data-go="#/d/' + deckId + '/l/' + next.id + '"><span class="n">Next · ' + esc(lessonWord(next)) + '</span><span class="t">' + mdT(next.title) + '</span></button>' : '') +
      '</nav>';
  }
  function bookMount(html) {
    mount('<div class="book">' + html + segHTML() + '</div>', { book: true });
    applyLevel();
    jumpsFor();
    readMinutes();
  }
  /* A lesson runs to eight thousand pixels on a phone. One line under its
     head names the parts and jumps to them: the six levels, the check, the
     misconceptions, the walkthrough. Built from the headings the page has,
     so it never promises a part that is not there. */
  function jumpsFor() {
    var heads = app.querySelectorAll('.book section .row > h3');
    var host = app.querySelector('.book section > .stack'), after = false;
    if (!host) { host = app.querySelector('.book section .ladder > .head'); after = true; }
    if (!host) return;
    var links = [];
    // a lesson's six levels are not a titled row, but they are its first part
    var lv = app.querySelector('.book .levels');
    if (lv) { lv.id = lv.id || 'part-levels'; links.push('<button class="jump" data-jump="part-levels">Six levels</button>'); }
    for (var i = 0; i < heads.length; i++) {
      var row = heads[i].parentNode, name = (heads[i].textContent || '').replace(/\s+\d+ of \d+$/, '').trim();
      if (!name) continue;
      row.id = row.id || 'part-' + i;
      links.push('<button class="jump" data-jump="' + row.id + '">' + esc(name) + '</button>');
    }
    if (links.length < 3) return;
    var nav = document.createElement('nav');
    nav.className = 'jumps'; nav.setAttribute('aria-label', 'On this page');
    nav.innerHTML = '<span class="jl">On this page</span>' + links.join('');
    if (after) host.insertAdjacentElement('afterend', nav); else host.appendChild(nav);
  }

  /* the unit page: what to read, with progress, before the cards */
  function bookUnitHTML(deckId, unitId) {
    var bk = bookOf(deckId);
    if (!bk || !bk.byUnit[unitId]) return '';
    var done = bookDone();
    var lis = bk.byUnit[unitId].map(function (ph) {
      var n = ph.items.length, dn = ph.items.filter(function (it) { return done[it.id]; }).length;
      // the hours the phase asks for, from its own meta line ("≈40 h")
      var hm = /≈\s*(\d+)\s*h/.exec(ph.meta || ''), hrs = hm ? ' · ≈' + hm[1] + ' h' : '';
      return '<li><button class="ph" data-go="#/d/' + deckId + '/b/' + ph.n + '"><span class="n"><span>Phase ' + ph.n + esc(hrs) + '</span><span class="pct">' + dn + ' of ' + n + '</span></span>' +
        '<span class="t">' + esc(ph.title) + '</span><span class="bar"><i style="width:' + (n ? Math.round(dn / n * 100) : 0) + '%"></i></span></button>' +
        '<ul>' + ph.items.map(function (it) {
          return '<li><button class="' + (done[it.id] ? 'done' : '') + '" data-go="#/d/' + deckId + '/l/' + it.id + '"><span class="n">' + esc(lessonWord(it)) + '</span><span class="t">' + mdT(it.title) + '</span></button></li>';
        }).join('') + '</ul></li>';
    }).join('');
    return '<div class="book idx-wrap"><div class="eyebrow">Read first</div><ol class="idx">' + lis + '</ol><div class="eyebrow cards">Cards</div></div>';
  }

  function viewPhase(deckId, n) {
    var d = S.getDeck(deckId), bk = bookOf(deckId), ph = bk && bk.phases[String(n)];
    if (!ph) return go('#/d/' + deckId);
    curDeckId = lastDeckId = deckId;
    var u = d.unitById[ph.u], done = bookDone();
    beginTerms(bk, ph.terms);
    var goal = sec(ph, 'goal'), learn = sec(ph, 'what-you-need-to-learn');
    var lessons = plistHTML(deckId, ph.items.map(function (it) { return { n: lessonWord(it), t: it.title, go: '#/d/' + deckId + '/l/' + it.id, done: !!done[it.id] }; }));
    var res = ph.resources.length ? plistHTML(deckId, ph.resources.map(function (r) {
      var meta = (r.lives || '').split(' · ');
      return { n: meta[0] || 'read', t: r.title, go: '#/d/' + deckId + '/r/' + r.id, done: false };
    })) : '';
    // the phase at a glance: what it asks for, counted, before the reading
    var nFiles = 0, nChecks = 0;
    function countFiles(bs) { (bs || []).forEach(function (b) { if (b.t === 'file') { nFiles++; countFiles(b.b); } }); }
    (ph.after || []).forEach(function (s) {
      if (s.k === 'build') countFiles(s.b);
      if (s.k === 'done-when') (s.b || []).forEach(function (b) { if (b.t === 'ul' || b.t === 'ol') nChecks += b.items.length; });
    });
    var glance = [plural(ph.items.length, 'lesson')];
    if (ph.resources.length) glance.push(plural(ph.resources.length, 'thing', 'things') + ' to read or watch');
    if (nFiles) glance.push(plural(nFiles, 'file') + ' to write');
    if (nChecks) glance.push(plural(nChecks, 'check'));
    var after = (ph.after || []).map(function (s) {
      if (s.k === 'done-when') return checklistHTML(ph, s);
      return '<div class="row"><h3>' + esc(secLabel(s)) + '</h3>' + bookBlocks(s.b) + '</div>';
    }).join('');
    var html = toplineHTML('#/d/' + deckId + '/u/' + ph.u, nice(d) + (u ? ' · Unit ' + u.n : '') + ' · Phase ' + ph.n) +
      '<section class="page phase stack-l"><div class="stack">' +
      '<div class="eyebrow">Phase ' + ph.n + (ph.meta ? ' · ' + mdT(ph.meta) : '') + '</div>' +
      '<h2>' + esc(ph.title) + '</h2>' +
      (goal ? '<p class="lede">' + bookBlocks(goal.b).replace(/^<p>|<\/p>$/g, '') + '</p>' : '') +
      '<p class="note glance">' + esc(glance.join(' · ')) + '</p>' +
      wordsHTML(bk, ph.terms) + '</div>' +
      (learn ? '<div class="row"><h3>What you need to learn</h3>' + bookBlocks(learn.b) + '</div>' : '') +
      '<div class="row"><h3>Lessons and topics</h3>' + lessons + '</div>' +
      (res ? '<div class="row"><h3>Read and watch</h3><p class="note">Every one explained at every level, with a study guide.</p>' + res + '</div>' : '') +
      after + '</section>';
    endTerms();
    bookMount(html);
  }

  /* the pages before Phase 0: the rules, the project laid out file by file, how
     to study. They belong to the course, not to a unit, so they hang off the
     course page. */
  function aboutPages(d) { return (d && d.book && d.book.about) || []; }
  function viewAbout(deckId, key) {
    var d = S.getDeck(deckId), bk = bookOf(deckId), a = null;
    aboutPages(d).forEach(function (x) { if (x.id === key) a = x; });
    if (!bk || !a) return go('#/d/' + deckId);
    curDeckId = lastDeckId = deckId;
    beginTerms(bk, a.terms);
    var html = toplineHTML('#/d/' + deckId, nice(d) + ' · Before you start') +
      '<section class="page phase stack-l"><div class="stack"><div class="eyebrow">Before you start</div>' +
      '<h2>' + esc(a.title) + '</h2>' + wordsHTML(bk, a.terms) + '</div>' +
      (a.sections || []).map(function (s) {
        if (s.k === 'h3') return '<div class="row"><h3>' + mdT(s.title || '') + '</h3>' + bookBlocks(s.b) + '</div>';
        return '<div class="stack">' + bookBlocks(s.b).replace(/^<p>/, '<p class="lede">') + '</div>';
      }).join('') + '</section>';
    endTerms();
    bookMount(html);
  }

  /* every word the course uses, on one page: grouped, alphabetical, each one
     opening to its six levels exactly as it does inline. A reader who meets
     "collider" in phase 7 and cannot place it has somewhere to look it up. */
  function viewWords(deckId) {
    var d = S.getDeck(deckId), bk = bookOf(deckId);
    if (!bk) return go('#/d/' + deckId);
    curDeckId = lastDeckId = deckId;
    var groups = {}, order = [];
    Object.keys(bk.terms).forEach(function (id) {
      var t = bk.terms[id], g = t.group || 'Other';
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(t);
    });
    var n = 0;
    var rows = order.map(function (g) {
      var list = groups[g].sort(function (a, b) { return a.term.localeCompare(b.term); });
      n += list.length;
      return '<div class="row wgroup"><h3>' + esc(g) + ' <span class="ckcnt num">' + list.length + '</span></h3><div class="gb">' +
        list.map(function (t) {
          return '<div class="term" data-word="' + esc((t.term + ' ' + (t.names || []).join(' ') + ' ' + T.plain(t.def || '')).toLowerCase()) + '">' +
            '<button class="tq" data-term="' + t.id + '"><span class="k">' + esc(t.term) + '</span>' +
            (t.def ? '<span class="d">' + md(t.def) + '</span>' : '') + '</button></div>';
        }).join('') + '</div></div>';
    }).join('');
    var html = toplineHTML('#/d/' + deckId, nice(d) + ' · Every word') +
      '<section class="page phase stack-l"><div class="stack"><div class="eyebrow">Every word the course uses</div>' +
      '<h2>Words</h2><p class="lede">' + plural(n, 'word') + ' in ' + plural(order.length, 'group') + '. Tap one for its six levels; the reading level you chose is the dark one.</p>' +
      '<div class="searchbar"><input id="wq" type="search" aria-label="Find a word" placeholder="Find a word" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"></div>' +
      '<div class="empty" id="wempty" hidden>No words match</div>' +
      '</div>' + rows + '</section>';
    bookMount(html);
  }
  function filterWords(q) {
    q = (q || '').trim().toLowerCase();
    var groups = app.querySelectorAll('.wgroup');
    for (var i = 0; i < groups.length; i++) {
      var terms = groups[i].querySelectorAll('.term'), shown = 0;
      for (var j = 0; j < terms.length; j++) {
        var hit = !q || (terms[j].getAttribute('data-word') || '').indexOf(q) > -1;
        terms[j].hidden = !hit; if (hit) shown++;
      }
      groups[i].hidden = !shown;
    }
    var any = false;
    for (var g = 0; g < groups.length; g++) if (!groups[g].hidden) any = true;
    var we = app.querySelector('#wempty'); if (we) we.hidden = any || !groups.length;
  }

  /* the lessons this one leans on, and the ones that lean on it, counted by
     the words they share: the map a reader lost mid-course needs */
  function relatedHTML(deckId, bk, it) {
    var mine = {}; (it.terms || []).forEach(function (t) { mine[t] = 1; });
    var before = {}, after = {}, pos = bk.order.indexOf(it.id);
    (it.terms || []).forEach(function (tid) {
      var f = bk.termFirst[tid];
      if (f && f !== it.id) before[f] = (before[f] || 0) + 1;
    });
    bk.order.slice(pos + 1).forEach(function (oid) {
      (bk.items[oid].terms || []).forEach(function (tid) { if (bk.termFirst[tid] === it.id) after[oid] = (after[oid] || 0) + 1; });
    });
    function top(m) {
      return Object.keys(m).sort(function (a, b) { return m[b] - m[a] || bk.order.indexOf(a) - bk.order.indexOf(b); }).slice(0, 3);
    }
    function link(oid) {
      var o = bk.items[oid];
      var tt = T.plain(o.title || '').replace(/[`*_]/g, ''); if (tt.length > 42) tt = tt.slice(0, 40).replace(/\s+\S*$/, '') + '…';
      return '<button class="lnk" data-go="#/d/' + deckId + '/l/' + oid + '">' + esc(lessonWord(o) + (tt ? ' · ' + tt : '')) + '</button>';
    }
    var b = top(before), a = top(after), out = '';
    if (b.length) out += '<p class="note rel">Builds on ' + b.map(link).join(', ') + '.</p>';
    if (a.length) out += '<p class="note rel">Comes up again in ' + a.map(link).join(', ') + '.</p>';
    return out;
  }
  /* minutes to read what is on the page at the chosen level, at a steady
     220 words a minute; it follows the level control */
  function readMinutes() {
    var el = document.getElementById('readmin'), sec = app.querySelector('.book section');
    if (!el || !sec) return;
    var words = (sec.innerText || '').split(/\s+/).filter(Boolean).length;
    el.textContent = '≈ ' + Math.max(1, Math.round(words / 220)) + ' min';
  }

  function viewLesson(deckId, id) {
    var d = S.getDeck(deckId), bk = bookOf(deckId), it = bk && bk.items[id];
    if (!it) return go('#/d/' + deckId);
    curDeckId = lastDeckId = deckId;
    var ph = bk.phases[String(it.pn)], u = d.unitById[it.u];
    var goal = sec(it, 'goal'), check = sec(it, 'check-yourself'), misc = sec(it, 'misconceptions');
    var nq = check ? check.b.filter(function (b) { return b.t === 'qa'; }).length : 0;
    var ncards = (it.cards || []).length;
    beginTerms(bk, it.terms);
    var extra = (it.sections || []).filter(function (s) { return ['goal', 'level', 'guided-walkthrough', 'step', 'check-yourself', 'misconceptions'].indexOf(s.k) < 0; });
    var html = toplineHTML('#/d/' + deckId + '/u/' + it.u, nice(d) + (u ? ' · Unit ' + u.n : '') + ' · Phase ' + ph.n + ' · ' + lessonWord(it)) +
      '<section class="page"><div class="ladder">' +
      '<div class="head"><div class="hd"><div class="eyebrow">Six levels' + (nq ? ' · ' + nq + (nq === 1 ? ' question' : ' questions') + ' to check yourself' : '') + ' · <span id="readmin"></span></div>' + checkRow(deckId, it) + '</div>' +
      '<h3 class="title">' + mdT(it.title) + '</h3>' +
      (goal ? '<p class="lede">' + bookBlocks(goal.b).replace(/^<p>|<\/p>$/g, '') + '</p>' : '') +
      (it.lives ? '<p class="note">' + mdT(it.lives) + '</p>' : '') +
      relatedHTML(deckId, bk, it) +
      wordsHTML(bk, it.terms) +
      (extra.length ? extra.map(function (s) { return bookBlocks(s.b); }).join('') : '') +
      '</div>' +
      '<div class="lvls stack">' + levelsHTML(it) + '</div>' +
      '<div class="side stack">' +
        (check ? '<div class="row"><h3>Check yourself</h3>' + bookBlocks(check.b) + '</div>' : '') +
        (misc ? '<div class="row"><h3>Misconceptions</h3>' + bookBlocks(misc.b) + '</div>' : '') +
        (ncards ? '<div class="row"><button class="mode" data-go="#/study/' + deckId + '/l:' + id + '/' + it.u + '">Study these ' + ncards + ' cards</button></div>' : '') +
      '</div>' +
      walkHTML(it) +
      '</div>' + pagerHTML(deckId, bk, id) + '</section>';
    endTerms();
    bookMount(html);
  }

  function viewResource(deckId, id) {
    var d = S.getDeck(deckId), bk = bookOf(deckId), r = bk && bk.res[id];
    if (!r) return go('#/d/' + deckId);
    curDeckId = lastDeckId = deckId;
    var ph = bk.resPhase[id];
    var meta = (r.lives || '').split(' · ');
    var metaHTML = meta.length ? '<div class="meta">' + meta.map(function (m, i) {
      return i === 1 ? '<span class="cost' + (/free/i.test(m) ? ' free' : '') + '">' + esc(m) + '</span>' : '<span>' + mdT(m) + '</span>';
    }).join('') + '</div>' : '';
    beginTerms(bk, r.terms);
    var guide = ['what-it-covers', 'key-ideas-in-order', 'formulas-and-commands-to-remember', 'three-takeaways', 'practice'].map(function (k) {
      var s = sec(r, k); if (!s) return '';
      if (k === 'practice') return '<div class="prac"><b>Practice.</b> ' + bookBlocks(s.b).replace(/^<p>|<\/p>$/g, '') + '</div>';
      return '<div class="gk">' + esc(SECNAME[k]) + '</div>' + bookBlocks(s.b);
    }).join('');
    var html = toplineHTML('#/d/' + deckId + '/b/' + ph.n, nice(d) + ' · Phase ' + ph.n + ' · Read and watch') +
      '<section class="page"><div class="res">' +
      '<div class="head stack"><div class="eyebrow why">Explained at every level</div>' +
      '<h3 class="title">' + (r.url ? '<a href="' + esc(r.url) + '" target="_blank" rel="noopener">' + mdT(r.title) + '</a>' : mdT(r.title)) + '</h3>' +
      metaHTML + wordsHTML(bk, r.terms) + '</div>' +
      '<div class="lvls stack">' + levelsHTML(r) + '</div>' +
      (guide ? '<details class="guide"' + (isWide() ? ' open' : '') + '><summary>Study guide: learn it here</summary><div class="gb">' + guide + '</div></details>' : '') +
      '</div></section>';
    endTerms();
    bookMount(html);
  }
  function lessonQueue(d, id) {
    var bk = bookOf(d.id), it = bk && bk.items[id];
    return it ? S.shuffle((it.cards || []).map(function (i) { return d.byId[i]; }).filter(Boolean)) : [];
  }


  /* ==========================================================================
     SESSION · shared engine for flashcards and multiple choice
     ========================================================================== */
  var sess = null;

  /* THE QUEUE OUTLIVES THE SCREEN. Grades were saved from the first card, but
     the deal was not: a reload, a back gesture, a mis-aimed X twelve pixels
     under the Again button — or iOS discarding a backgrounded tab while you
     answer a text — dropped you back at "1 of 20" on a different card, with
     no way to say "I was in the middle of that". The remaining cards, the
     tallies and the route are written on every grade and read back when the
     same route is opened again on the same day. */
  var SESS_KEY = 'apdecks.v1.sess';
  /* Every deal left mid-way is kept for the rest of the day, keyed by its
     route: a Chemistry unit paused to open History is where it was when you
     come back, and so is the History deal if you leave that one too. Only
     today's are kept — a deal from yesterday is stale by definition. The
     single slot this replaces held one session and lost it the moment
     another course was opened. */
  function hereHash() { return location.hash.replace(/^#/, '') || '/'; }
  function sessMap() {
    var raw; try { raw = localStorage.getItem(SESS_KEY); } catch (e) { return {}; }
    if (!raw) return {};
    var j; try { j = JSON.parse(raw); } catch (e) { return {}; }
    if (!j || typeof j !== 'object') return {};
    if (typeof j.h === 'string') { var one = {}; one[j.h] = j; j = one; }   // the old single slot
    var today = S.dayNum(), out = {};
    for (var k in j) if (j[k] && j[k].day === today && j[k].ids && j[k].ids.length) out[k] = j[k];
    return out;
  }
  function writeSessMap(m) {
    try {
      if (!Object.keys(m).length) localStorage.removeItem(SESS_KEY);
      else localStorage.setItem(SESS_KEY, JSON.stringify(m));
    } catch (e) {}
  }
  function saveSess() {
    var m = sessMap(), h = (sess && sess.h) || hereHash();
    try {
      if (!sess || !sess.queue.length) { delete m[h]; writeSessMap(m); return; }
      m[h] = {
        h: h,
        day: S.dayNum(),
        ids: sess.queue.map(function (c) { return c.i; }),
        done: sess.done, planned: sess.planned, lapsed: sess.lapsed || {},
        again: sess.again, hard: sess.hard || 0, good: sess.good, easy: sess.easy,
        right: sess.right, wrong: sess.wrong,
        quiz: !!sess.quiz, score: !!sess.score, typing: !!sess.typing, cram: !!sess.cram, just: !!sess.just,
        mixed: !!sess.mixed, mode: sess.mode, unitId: sess.unitId || null,
        deck: sess.deck ? sess.deck.id : null, back: sess.back || null,
        // grades given: Again re-queues and leaves done where it was, so done
        // alone cannot tell an untouched deal from one a card into it
        graded: sess.history ? sess.history.length : 0
      };
      writeSessMap(m);
    } catch (e) {}
  }
  function clearSess() { var m = sessMap(); delete m[(sess && sess.h) || hereHash()]; writeSessMap(m); }
  /* the deals waiting today, other than the one on screen: what the
     Continue line offers */
  function pausedSessions() {
    var m = sessMap(), here = hereHash(), out = [];
    for (var h in m) {
      if (h === here) continue;
      var j = m[h], p = h.split('/').filter(Boolean);
      // a deal opened and left untouched is not a place to go back to
      if (!j.done && !j.graded) continue;
      var deck = j.deck ? S.getDeck(j.deck) : null;
      var unit = deck && j.unitId ? deck.unitById[j.unitId] : null;
      var fp = deck ? focusOf(deck, j.unitId) : null;
      var name = p[0] === 'review' ? 'Review' : p[0] === 'ten' ? 'Quick ten'
        : p[0] === 'starred' ? 'Starred' : p[0] === 'stuck' ? 'Trouble spots'
        : deck ? nice(deck) + (fp ? ' · ' + fp.title : unit ? ' · ' + unit.title : j.unitId && j.unitId.indexOf('+') > -1 ? ' · both tables' : '')
        : 'Session';
      if (j.cram) name += j.just ? ' · justify' : ' · cram'; else if (j.score) name += ' · score it'; else if (j.quiz) name += ' · quiz';
      out.push({ h: h, name: name, done: j.done || 0, planned: j.planned || j.ids.length });
    }
    return out;
  }
  /* always in the markup, empty or not, so a standing rail keeps its rows in
     place when a line appears */
  function resumeHTML() {
    return '<div class="resumewrap">' + pausedSessions().map(function (x) {
      return '<div class="resumerow"><button class="resume" data-go="#' + esc(x.h) + '">' +
        '<span class="rl">Continue · ' + esc(x.name) + '</span>' +
        '<span class="rv">' + x.done + ' of ' + x.planned + '</span></button>' +
        // a deal you will not come back to: the line goes, the grades given stay
        '<button class="iconbtn right forget" data-forget="' + esc(x.h) + '" aria-label="Clear ' + esc(x.name) + '">' +
        '<svg aria-hidden="true"><use href="#i-close"/></svg></button></div>';
    }).join('') + '</div>';
  }
  var byId = null;
  // a deck arriving adds cards the map has never seen
  window.addEventListener('apdecks-deck', function () { byId = null; });
  function cardById(id) {
    if (!byId) {
      byId = {};
      (S.getIndex().courses || []).forEach(function (c) {
        var d = S.getDeck(c.id); if (!d) return;
        d.cards.forEach(function (card) { byId[card.i] = card; });
      });
    }
    return byId[id];
  }
  /* Are any of the decks still on their way? savedSess() runs at the FIRST
     route, before a single deck file has landed, so every saved card id
     resolved to nothing and the blob was thrown away as corrupt — the feature
     deleted itself in exactly the case it was written for. */
  function decksInFlight() {
    return (S.getIndex().courses || []).some(function (c) { return !S.getDeck(c.id); });
  }
  /* is there a saved deal for this route that we simply cannot read yet? */
  function savedPending() {
    if (!decksInFlight()) return false;
    return !!sessMap()[hereHash()];
  }
  /* the saved deal for THIS route, if it is still today's */
  function savedSess() {
    var j = sessMap()[hereHash()];
    if (!j) return null;
    var q = (j.ids || []).map(cardById).filter(Boolean);
    if (q.length !== (j.ids || []).length) {
      // a deck that has not arrived is not a corrupt blob — never delete on it
      if (!decksInFlight()) clearSess();
      return null;
    }
    if (!q.length) { clearSess(); return null; }
    return {
      deck: j.deck ? S.getDeck(j.deck) : null, unitId: j.unitId, mode: j.mode,
      quiz: j.quiz, score: j.score, cram: j.cram, just: j.just, mixed: j.mixed, typing: j.typing, back: j.back,
      queue: q, done: j.done || 0, planned: j.planned || q.length, lapsed: j.lapsed || {},
      again: j.again || 0, hard: j.hard || 0, good: j.good || 0, easy: j.easy || 0,
      right: j.right || 0, wrong: j.wrong || 0,
      revealed: false, answered: false, typed: '', history: [], resumed: true
    };
  }
  /* the screen that waits for the decks so the saved deal can be read */
  function waitingScreen() {
    mount('<div class="head">' + RING + '<div class="sub">Finding where you were.</div></div>');
    return true;
  }
  function resume() {
    var r = savedSess();
    if (!r) return false;
    sess = r;
    renderCard();
    toast(plural(r.queue.length, 'card') + ' left. Picked up where you were.');
    return true;
  }

  function startSession(deckId, mode, unitId, quiz) {
    var d = S.getDeck(deckId);
    if (!d) return go('#/');
    if (savedPending()) return waitingScreen();
    if (resume()) return;
    // the daily path deals the chosen queue; fixed modes stay literal
    var lesson = (mode || '').indexOf('l:') === 0 ? mode.slice(2) : null;
    // one topic of a unit, every card of it, shuffled: the drill a topic
    // heading offers
    var topic = (mode || '').indexOf('t:') === 0 ? decodeURIComponent(mode.slice(2)) : null;
    // one exam skill across every unit: the move practised, not the chapter
    var skill = (mode || '').indexOf('s:') === 0 ? decodeURIComponent(mode.slice(2)) : null;
    var handed = pendingDeal && pendingDeal.h === hereHash() ? pendingDeal.ids.map(cardById).filter(Boolean) : null;
    pendingDeal = null;
    var queue = handed && handed.length ? S.shuffle(handed) : mode === 'mix' ? examMix(d) : skill ? skillQueue(d, skill) : topic ? S.shuffle(d.cards.filter(function (c) { return (!unitId || c.u === unitId) && (c.t || '') === topic; }))
      : lesson ? lessonQueue(d, lesson)
      : (mode || 'smart') === 'smart'
      ? buildDaily({ deck: d, unit: unitId || null })
      // "Catch up" is the other half of the trade the coverage line names:
      // the daily deal covers the syllabus and lets a review debt build, and
      // this drains the debt without introducing anything new
      : mode === 'due'
      ? buildDaily({ deck: d, unit: unitId || null, noNew: true })
      : S.buildSession(d, unitId || null, mode);
    if (!queue.length) return renderEmptySession(d, unitId, mode);
    sess = {
      deck: d, unitId: unitId || null, mode: mode, quiz: !!quiz,
      back: lesson ? '#/d/' + deckId + '/l/' + lesson : skill ? '#/d/' + deckId + '/k' : null,
      typing: !quiz && S.getSettings().typing,
      queue: queue, done: 0, planned: queue.length, redo: 0,
      revealed: false, again: 0, hard: 0, good: 0, easy: 0, lapsed: {}, right: 0, wrong: 0,
      history: [], answered: false, typed: ''
    };
    renderCard();
  }

  /* review across every deck — the chosen queue: due first by value, new
     cards always seeping in, no deck owning the session */
  function startReview(limit) {
    if (savedPending()) return waitingScreen();
    if (resume()) return;
    /* …and a deal built while a course is still in flight is a deal from
       whichever course arrived first: reloading onto #/review with 261 due
       across five courses dealt thirty English cards and never re-dealt. */
    if (decksInFlight()) return waitingScreen();
    var queue = buildDaily(limit ? { limit: limit } : null);
    if (!queue.length) {
      // say when the next card comes back, and where — not just that none are due
      var today = S.dayNum(), next = null, nextDeck = null;
      S.getIndex().courses.forEach(function (c) {
        var d = S.getDeck(c.id); if (!d || S.retired(c.id)) return;
        d.cards.forEach(function (card) {
          var st = S.cs(card.i);
          if (st && st.d > today && (!next || st.d < next)) { next = st.d; nextDeck = d; }
        });
      });
      var when = '';
      if (next !== null) {
        var days = next - today;
        // name the weekday from the DAY NUMBER, not from a millisecond sum:
        // across a DST change 23:30 + 72 h is not three days later, and the
        // card due on the spring-forward Sunday was announced for Monday
        var wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          [new Date(S.dayKey(next) + 'T12:00:00Z').getUTCDay()];
        when = (days === 1 ? 'Tomorrow' : days < 7 ? wd : 'In ' + days + ' days') +
          (nextDeck ? ', ' + nice(nextDeck) + ' comes back' : '');
      }
      return mount(
        '<div class="head"><h1>Nothing due</h1>' +
        (when ? '<div class="sub">' + esc(when) + '</div>' : '') + '</div>' +
        '<button class="textbtn" data-go="#/">Courses</button>'
      );
    }
    sess = {
      deck: null, unitId: null, mode: 'due', quiz: false, mixed: true,
      typing: S.getSettings().typing,
      queue: queue, done: 0, planned: queue.length, redo: 0,
      revealed: false, again: 0, hard: 0, good: 0, easy: 0, lapsed: {}, right: 0, wrong: 0, history: [], answered: false, typed: ''
    };
    renderCard();
  }

  /* cram a unit before a test: every card, least-known first, and the
     schedule stays honest — a pass never pushes a well-timed card away */
  function startCram(deckId, unitId, kind) {
    var d = S.getDeck(deckId);
    if (!d) return go('#/');
    if (savedPending()) return waitingScreen();
    if (resume()) return;
    // "…/j": only the unit's explain-whys
    var just = kind === 'j';
    // "g:subj": one grammar point, its cards from whichever units hold them
    var fp = focusOf(d, unitId);
    // "ions+vsepr": more than one unit in the same deal, for the tables
    var set = unitId && !fp ? unitId.split('+') : [];
    if (set.some(function (id) { return !d.unitById[id]; })) return go('#/d/' + deckId);
    var cards = fp ? focusCards(d, fp) : d.cards.filter(function (c) { return !set.length || set.indexOf(c.u) > -1; });
    if (just) cards = cards.filter(function (c) { return c.y === 'j'; });
    if (!cards.length) return go('#/d/' + deckId);
    S.shuffle(cards);
    cards.sort(function (a, b) { return cramRank(a) - cramRank(b); });
    sess = {
      deck: d, unitId: unitId || null, mode: 'cram', cram: true, just: just, quiz: false,
      back: fp ? '#/d/' + deckId + '/g' : set.length > 1 ? '#/d/' + deckId : null,
      typing: S.getSettings().typing,
      queue: cards, done: 0, planned: cards.length, redo: 0,
      revealed: false, again: 0, hard: 0, good: 0, easy: 0, lapsed: {}, right: 0, wrong: 0, history: [], answered: false, typed: ''
    };
    renderCard();
  }
  function cramRank(c) {
    var s = S.cs(c.i);
    if (!s || !(s.r || s.t || s.l)) return 0;          // never studied — first
    return (S.isKnown(c.i) ? 4 : 1) + (s.r || 0) - (s.l || 0) * 0.5;
  }

  /* ==========================================================================
     SCORE IT — the reader's side of an explain-why. Every explain-why card
     carries its model answer, the other arguments that also earn the point
     and the confident answers that lose it, each with the reason. Shown one
     at a time, "would this earn the point?" is the judgement the free-
     response section scores, practised on answers someone else wrote. It
     rides the quiz's two-choice machinery but never writes the schedule:
     judging an answer is not recalling one.
     ========================================================================== */
  function scorePool(d, unitId, limit) {
    var js = d.cards.filter(function (c) {
      return c.y === 'j' && (!unitId || c.u === unitId) && ((c.w && c.w.length) || (c.o && c.o.length));
    });
    if (limit) return js.slice(0, limit);
    // cards already studied first: judging is sharper on a question you know
    var seen = [], fresh = [];
    js.forEach(function (c) { (S.isNew(c.i) ? fresh : seen).push(c); });
    return S.shuffle(seen).concat(S.shuffle(fresh)).slice(0, Math.min(S.getSettings().sessionSize || 20, 15));
  }
  function startScore(deckId, unitId) {
    var d = S.getDeck(deckId);
    if (!d) return go('#/');
    if (unitId && !d.unitById[unitId]) return goReplace('#/d/' + deckId);
    if (savedPending()) return waitingScreen();
    if (resume()) return;
    var queue = scorePool(d, unitId || null);
    if (!queue.length) return renderEmptySession(d, unitId, 'score');
    sess = {
      deck: d, unitId: unitId || null, mode: 'score', quiz: true, score: true, typing: false,
      queue: queue, done: 0, planned: queue.length, redo: 0,
      revealed: false, again: 0, hard: 0, good: 0, easy: 0, lapsed: {}, right: 0, wrong: 0,
      history: [], answered: false, typed: ''
    };
    renderCard();
  }
  /* one answer to judge: a weak one a little more often than a valid one,
     since the weak answers are where the trap lives */
  function scoreCand(c) {
    var weak = (c.w || []).map(function (x) { return typeof x === 'string' ? { a: x } : x; })
      .filter(function (x) { return x && x.a; });
    var good = (c.o || []).filter(Boolean);
    var earn = weak.length ? Math.random() < 0.45 : true;
    if (earn) {
      if (good.length) return { text: good[Math.floor(Math.random() * good.length)], earns: true };
      return { text: c.a, earns: true, model: true };
    }
    var w = weak[Math.floor(Math.random() * weak.length)];
    return { text: w.a, earns: false, why: w.why || '' };
  }
  function renderScoreCard(c) {
    if (!sess.choices || !sess.cand) {
      sess.cand = scoreCand(c);
      sess.choices = [{ text: 'Earns the point', correct: sess.cand.earns },
                      { text: 'Loses the point', correct: !sess.cand.earns }];
    }
    var k = sess.cand, starred = S.isStarred(c.i);
    var body =
      '<div class="q' + sizeClass(c.q) + '">' + T.html(c.q) + '</div>' +
      '<div class="cand"><div class="jl">A student wrote</div><div class="ctext' + (stacked(k.text) ? ' mathy' : '') + '">' + T.html(k.text) + '</div></div>' +
      '<div class="choices">' + sess.choices.map(function (ch, n) {
        var state = sess.answered ? (ch.correct ? 'right' : (n === sess.picked ? 'wrong' : 'mute')) : '';
        return '<button class="choice" data-pick="' + n + '" style="--i:' + n + '"' +
          (state ? ' data-state="' + state + '"' : '') + (sess.answered ? ' disabled' : '') + '>' +
          esc(ch.text) + '</button>';
      }).join('') + '</div>' +
      (sess.answered ? scoreVerdict(c, k) : '');
    var footer = sess.answered
      ? '<div class="rate"><button class="r-good" data-next><span class="lab">Next</span></button></div>' : '';
    mount(
      '<div class="session">' + sessTop(c) +
      '<div class="cardstage"><div class="cardwrap"><div class="card' + (sess.answered ? '' : ' enter') + '" id="card"' +
        ' role="group" aria-live="polite" aria-atomic="false"' +
        ' aria-label="' + esc('Answer ' + (sess.done + 1) + ' of ' + sess.planned) + '">' + body + '</div></div></div>' +
      '<div class="morecue" aria-hidden="true">' + CHEV + '</div>' +
      footer + sessUtil(starred) + '</div>', { session: true, quiz: true });
    wireCard();
  }
  function scoreVerdict(c, k) {
    var ch = sess.choices[sess.picked], right = ch && ch.correct;
    var head = (right ? 'Right. ' : 'Not quite. ') + (k.earns
      ? (k.model ? 'It earns the point: it is the model answer.' : 'It earns the point: another valid way to argue it.')
      : 'It loses the point' + (k.why ? ': ' : '.'));
    return '<div class="scv">' +
      '<p class="sv">' + esc(head) + (!k.earns && k.why ? T.html(k.why) : '') + '</p>' +
      (k.model ? '' : '<div class="jl">The model answer</div><div class="sva' + (stacked(c.a) ? ' mathy' : '') + '">' + T.html(c.a) + '</div>') +
      (c.n ? '<p class="svn">' + T.html(c.n) + '</p>' : '') +
      '</div>';
  }

  /* ==========================================================================
     BY SKILL — the exam asks each skill about every unit, so a skill's cards
     dealt together are interleaved by construction: due first, then new,
     then the soonest-due of the rest, from wherever in the course they sit.
     ========================================================================== */
  function skillQueue(d, code) {
    var today = S.dayNum(), set = S.getSettings(), lim = set.sessionSize || 20;
    var due = [], fresh = [], rest = [];
    d.cards.forEach(function (c) {
      if (c.s !== code) return;
      if (S.isNew(c.i)) fresh.push(c);
      else if (S.cs(c.i).d <= today) due.push(c);
      else rest.push(c);
    });
    due.sort(function (a, b) { return S.cs(a.i).d - S.cs(b.i).d; });
    rest.sort(function (a, b) { return S.cs(a.i).d - S.cs(b.i).d; });
    S.shuffle(fresh);
    var out = due.slice(0, lim);
    var newCap = Math.max(set.newPerSession || 10, lim - out.length);
    out = out.concat(fresh.slice(0, Math.min(newCap, lim - out.length)));
    if (out.length < lim) out = out.concat(rest.slice(0, lim - out.length));
    return S.shuffle(out);
  }
  function viewSkills(deckId) {
    var d = S.getDeck(deckId);
    if (!d || !d.skills || !d.skills.length) return goReplace('#/d/' + deckId);
    var today = S.dayNum(), groups = [], byGroup = {};
    d.skills.forEach(function (s) {
      var n = 0, known = 0, due = 0;
      d.cards.forEach(function (c) {
        if (c.s !== s.code) return;
        n++;
        if (S.isKnown(c.i)) known++;
        else if (!S.isNew(c.i) && S.cs(c.i).d <= today) due++;
      });
      if (!n) return;
      var g = s.group || '';
      if (!byGroup[g]) { byGroup[g] = []; groups.push(g); }
      byGroup[g].push({ s: s, n: n, known: known, due: due });
    });
    mount(
      backbar(nice(d)) +
      '<div class="head"><h1 class="uhead">By skill</h1>' +
      '<div class="sub">The exam asks every skill about every unit. One skill at a time, with cards ' +
      'from across the course, practises the move instead of the chapter.</div></div>' +
      groups.map(function (g) {
        return '<ul class="list gap0 mt4">' + (g ? '<li><div class="ulabel">' + esc(g) + '</div></li>' : '') +
          byGroup[g].map(function (r) {
            var bits = ['Skill ' + r.s.code, plural(r.n, 'card'), r.known.toLocaleString() + ' known'];
            if (r.due) bits.push(r.due.toLocaleString() + ' due');
            return '<li><button class="skrow" data-go="#/study/' + deckId + '/s:' + encodeURIComponent(r.s.code) + '">' +
              '<span class="skk num">' + esc(bits.join(' · ')) + '</span>' +
              '<span class="skn">' + esc(r.s.short || r.s.name) + '</span>' +
              (r.s.short ? '<span class="skc">' + esc(r.s.name) + '</span>' : '') + '</button></li>';
          }).join('') + '</ul>';
      }).join('')
    );
  }

  /* ==========================================================================
     RECALL — a topic's free recall. Writing down everything you remember
     before looking is the strongest form of retrieval there is; then the
     topic's own cards are the checklist, and whatever the recall missed is
     dealt as a session at once, while the gap is fresh.
     ========================================================================== */
  var RECALL_ASK = {
    chem: 'the terms, the relationships, the equations, an example of each',
    calcbc: 'the definitions, the theorems and their conditions, the formulas, an example',
    apush: 'the people, the events, the causes and effects, the dates',
    lang: 'the terms, the moves a writer makes, an example of each',
    french: 'the words, the expressions, the cultural examples',
    _: 'the terms, the causes, the examples'
  };
  var recallState = null;
  var pendingDeal = null;   // a queue handed to the next session the router starts
  function recallCards(d, unitId, topic) {
    var cs = d.cards.filter(function (c) { return c.u === unitId && (c.t || '') === topic && c.y !== 'd'; });
    var core = cs.filter(function (c) { return c.c && c.y !== 'j'; }),
        plain = cs.filter(function (c) { return !c.c && c.y !== 'j'; }),
        why = cs.filter(function (c) { return c.y === 'j'; });
    return core.concat(plain, why).slice(0, 12);
  }
  function firstSentence(a) {
    var t = T.plain(a || '');
    var m = t.match(/^(.{20,220}?[.!?])(\s|$)/);
    if (m) return m[1];
    if (t.length <= 220) return t;
    var cut = t.slice(0, 220), at = Math.max(cut.lastIndexOf('; '), cut.lastIndexOf(', '));
    return (at > 80 ? cut.slice(0, at) : cut.replace(/\s+\S*$/, '')) + '…';
  }
  function viewRecall(deckId, unitId, topic) {
    var d = S.getDeck(deckId);
    if (!d) return go('#/');
    var u = d.unitById[unitId];
    if (!u) return goReplace('#/d/' + deckId);
    var cards = recallCards(d, unitId, topic);
    if (!cards.length) return goReplace('#/d/' + deckId + '/u/' + unitId);
    var key = deckId + '/' + unitId + '/' + topic;
    if (!recallState || recallState.key !== key) recallState = { key: key, text: '', checked: false, had: {} };
    var tp = (u.topics || []).filter(function (x) { return x.c === topic; })[0];
    var title = tp && tp.t ? tp.t : topicTitle(u, topic);
    var codes = tp ? [cedCode(tp.c), skillWord(tp.s)].filter(Boolean).join(' · ') : '';
    var hero = '<div class="head">' + (codes ? '<span class="k">' + esc(codes) + '</span>' : '') +
      '<h1 class="uhead">' + esc(title) + '</h1>';
    if (!recallState.checked) {
      mount(
        backbar(u.title) + hero +
        '<div class="sub">Write down everything you remember about it: ' + esc(RECALL_ASK[deckId] || RECALL_ASK._) +
        '. Then check it against the topic.</div></div>' +
        '<textarea class="recallin" id="recallin" rows="7" placeholder="Everything you remember"' +
        ' aria-label="' + esc('Everything you remember about ' + title) + '">' + esc(recallState.text) + '</textarea>' +
        '<button class="act" data-recall-check>Check</button>' +
        '<div class="actsub">' + esc(plural(cards.length, 'point')) + ' to check it against</div>'
      );
      var ta = document.getElementById('recallin');
      if (ta) ta.addEventListener('input', function () { recallState.text = ta.value; });
      return;
    }
    var missed = cards.filter(function (c) { return !recallState.had[c.i]; }).length;
    var keepScroll = !!recallState.keep; recallState.keep = false;
    mount(
      backbar(u.title) + hero +
      '<div class="sub">Tap each point your recall covered. The rest are dealt as a session.</div></div>' +
      (recallState.text.trim() ? '<div class="recallecho">' + esc(recallState.text.trim()) + '</div>' : '') +
      (missed
        ? '<button class="act" data-recall-go>Study the ' + esc(plural(missed, 'point')) + ' you missed</button>'
        : '<div class="sub">You had every point.</div>') +
      '<ul class="list tight still mt4">' + cards.map(function (c) {
        var had = !!recallState.had[c.i];
        return '<li><button class="qrow rcrow' + (had ? ' done' : '') + '" data-recall-had="' + c.i + '" aria-pressed="' + had + '">' +
          '<span class="qq">' + T.html(c.q) + '</span>' +
          '<span class="qa">' + esc(firstSentence(c.a)) + '</span>' +
          '<span class="qmeta">' + (had ? 'Had it' : 'Not in my recall') + '</span></button></li>';
      }).join('') + '</ul>' +
      '<button class="textbtn" data-recall-again>Write it again</button>',
      keepScroll ? { keepScroll: true } : undefined
    );
  }
  function recallClick(t) {
    if (!recallState) return false;
    if (t.closest('[data-recall-check]')) {
      var ta = document.getElementById('recallin');
      if (ta) recallState.text = ta.value;
      recallState.checked = true; route(); return true;
    }
    var h = t.closest('[data-recall-had]');
    if (h) {
      var id = h.getAttribute('data-recall-had');
      recallState.had[id] = !recallState.had[id];
      recallState.keep = true; route();
      var again = document.querySelector('[data-recall-had="' + id + '"]');
      if (again) { try { again.focus({ preventScroll: true }); } catch (e) {} }
      return true;
    }
    if (t.closest('[data-recall-again]')) {
      recallState = { key: recallState.key, text: '', checked: false, had: {} }; route(); return true;
    }
    if (t.closest('[data-recall-go]')) {
      var p = recallState.key.split('/'), d = S.getDeck(p[0]);
      var topic = recallState.key.slice(p[0].length + p[1].length + 2);
      var list = recallCards(d, p[1], topic).filter(function (c) { return !recallState.had[c.i]; });
      if (!list.length) return true;
      // the topic drill deals these and only these; a deal paused on that
      // drill earlier would otherwise be resumed in their place
      var dh = '/study/' + p[0] + '/t:' + encodeURIComponent(topic) + '/' + p[1];
      var m = sessMap(); delete m[dh]; writeSessMap(m);
      pendingDeal = { h: dh, ids: list.map(function (c) { return c.i; }) };
      go('#' + dh);
      return true;
    }
    return false;
  }

  /* the unit a card or question leans on — or, for a Connections card, the
     units it links */
  function borrowWord(d, b) {
    var ids = String(b).split(',');
    var names = ids.map(function (id) {
      var u = d && d.unitById[id];
      return u ? (u.n != null ? String(u.n) : u.title) : id;
    });
    if (ids.length === 1) return 'Borrows from Unit ' + names[0];
    return 'Links Units ' + names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }


  /* ==========================================================================
     AFTER A MISS — a missed fact is dealt its reason. When an ordinary card
     gets Again, the explain-why of the same topic takes the place of a new
     card waiting at the end of the deal, a few cards on: the denominator
     stays where it was, once per topic per session, and never in a cram, a
     quiz or a deal with nothing new to give up.
     ========================================================================== */
  function followUp(c) {
    if (!sess || sess.quiz || sess.cram || c.y === 'j' || c.y === 'd' || !c.t) return;
    sess.fu = sess.fu || {}; sess.fuIds = sess.fuIds || {};
    var key = c.u + '|' + c.t;
    if (sess.fu[key]) return;
    var d = cardDeckOf(c); if (!d) return;
    var inQ = {}; sess.queue.forEach(function (x) { inQ[x.i] = 1; });
    var seen = {}; (sess.history || []).forEach(function (h) { seen[h.card.i] = 1; });
    var j = d.cards.filter(function (x) {
      return x.y === 'j' && x.u === c.u && x.t === c.t && !inQ[x.i] && !seen[x.i] && !S.isKnown(x.i);
    })[0];
    if (!j) return;
    // the slot: the last card still waiting that is new and has not been missed
    for (var n = sess.queue.length - 1; n >= 5; n--) {
      var q = sess.queue[n];
      if (S.isNew(q.i) && !sess.lapsed[q.i] && q.i !== c.i) {
        sess.queue.splice(n, 1);
        sess.queue.splice(Math.min(5, sess.queue.length), 0, j);
        sess.fu[key] = 1; sess.fuIds[j.i] = 1;
        return;
      }
    }
  }

  /* ==========================================================================
     EXAM MIX — the exam samples every unit by its weight, so this does too:
     each card's unit is drawn in proportion to the CED's weight (the middle
     of its range; equal shares where the CED gives none), and within the unit
     a due card comes first, then a seen one soonest due, then a new one.
     ========================================================================== */
  function mixUnits(d) {
    return d.units.filter(function (u) { return u.topics && u.topics.length && u.id !== 'x'; });
  }
  function examMix(d) {
    var units = mixUnits(d), today = S.dayNum(), lim = S.getSettings().sessionSize || 20;
    var w = units.map(function (u) {
      var m = String(u.weight || '').match(/(\d+)\s*[–-]\s*(\d+)\s*%/);
      return m ? (+m[1] + +m[2]) / 2 : 1;
    });
    var pools = units.map(function (u) {
      var due = [], seen = [], fresh = [];
      d.cards.forEach(function (c) {
        if (c.u !== u.id) return;
        if (S.isNew(c.i)) fresh.push(c);
        else if (S.cs(c.i).d <= today) due.push(c);
        else seen.push(c);
      });
      due.sort(function (a, b) { return S.cs(a.i).d - S.cs(b.i).d; });
      seen.sort(function (a, b) { return S.cs(a.i).d - S.cs(b.i).d; });
      return due.concat(seen, S.shuffle(fresh));
    });
    var out = [], guard = 0;
    while (out.length < lim && guard++ < lim * 20) {
      var tot = 0; w.forEach(function (x, n) { if (pools[n].length) tot += x; });
      if (!tot) break;
      var r = Math.random() * tot, n = 0;
      for (; n < w.length; n++) { if (!pools[n].length) continue; r -= w[n]; if (r <= 0) break; }
      if (n >= w.length) n = w.length - 1;
      if (pools[n].length) out.push(pools[n].shift());
    }
    return S.shuffle(out);
  }

  function renderEmptySession(d, unitId, mode) {
    var label = mode === 'starred' ? 'No starred cards yet.' :
                mode === 'stuck' ? 'Nothing is sticking — no card has been missed three times.' :
                mode === 'hard' ? 'No trouble spots — nothing has been missed twice.' :
                'Nothing due here right now.';
    if (mode === 'score') return mount(
      backbar(d.abbr) +
      '<div class="head"><span class="k">' + esc(d.short) + '</span><h1>Nothing to score here</h1>' +
      '<div class="sub">This unit has no answers to judge. The units built from the course framework do.</div></div>' +
      '<button class="act" data-go="#/score/' + d.id + '">Score it across the course</button>'
    );
    mount(
      backbar(d.abbr) +
      '<div class="head"><span class="k">' + esc(d.short) + '</span><h1>All caught up</h1>' +
      '<div class="sub">' + esc(label) + '</div></div>' +
      '<button class="act" data-go="#/study/' + d.id + '/all' + (unitId ? '/' + unitId : '') + '">Study anyway</button>'
    );
  }

  function cardDeckOf(c) { return S.getDeck(c.deck); }
  /* how many distinct cards are still waiting to come round again */
  function redoLeft() {
    if (!sess || !sess.lapsed) return 0;
    var n = 0;
    sess.queue.forEach(function (c) { if (sess.lapsed[c.i]) n++; });
    return n;
  }

  function sessTop(c) {
    // One small label line: scope on the left, position on the right (skill §4.3).
    var d = c ? cardDeckOf(c) : sess.deck;
    var unit = c && d ? d.unitById[c.u] : null;
    // a grammar point's deal is named for the point, not for the unit each card sits in
    var fp = sess.deck && !sess.mixed ? focusOf(sess.deck, sess.unitId) : null;
    // never truncated, and it names the CED topic the card comes from
    var ced = c && c.t && /^\d+\.\d+$/.test(c.t) ? ' · CED ' + c.t : '';
    // a skill's deal is named for the skill: its cards come from every unit
    var sk = sess.deck && sess.deck.skills && String(sess.mode || '').indexOf('s:') === 0
      ? sess.deck.skills.filter(function (x) { return x.code === decodeURIComponent(sess.mode.slice(2)); })[0] : null;
    var scope = d ? nice(d) + (sk ? ' · Skill ' + sk.code + ' · ' + (sk.short || sk.name) : fp ? ' · ' + fp.title : unit ? ' · ' + unit.title : '') + (sess.just ? ' · Justify' : '') + (sess.score ? ' · Score it' : '') + ced : 'Review';
    return '<div class="sess-top">' +
      '<span class="scope">' + esc(scope) + '</span>' +
      '<span class="pos num">' + Math.min(sess.done + 1, sess.planned).toLocaleString() + ' of ' + sess.planned.toLocaleString() +
        (redoLeft() ? '<span class="redo"> · ' + redoLeft() + ' to redo</span>' : '') + '</span>' +
      '</div>';
  }
  // Done / Undo / Star as quiet text — the affordances survive, the chrome does not.
  function sessUtil(starred) {
    return '<div class="sess-util">' +
      // an unlabelled X twelve pixels under the grade row ended sessions by
      // accident and read as decoration; it says the word it means
      '<button class="sizebtn exit" data-exit>Done</button>' +
      // in quiz mode undo can only take back the just-given answer — the
      // control shows exactly when it can act
      // Undo holds its slot from the first card on. Appearing only from card
      // two put the star where undo now sits, so the spot that starred a card
      // a moment ago un-graded one instead.
      '<button class="iconbtn' + (sess.history.length && (!sess.quiz || sess.answered) ? '' : ' ghost') +
        '" data-undo aria-label="Undo"' +
        (sess.history.length && (!sess.quiz || sess.answered) ? '' : ' disabled aria-hidden="true"') +
        '><svg><use href="#i-undo"/></svg></button>' +
      (starred != null ? '<button class="iconbtn" data-star aria-label="Star" aria-pressed="' + starred + '">' +
        '<svg><use href="#i-star' + (starred ? '-fill' : '') + '"/></svg></button>' : '') +
      // your own words on this card — the word says whether there are any yet
      (sess.queue.length ? '<button class="sizebtn" data-note>' +
        (S.noteOf(sess.queue[0].i) ? 'Note ·' : 'Note') + '</button>' : '') +
      // the mode word changes THIS session only — Settings owns the default
      (sess.score ? '' : '<button class="sizebtn" data-qmode>' + (sess.quiz ? 'Choices' : (sess.typing ? 'Typing' : 'Flip')) + '</button>') +
      '</div>';
  }

  /* Your own words on a card. It shows on the back, under whatever the deck
     had to say, and the same "Note" control opens it for editing. The field is
     written into the rendered card and never re-rendered while you type — a
     repaint per keystroke would lose the caret every time. */
  function noteHTML(c) {
    if (sess && sess.noting) {
      return '<div class="mynote editing reveal"><textarea id="mynote" aria-label="Your note on this card" rows="2" maxlength="' +
        (S.NOTE_MAX || 400) + '" placeholder="Your own words: a mnemonic, the trap you keep hitting">' +
        esc(S.noteOf(c.i)) + '</textarea>' +
        '<div class="noteacts"><button class="textbtn quiet" data-note-save>Save</button>' +
        '<button class="textbtn quiet" data-note-cancel>Cancel</button></div></div>';
    }
    var n = S.noteOf(c.i);
    return n ? '<div class="mynote reveal">' + esc(n) + '</div>' : '';
  }

  function openNote() {
    if (!sess || !sess.queue.length) return;
    if (sess.quiz && !sess.answered) return;
    if (!sess.revealed && !sess.quiz) reveal();     // there is nothing to annotate face-down
    sess.noting = true;
    renderCard();
    var ta = document.getElementById('mynote');
    if (ta) try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
  }
  function closeNote(save) {
    if (!sess) return;
    var ta = document.getElementById('mynote');
    var txt = ta ? ta.value : '';
    if (save && ta && sess.queue.length) S.setNote(sess.queue[0].i, txt);
    sess.noting = false;
    renderCard();
    if (save) toast(txt.trim() ? 'Noted' : 'Note cleared');
  }

  /* the card's own history in a phrase, beside its topic: why it is here today */
  function histWord(c) {
    var st = S.cs ? S.cs(c.i) : null;
    if (!st || !(st.r || st.t || st.l)) return 'First time';
    if (st.r) return st.r + ' in a row';
    return st.l ? 'Missed ' + st.l + (st.l === 1 ? ' time' : ' times') : '';
  }
  function metaHTML(c) {
    var bits = [sess && sess.fuIds && sess.fuIds[c.i] ? 'After a miss' : '', topicLabel(c), codeLabel(c), histWord(c)].filter(Boolean);
    return bits.length ? '<div class="meta reveal">' + esc(bits.join(' · ')) + '</div>' : '';
  }
  /* the CED codes a card answers to, its suggested skill, and the unit it
     borrows from when the question leans on another unit */
  function codeLabel(c) {
    // the topic already names an EK when the topic is one (Lang's RHS-1.A)
    var bits = (c.k || []).filter(function (k) { return k !== c.t; });
    if (c.s) bits.push(skillWord(c.s));
    if (c.b) bits.push(borrowWord(cardDeckOf(c), c.b));
    return bits.join(' · ');
  }
  /* an explain-why card carries, under its answer, the other valid ways to
     argue the point and the answers that earn nothing */
  function jxHTML(c) {
    if (c.y !== 'j') return '';
    var out = '';
    if (c.o && c.o.length) out += '<div class="jx reveal"><div class="jl">Other ways to argue it</div><ul>' +
      c.o.map(function (t) { return '<li>' + T.html(t) + '</li>'; }).join('') + '</ul></div>';
    if (c.w && c.w.length) out += '<div class="jx reveal"><div class="jl">Loses the point</div><ul>' +
      c.w.map(function (x) { return '<li>' + T.html(x.a || x) + (x.why ? ' <span class="jw">' + T.html(x.why) + '</span>' : '') + '</li>'; }).join('') + '</ul></div>';
    return out;
  }
  function topicLabel(c) {
    if (!c.t) return c.c ? 'High-yield' : '';
    var t = /^\d+\.\d+$/.test(c.t) ? 'CED ' + c.t : c.t;
    // a unit that carries its CED topics names a context by its title, not its slug
    var d = cardDeckOf(c), tp = d && d.unitById && topicOf(d.unitById[c.u], c.t);
    if (tp && !/^\d+\.\d+$/.test(c.t)) t = cedCode(c.t) ? c.t + ' · ' + tp.t : tp.t;
    return t + (c.c ? ' · High-yield' : '');
  }
  function sizeClass(s) {
    var n = T.plain(s).length;
    return (n > 360 ? ' tiny' : n > 90 ? ' small' : '') + (stacked(s) ? ' mathy' : '');
  }
  /* stacked math (fractions, bounded operators) needs the extra leading */
  function stacked(s) {
    var h = T.html(s);
    return h.indexOf('mfrac') > -1 || h.indexOf('class="lim"') > -1 || h.indexOf('munder') > -1;
  }
  function longish(s) { return T.plain(s).length > 90; }

  function renderCard() {
    if (!sess || !sess.queue.length) { clearSess(); return renderDone(); }
    var c = sess.queue[0];
    curDeckId = sess.deck ? sess.deck.id : null;
    var d = cardDeckOf(c);
    var unit = d.unitById[c.u];
    var starred = S.isStarred(c.i);
    var settings = S.getSettings();

    if (sess.quiz) return renderQuizCard(c, d, unit);

    var body =
      '<div class="q' + sizeClass(c.q) + '">' + T.html(c.q) + '</div>' +
      // a hint given unasked is the answer half-spoiled — it waits for the tap
      (!sess.revealed && c.h ? (sess.hinted
        ? '<div class="hint" id="cardhint" role="note">' + T.html(c.h) + '</div>'
        : '<button class="hint-btn" data-hint aria-expanded="false" aria-controls="cardhint">Hint</button>') : '');

    if (!sess.revealed) {
      // the prompt itself is the tap; no "Tap to reveal" caption (skill §8)
      if (sess.typing) body += '<div class="typewrap"><input class="typein" id="typein" aria-label="Type the answer" autocomplete="off" autocorrect="off" ' +
          'autocapitalize="none" spellcheck="false" placeholder="' +
          (typeable(c) ? 'Type your answer' : 'Type what you can') + '"></div>';
    } else {
      body += '<div class="rule reveal"></div>' +
        '<div class="a reveal' + sizeClass(c.a) + '">' + T.html(c.a) + '</div>' +
        (sess.verdict ? '<div class="verdict reveal ' +
          (sess.verdict.ok === 'miss' && !typeable(c) ? 'long' : sess.verdict.ok) + '">' +
          esc(sess.verdict.ok === 'miss' && !typeable(c) ? 'Too long to type. Grade yourself'
              : sess.verdict.text) + '</div>' : '') +
        (c.n ? '<div class="note reveal' + (stacked(c.n) ? ' mathy' : '') + '">' + T.html(c.n) + '</div>' : '') +
        jxHTML(c) +
        noteHTML(c) +
        metaHTML(c);
    }

    // the answer rises in once, when it is first shown; a star, a hint or a
    // note typed under it re-renders the card and used to run it again
    var visit = sess.done + ':' + c.i;
    var fresh = sess.revealed && sess.revealDrawn !== visit;
    if (sess.revealed) sess.revealDrawn = visit;

    // grades in the flow, as text; the recommended grade is the heavier ink —
    // and after a scored miss the recommendation is Again, not Good
    var footer = sess.revealed
      ? '<div class="rate' + (sess.verdict && sess.verdict.ok === 'miss' && typeable(c) ? ' miss' : '') + '">' +
          // Four grades, the standard set. There was no honest button for
          // "I got it, but only just": Again buries a card you did know and
          // Good sends one you half-knew a fortnight away.
          gradeBtn(c, 0, 'again', 'Again', 'A') +
          gradeBtn(c, 1, 'hard', 'Hard', 'S') +
          gradeBtn(c, 2, 'good', 'Good', 'D') +
          gradeBtn(c, 3, 'easy', 'Easy', 'F') +
        '</div>'
      : '<div class="rate"><button class="r-good" data-reveal><span class="lab">Show answer</span><span class="when kbd">space</span></button></div>';

    mount(
      '<div class="session">' + sessTop(c) +
      '<div class="cardstage">' +
        // the hints are painted feedback for a drag in progress — a screen
        // reader was announcing both of them ahead of every question
        '<span class="swipehint l" aria-hidden="true">Again</span>' +
        '<span class="swipehint r" aria-hidden="true">Good</span>' +
        // only a NEW card enters; revealing used to re-run the animation, so
        // the question you were reading blinked out and jumped 10px
        '<div class="cardwrap"><div class="card' + (sess.revealed ? (fresh ? ' fresh' : '') : ' enter') + '" id="card"' +
          ' role="group" aria-live="polite" aria-atomic="false"' +
          ' aria-label="' + esc('Card ' + (sess.done + 1) + ' of ' + sess.planned) + '">' + body + '</div></div>' +
      '</div><div class="morecue" aria-hidden="true">' + CHEV + '</div>' + footer + sessUtil(starred) + '</div>',
      { session: true }
    );
    wireCard();
  }

  function renderQuizCard(c, d, unit) {
    if (sess.score) return renderScoreCard(c);
    if (!sess.choices) sess.choices = makeChoices(c, d);
    var starred = S.isStarred(c.i);
    var body =
      '<div class="q' + sizeClass(c.q) + '">' + T.html(c.q) + '</div>' +
      '<div class="choices">' + sess.choices.map(function (ch, n) {
        var state = '';
        if (sess.answered) {
          state = ch.correct ? 'right' : (n === sess.picked ? 'wrong' : 'mute');
        }
        var why = sess.answered && ch.correct && c.n
          ? '<span class="why">' + T.html(c.n) + '</span>' : '';
        // long prose options drop a size so four of them still read as
        // options under the question, not four paragraphs over it
        var cls = (stacked(ch.text) ? ' mathy' : '') + (T.plain(ch.text).length > 110 ? ' small' : '');
        return '<button class="choice' + cls + '" data-pick="' + n + '" data-letter="' + 'ABCD'.charAt(n) + '" style="--i:' + n + '"' + (state ? ' data-state="' + state + '"' : '') +
          (sess.answered ? ' disabled' : '') + '>' + T.html(ch.text) + why + '</button>';
      }).join('') + '</div>';

    var footer = sess.answered
      ? '<div class="rate"><button class="r-good" data-next><span class="lab">Next</span></button></div>'
      : '';

    mount(
      '<div class="session">' + sessTop(c) +
      '<div class="cardstage"><div class="cardwrap"><div class="card' + (sess.answered ? '' : ' enter') + '" id="card"' +
        ' role="group" aria-live="polite" aria-atomic="false"' +
        ' aria-label="' + esc('Card ' + (sess.done + 1) + ' of ' + sess.planned) + '">' + body + '</div></div></div>' +
      '<div class="morecue" aria-hidden="true">' + CHEV + '</div>' +
      footer + sessUtil(starred) + '</div>', { session: true, quiz: true });
    wireCard();
  }

  /* A distractor drawn at random from the unit is usually the answer to a
     visibly different question — one formula among three paragraphs, or a
     chemistry answer under a series question — so the right option can be
     picked off by shape without doing the work. Candidates are ranked by how
     much they LOOK like an answer to this question: same kind of object,
     comparable weight on the page, and vocabulary in common. */
  function ansKind(t) {
    if (t.indexOf('$') > -1) return 'math';
    if (/^[\u2212+-]?[\d.,/\s\u00d7^%]+$/.test(t.trim())) return 'num';
    return 'prose';
  }
  function toks(s) {
    return T.plain(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
      .filter(function (w) { return w.length > 3; });
  }
  function overlap(a, b) {
    if (!a.length || !b.length) return 0;
    var set = {}, n = 0;
    b.forEach(function (w) { set[w] = 1; });
    a.forEach(function (w) { if (set[w]) n++; });
    return n / Math.sqrt(a.length * b.length);
  }
  function makeChoices(c, d) {
    // an explain-why card knows its own wrong answers: the ones that earn
    // nothing on the rubric are better distractors than any other card's answer
    if (c.y === 'j' && c.w && c.w.length >= 3) {
      var weak = S.shuffle(c.w.slice()).slice(0, 3).map(function (x) { return { text: trim(x.a || x), correct: false }; });
      weak.push({ text: trim(c.a), correct: true });
      return S.shuffle(weak);
    }
    var pool = d.cards.filter(function (x) { return x.u === c.u && x.i !== c.i && x.v === c.v; });
    if (pool.length < 3) pool = d.cards.filter(function (x) { return x.u === c.u && x.i !== c.i; });
    if (pool.length < 3) pool = d.cards.filter(function (x) { return x.i !== c.i; });
    var right = trim(c.a), rk = ansKind(right), rl = right.length || 1;
    var qt = toks(c.q), at = toks(c.a);
    var seen = {}; seen[right] = 1;
    var scored = [];
    pool.forEach(function (x) {
      var t = trim(x.a);
      if (seen[t]) return;                     // never two identical options
      seen[t] = 1;
      var sc = 0;
      if (ansKind(t) === rk) sc += 3;          // no lone paragraph among formulas
      sc += 2 * Math.min(t.length, rl) / Math.max(t.length, rl);
      sc += 2.5 * overlap(toks(x.a), at);      // about the same objects
      sc += 2 * overlap(toks(x.q), qt);        // about the same question
      scored.push({ t: t, s: sc + Math.random() * 0.5 });   // ties deal differently
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    // shuffle within the plausible band so a deck does not always show the
    // same three wrong answers under the same card
    var picks = S.shuffle(scored.slice(0, Math.max(3, Math.min(10, scored.length)))).slice(0, 3);
    var out = picks.map(function (x) { return { text: x.t, correct: false }; });
    out.push({ text: right, correct: true });
    return S.shuffle(out);
  }
  function trim(a) {
    // an option cut mid-sentence is unanswerable — show whole answers; only a
    // rare outlier is cut, at a sentence end, and math is never sliced open
    var t = String(a);
    if (t.length <= 400 || /[\\$^_{}]/.test(t)) return t;
    var cut = t.slice(0, 430);
    var s = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
    if (s > 200) return cut.slice(0, s + 1);
    return cut.slice(0, 400).replace(/\s+\S*$/, '') + '…';
  }

  /* ---- interaction ------------------------------------------------------ */
  function wireCard() {
    var card = document.getElementById('card');
    if (!card) return;
    var wrap = card.parentNode;

    if (!sess.quiz && !sess.revealed) {
      // the whole stage flips the card, not just the text block inside it —
      // two thirds of what looks like the card was inert
      var stage = card.closest('.cardstage') || card;
      stage.addEventListener('click', function (e) {
        if (e.target.closest('[data-star]') || e.target.closest('input') || e.target.closest('[data-hint]')) return;
        reveal();
      });
    }
    var note = document.getElementById('mynote');
    if (note) {
      note.addEventListener('keydown', function (e) {
        // Escape here means "never mind this note", not "leave the session";
        // Enter saves, shift+Enter is a second line
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeNote(false); return; }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); closeNote(true); }
      });
      // the whole stage flips the card — a tap in the field must not do that
      note.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    var input = document.getElementById('typein');
    if (input) {
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
      input.addEventListener('keydown', function (e) {
        // the field is autofocused, so Escape here used to end the session —
        // the first press clears what you typed, as it does in the note
        if (e.key === 'Escape' && input.value) {
          e.stopPropagation(); e.preventDefault(); input.value = ''; return;
        }
        if (e.key === 'Enter') { e.preventDefault(); sess.typed = input.value; reveal(); }
      });
    }
    if (sess.revealed && !sess.quiz) attachSwipe(wrap);

    // a card taller than the stage was simply cut — the fourth option of an
    // MCQ could be off-screen with nothing saying to scroll
    var stage = card.closest('.cardstage');
    // …and on a short screen the answer could be cut off ENTIRELY while the
    // three grade words stayed pinned and tappable. Revealing now brings the
    // answer to the top of whatever room there is, in the stage or in the page.
    if (sess.revealed && !sess.quiz) {
      var rule = card.querySelector('.rule.reveal');
      if (rule) requestAnimationFrame(function () {
        var sc = stage && stage.scrollHeight - stage.clientHeight > 4 ? stage : null;
        if (sc) { sc.scrollTop = Math.max(0, rule.offsetTop - 8); return; }
        // the page is the scroller (short window, or a game-style block layout)
        var page = document.getElementById('app');
        if (page && page.scrollHeight - page.clientHeight > 4) {
          var top = rule.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop;
          page.scrollTop = Math.max(0, top - 12);
        }
      });
    }
    if (stage) {
      var host = stage.closest('.session') || stage;
      var flag = function () {
        var over = stage.scrollHeight - stage.clientHeight;
        host.classList.toggle('more', over > 4 && stage.scrollTop < over - 4);
      };
      stage.addEventListener('scroll', flag, { passive: true });
      flag();
      requestAnimationFrame(flag);
    }
  }

  function normalize(s) {
    return T.plain(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  /* Typing mode only where typing is possible. Nine answers in ten run past
     eighty characters — a whole worked FRQ, a paragraph of French — and no
     one types those on a phone. Every attempt scored a miss, a miss
     recommends Again, Again logs a lapse, and lapses drive Trouble spots and
     Weak spots: turning on a documented setting quietly corrupted the
     student's own picture of what they were bad at. Long answers flip. */
  var TYPE_MAX = 60;
  function typeable(c) {
    if (!c) return false;
    var a = T.plain(c.a || '');
    if (a.length <= TYPE_MAX) return true;
    // a long answer with a short accepted alias is still typeable
    return (c.x || []).some(function (alt) { return T.plain(alt || '').length <= TYPE_MAX; });
  }

  function checkTyped(c, typed) {
    if (!typed || !typed.trim()) return null;
    var got = normalize(typed);
    var targets = [c.a].concat(c.x || []);
    for (var i = 0; i < targets.length; i++) {
      var want = normalize(targets[i]);
      if (!want) continue;
      if (got === want) return { ok: 'hit', text: 'Exact' };
      // a prefix only counts when it covers most of the answer — two words
      // of a long sentence is not knowing it. Prefixes are judged HERE only,
      // never re-admitted by the looser substring rule below.
      if (want.indexOf(got) === 0) {
        if (got.length >= Math.min(want.length, Math.max(6, Math.ceil(want.length * 0.6)))) {
          return { ok: 'hit', text: 'Close enough' };
        }
        continue;
      }
      if (got.indexOf(want) > -1 || want.indexOf(got) > 0) {
        var ratio = Math.min(got.length, want.length) / Math.max(got.length, want.length);
        if (ratio > 0.55) return { ok: 'hit', text: 'Close enough' };
      }
    }
    var t60 = typed.trim();
    return { ok: 'miss', text: 'you wrote "' + (t60.length > 60 ? t60.slice(0, 59) + '\u2026' : t60) + '"' };
  }

  /* was `t` less than `ms` ago? A negative delta means the clock moved
     backwards under us, which is not a recent gesture — it is a broken one. */
  function recent(t, ms) { var d = Date.now() - (t || 0); return d >= 0 && d < ms; }
  function reveal() {
    if (!sess || sess.revealed) return;
    // …and the mirror: grading, then the same double tap flipping the next
    // card's answer before its question has been read
    // a backwards clock — an NTP correction of sixty seconds is enough —
    // made this delta negative, so the guard held for ever and no card would
    // turn over or grade again. Only a real, forward, recent gesture blocks.
    if (recent(sess.gradedAt, 320)) return;
    var c = sess.queue[0];
    if (sess.typing) {
      var input = document.getElementById('typein');
      var typed = input ? input.value : sess.typed;
      // typing nothing is not knowing it — the shortcut must never grade
      // an unattempted card as Good
      sess.verdict = checkTyped(c, typed) || { ok: 'miss', text: 'Nothing typed' };
      if (input) try { input.blur(); } catch (e) {}
    }
    sess.revealed = true;
    sess.revealedAt = Date.now();
    renderCard();
  }

  /* Cram is practice: a pass on an already-scheduled card writes nothing (see
     doGrade). The caption knew nothing about that guard, so Good and Easy
     advertised "2 mo" on a card whose due date would not move a single day. */
  // the last day a card may be scheduled for and still be seen before its exam
  function examCap(c) {
    var e = examDayNum(c.deck);
    return e ? e - 1 : 0;
  }
  function passWord(c, g) {
    if (sess && sess.cram && !S.isNew(c.i) && !S.isDue(c.i)) return 'stays';
    return S.preview(c.i, g, examCap(c));
  }
  /* One grade button. The line under the word is the key on a keyboard and
     the day the card comes back on a phone — the same slot, and only one of
     them shows: "1 d" under four words meant nothing to anyone, and where a
     keyboard exists the home row is the fast way through a session. The day
     still rides along, in the tooltip and in the name a screen reader says. */
  function backWord(w) {
    return w === 'now' ? 'back in this session' : w === 'today' ? 'back today'
      : w === 'stays' ? 'stays where it is' : 'back in ' + w;
  }
  function gradeBtn(c, g, cls, word, key) {
    var when = g === 0 ? S.preview(c.i, 0) : passWord(c, g);
    return '<button class="r-' + cls + '" data-grade="' + g + '" title="' + esc(word + ' \u2014 ' + backWord(when)) + '"' +
      ' aria-label="' + esc(word + ', ' + backWord(when) + ', key ' + key) + '">' +
      '<span class="lab">' + word + '</span>' +
      '<span class="when ivl">' + esc(when) + '</span>' +
      '<span class="when kbd">' + key + '</span></button>';
  }

  function doGrade(g) {
    if (!sess || !sess.revealed) return;
    // "Show answer" and "Again" overlap: a double tap used to reveal and grade
    // in one gesture, with the answer never on screen. The keyboard already
    // guarded this; the finger did not.
    if (recent(sess.revealedAt, 320)) return;
    var c = sess.queue.shift();
    var before = S.cs(c.i) ? JSON.parse(JSON.stringify(S.cs(c.i))) : null;
    // cram is practice: a pass must not shove a well-timed card into the
    // future, but a miss is real information and new or due cards earn grades
    var wrote = !sess.cram || g === 0 || S.isNew(c.i) || S.isDue(c.i);
    if (wrote) S.grade(c.i, g, examCap(c));
    sess.history.push({ card: c, before: before, g: g, rq: g === 0, wrote: wrote, day: S.dayNum() });
    // the grade landed and the card has a next date — say both, once, and
    // read the date off what the schedule ACTUALLY did rather than previewing
    // it again from a state the grade above has already moved
    var now2 = S.cs(c.i), inDays = now2 ? now2.d - S.dayNum() : 0;
    announce(['Again', 'Hard', 'Good', 'Easy'][g] + ' \u2014 ' +
      (g === 0 ? 'back in this session'
        : !wrote ? 'staying where it was'
        : inDays <= 0 ? 'back today' : 'back in ' + plural(inDays, 'day')));
    if (g === 0) {
      // THE DENOMINATOR DOES NOT MOVE. It used to: every Again added one, so
      // thirty honest Agains walked "1 of 20" to "31 of 50" and the session
      // could not end. Pressing the button that means "I did not know this"
      // must not extend the session, or the app teaches you to press Good.
      // …and the count beside the position is the number of CARDS waiting to
      // come back, not the number of times Again has been pressed: five cards
      // missed a dozen times each read "60 to redo" on a twenty-card session
      sess.again++;
      sess.lapsed[c.i] = 1;
      sess.done--;                    // a re-queued card is not done yet
      sess.queue.splice(Math.min(4, sess.queue.length), 0, c);
      followUp(c);
    }
    else if (g === 1) sess.hard++;
    else if (g === 2) sess.good++;
    else sess.easy++;
    sess.done++;
    sess.revealed = false; sess.verdict = null; sess.typed = ''; sess.hinted = false;
    sess.gradedAt = Date.now();
    saveSess();
    renderCard();
  }

  function undo() {
    if (!sess || !sess.history.length) return;
    if (sess.quiz) {
      // in quiz mode, undo takes back the answer you just gave
      if (!sess.answered) return;
      var hq = sess.history.pop();
      if (hq.wrote !== false) S.restore(hq.card.i, hq.before, hq.day);
      if (hq.g === 1) sess.right = Math.max(0, sess.right - 1);
      else sess.wrong = Math.max(0, sess.wrong - 1);
      sess.answered = false; sess.picked = -1;
      S.save(true);
      // the region was left holding the sentence for the answer just taken
      // back — the only spoken statement on screen, and now false
      announce('Undone \u2014 answer taken back');
      renderCard(); return;
    }
    var h = sess.history.pop();
    // pull the card back out of the queue if "Again" re-queued it
    for (var i = 0; i < sess.queue.length; i++) {
      if (sess.queue[i].i === h.card.i) { sess.queue.splice(i, 1); break; }
    }
    if (h.wrote !== false) S.restore(h.card.i, h.before, h.day);   // a cram pass never wrote
    sess.queue.unshift(h.card);
    sess.done = Math.max(0, sess.done - 1);
    // planned only shrinks if this grade actually grew it (a quiz miss bumps
    // planned at Next time, not at answer time — h.rq records the truth)
    if (h.rq) { delete sess.lapsed[h.card.i]; sess.done++; }
    if (h.g === 0) sess.again = Math.max(0, sess.again - 1);
    else if (h.g === 1) sess.hard = Math.max(0, sess.hard - 1);
    else if (h.g === 2) sess.good = Math.max(0, sess.good - 1);
    else sess.easy = Math.max(0, sess.easy - 1);
    // the region was left holding the sentence for the grade just taken back
    announce('Undone \u2014 ' + ['Again', 'Hard', 'Good', 'Easy'][h.g] + ' taken back');
    sess.revealed = true; sess.verdict = null;
    S.save(true);
    saveSess();
    renderCard();
  }

  function pickChoice(n) {
    if (!sess || sess.answered) return;
    sess.picked = n; sess.answered = true;
    var c = sess.queue[0];
    var correct = sess.choices[n] && sess.choices[n].correct;
    var before = S.cs(c.i) ? JSON.parse(JSON.stringify(S.cs(c.i))) : null;
    if (correct) sess.right++; else sess.wrong++;
    // the same cram guard as doGrade — a switched-to-MCQ cram stays honest
    var wrote = !sess.score && (!sess.cram || !correct || S.isNew(c.i) || S.isDue(c.i));
    sess.history.push({ card: c, before: before, g: correct ? 1 : 0, rq: false, wrote: wrote, day: S.dayNum() });
    if (wrote) S.grade(c.i, correct ? 2 : 0, examCap(c));
    renderCard();
    // the result must be seen, not hunted for
    requestAnimationFrame(function () {
      var el = document.querySelector('.choice[data-state="right"]');
      if (el) el.scrollIntoView({ block: 'nearest' });
    });
  }
  function nextQuiz() {
    if (!sess || !sess.answered) return;   // a ghost second tap must be inert
    var c = sess.queue.shift();
    if (!sess.choices[sess.picked] || !sess.choices[sess.picked].correct) {
      sess.lapsed[c.i] = 1; sess.done--;   // the miss comes back — the meter says so
      sess.queue.splice(Math.min(4, sess.queue.length), 0, c);
      var top = sess.history[sess.history.length - 1];
      if (top && top.card.i === c.i) top.rq = true;
    }
    sess.done++; sess.answered = false; sess.picked = -1; sess.choices = null; sess.cand = null; sess.hinted = false;
    saveSess();
    renderCard();
  }

  /* the exit control's one true path, shared with the Escape key — replace,
     so the platform back gesture cannot fall into a dead session */
  function exitSession() {
    // closing a unit's session goes back to that unit, not up to the course —
    // losing your place in Period 3 on the way out is not "back"
    // a mixed review exits to the root: #/review IS the session, so "back to
    // Review" would silently deal another one
    var back = sess && sess.back ? sess.back
      : sess && !sess.mixed && sess.deck ? '#/d/' + sess.deck.id + (sess.unitId ? '/u/' + sess.unitId : '')
      : '#/';
    // the deal is NOT thrown away here: an X twelve pixels under Again, or a
    // back gesture, used to lose your place for good. Opening the same route
    // again today picks it up.
    saveSess();
    sess = null; goReplace(back);
  }

  /* ---- swipe ------------------------------------------------------------ */
  function attachSwipe(wrap) {
    var startX = 0, startY = 0, dx = 0, dy = 0, active = false, id = null;
    var hintL = document.querySelector('.swipehint.l'), hintR = document.querySelector('.swipehint.r');
    wrap.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      active = true; id = e.pointerId; startX = e.clientX; startY = e.clientY; dx = dy = 0;
      wrap.classList.add('swiping'); wrap.classList.remove('settle');
    });
    wrap.addEventListener('pointermove', function (e) {
      if (!active || e.pointerId !== id) return;
      dx = e.clientX - startX; dy = e.clientY - startY;
      if (Math.abs(dx) < Math.abs(dy) - 8) return;
      wrap.style.transform = 'translateX(' + (dx * 0.7) + 'px) rotate(' + (dx * 0.014) + 'deg)';
      if (hintL) hintL.style.opacity = dx < -30 ? Math.min(1, (-dx - 30) / 60) : 0;
      if (hintR) hintR.style.opacity = dx > 30 ? Math.min(1, (dx - 30) / 60) : 0;
    });
    function end(e) {
      if (!active || (e && e.pointerId !== id)) return;
      active = false;
      wrap.classList.remove('swiping'); wrap.classList.add('settle');
      wrap.style.transform = '';
      if (hintL) hintL.style.opacity = 0;
      if (hintR) hintR.style.opacity = 0;
      if (Math.abs(dx) > 92 && Math.abs(dx) > Math.abs(dy)) doGrade(dx < 0 ? 0 : 2);
      else if (dy < -110 && Math.abs(dy) > Math.abs(dx)) starCurrent();
    }
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
  }

  function starCurrent() {
    if (!sess || !sess.queue.length) return;
    var on = S.toggleStar(sess.queue[0].i);
    toast(on ? 'Starred' : 'Unstarred');
    var btn = document.querySelector('[data-star]');
    if (btn) {
      btn.setAttribute('aria-pressed', String(on));
      var use = btn.querySelector('use');
      if (use) use.setAttribute('href', on ? '#i-star-fill' : '#i-star');
    }
  }

  /* ---- session complete -------------------------------------------------- */
  function renderDone() {
    var d = sess.deck;
    var total = sess.done;
    // a session can cross modes — every tally that happened gets a row,
    // so the rows always sum to the hero
    var lines = [];
    if (sess.right || sess.wrong) lines.push(['Correct', sess.right], ['Missed', sess.wrong]);
    if (sess.again || sess.hard || sess.good || sess.easy)
      lines.push(['Again', sess.again], ['Hard', sess.hard || 0], ['Good', sess.good], ['Easy', sess.easy]);
    if (!lines.length) lines = sess.quiz
      ? [['Correct', 0], ['Missed', 0]]
      : [['Again', 0], ['Hard', 0], ['Good', 0], ['Easy', 0]];
    var rows = lines.map(function (l) {
      // a tally is a fact, not a control — it used to be a focusable button
      // with its pointer events switched off, so a keyboard walked three
      // "buttons" that do nothing
      return '<div class="ledger' + (l[1] ? '' : ' done') + '"><span class="lname">' + l[0] +
        '</span><span class="lval num">' + (l[1] || 0).toLocaleString() + '</span></div>';
    }).join('');
    // "Keep going" must know what is left — a mixed review counts every deck
    // …and "what is left" is due cards plus cards never seen. Counting only
    // the due ones said "All caught up" over four thousand untouched cards,
    // and hid the button that would have dealt the next twenty.
    var dueLeft = 0;
    var addLeft = function (dk) { var t = S.deckStats(dk); dueLeft += t.due + Math.max(0, t.total - t.seen); };
    if (d) addLeft(d);
    else S.getIndex().courses.forEach(function (c) {
      var dk = S.getDeck(c.id); if (dk) addLeft(dk);
    });
    var again = sess.mode === 'starred' && sess.mixed ? '#/starred' :
      sess.mixed ? '#/review' :
      sess.mode === 'cram' ? '#/cram/' + d.id + (sess.unitId ? '/' + sess.unitId : '') :
      sess.mode === 'score' ? '#/score/' + d.id + (sess.unitId ? '/' + sess.unitId : '') :
      '#/' + (sess.quiz ? 'quiz' : 'study') + '/' + d.id + '/' + sess.mode + (sess.unitId ? '/' + sess.unitId : '');
    // one line under the number, and it earns its place: caught up beats a
    // milestone streak beats the day's count — never the same rote line
    var stk = S.streak();
    var moment = !dueLeft ? 'All caught up' :
      [3, 7, 14, 21, 30, 50, 75, 100, 150, 200].indexOf(stk) > -1 ? stk.toLocaleString() + '-day streak' :
      // the day log counts grades given, not distinct cards: twenty cards
      // missed and redone read "80 cards today", which is not what happened
      plural(S.studiedToday(), 'review') + ' today';
    // what this deck (or every deck) hands back next: the tallies say what
    // you did, this says what it cost tomorrow and this week
    var today = S.dayNum(), tmrw = 0, week = 0;
    var addBack = function (dk) {
      dk.cards.forEach(function (c) {
        var st = S.cs(c.i); if (!st || !(st.r || st.t || st.l)) return;
        var gap = (st.d || 0) - today;
        if (gap === 1) tmrw++;
        if (gap >= 1 && gap <= 7) week++;
      });
    };
    if (d) addBack(d);
    else S.getIndex().courses.forEach(function (c) { var dk = S.getDeck(c.id); if (dk) addBack(dk); });
    var backRows = (tmrw || week)
      ? '<div class="k" style="margin:var(--s-4) 0 6px">Coming back</div><div class="done-rows">' +
        '<div class="ledger"><span class="lname">Tomorrow</span><span class="lval num">' + tmrw.toLocaleString() + '</span></div>' +
        '<div class="ledger"><span class="lname">This week</span><span class="lval num">' + week.toLocaleString() + '</span></div></div>'
      : '';
    sess = null;
    // the session is over — a reload or a back gesture should land on the
    // deck, not silently deal a brand-new session (no hashchange fires here)
    try { history.replaceState(null, '', location.href.replace(/#.*$/, '') + (d ? '#/d/' + d.id : '#/')); } catch (e) {}
    // a stop between screens: it arrives, and so does whatever comes after it
    lastMountHash = null;
    mount(
      '<div class="done-hero">' +
        '<span class="k">Session complete</span>' +
        '<div class="v">' + total.toLocaleString() + '</div>' +
        '<div class="sub done-sub">' +
          esc(moment) + '</div>' +
      '</div>' +
      '<div class="done-rows">' + rows + '</div>' + backRows +
      (dueLeft ? '<button class="act" data-go="' + again + '">Keep going</button>'
               : '<button class="textbtn" data-go="#/">Courses</button>')
    );
    // the bar comes back with this screen but no hashchange fired — the
    // sliding pill was measured while hidden, so re-seat it once visible
    syncTabs('/');
    pendingDir = '';               // this mount already happened — no stray slide
  }

  /* ==========================================================================
     VIEW · search
     ========================================================================== */
  var searchState = { q: '', deck: null };
  /* Search read every deck, always. That is right by default — a term you
     half-remember rarely comes with its course attached — but during one
     subject's revision the other four are noise. One cycling word, the same
     control the games and the settings use, narrows it. */
  function scopeWord() { return searchState.deck ? nice(searchState.deck) : 'All courses'; }
  function cycleScope() {
    var ids = (S.getIndex().courses || []).map(function (c) { return c.id; });
    var i = searchState.deck ? ids.indexOf(searchState.deck) : -1;
    searchState.deck = i + 1 >= ids.length ? null : ids[i + 1];
  }
  var wantSearchFocus = false;   // "/" was pressed — the next search mount focuses
  /* the "/" shortcut: land on Search with the field focused, the old query
     selected so typing replaces it — never appends to it */
  function goSearchFocus() {
    var q = document.getElementById('q');
    if ((location.hash.replace(/^#/, '') || '/') === '/search' && q) {
      try { q.focus(); q.select(); } catch (e) {}
    } else { wantSearchFocus = true; goTab('/search'); }
  }
  function viewSearch() {
    curDeckId = null;
    // the field and the results — no hero, no scope chips, no instructions (skill §4.4)
    var many = (S.getIndex().courses || []).length > 1;
    mount(
      '<div class="searchbar"><input id="q" type="search" aria-label="Search every card" placeholder="A term, a formula, a year" ' +
        'autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(searchState.q) + '"></div>' +
      (many ? '<div class="scoperow"><button class="textbtn quiet" data-search-scope>' +
        esc(scopeWord()) + '</button></div>' : '') +
      '<div id="results"></div>'
    );
    var input = document.getElementById('q');
    var timer = null;
    input.addEventListener('input', function () {
      searchState.q = input.value;
      clearTimeout(timer); timer = setTimeout(runSearch, 130);
    });
    // only "/" asks for the caret. Arrowing onto the tab used to park focus in
    // the field, where the arrows then belonged to the text and the shortcut
    // was dead; on a phone it also threw the keyboard up unasked.
    if (wantSearchFocus) {
      try { input.focus(); input.select(); } catch (e) {}
    }
    wantSearchFocus = false;
    runSearch();
  }

  /* The search index is 4,870 folded strings. Building it on the first
     keystroke cost 410 ms — a stall exactly where the app should feel
     fastest — so it is built during idle time after the decks land instead,
     in slices short enough not to drop a frame. */
  function hayOf(card) {
    return card._hay || (card._hay = fold(
      (T.plain(card.q) + ' ' + T.plain(card.a) + ' ' + (card.n || '') + ' ' + (card.t || '') + ' ' + (card.k || []).join(' ') + ' ' + (card.s || '')).toLowerCase()));
  }
  function warmSearch() {
    var all = [];
    (S.getIndex().courses || []).forEach(function (c) {
      var d = S.getDeck(c.id); if (d) all = all.concat(d.cards);
    });
    var i = 0;
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 24); };
    (function slice() {
      var end = Date.now() + 6;
      while (i < all.length && Date.now() < end) hayOf(all[i++]);
      if (i < all.length) idle(slice);
    })();
  }

  /* The actions under an opened card row. Hidden until the row is open, so a
     hundred-row unit page costs nothing to look at; `data-star-card` carries
     the card so the same strip works on a unit, in search and in Starred. */
  /* "due" said the same thing about a card owed since this morning and one
     owed for five weeks, while the same line happily printed "in 12 d" for a
     card in the future. Lateness is the number that decides what to open. */
  function dueWord(st, today) {
    if (!st || !(st.r || st.t || st.l)) return 'new';
    var late = today - st.d, n = Math.abs(late), days = n + (n === 1 ? ' day' : ' days');
    if (late > 0) return days + ' late';
    if (late === 0) return 'due';
    return 'in ' + days;
  }

  function rowActs(c, goHref) {
    var on = S.isStarred(c.i);
    return '<div class="qacts">' +
      (goHref ? '<button class="textbtn quiet" data-go="' + esc(goHref) + '">Open this unit</button>' : '') +
      '<button class="textbtn quiet" data-star-card="' + esc(c.i) + '">' +
      (on ? 'Starred' : 'Star') + '</button></div>';
  }

  function runSearch() {
    var out = document.getElementById('results');
    if (!out) return;
    var q = fold(searchState.q.trim().toLowerCase());
    // one letter used to blank the screen, which looks like a crash
    if (!q) {
      out.innerHTML = '<div class="empty">Searches every question, answer and note in every course. ' +
        'A term, a year, a formula, a French word without its accents.</div>';
      return;
    }
    if (q.length < 2) { out.innerHTML = '<div class="empty">Keep typing</div>'; return; }
    var terms = q.split(/\s+/);
    // every deck is scanned, always: a budget that stopped at the first deck
    // to fill it meant a common word only ever found English cards, and the
    // capped number was printed as if it were the answer
    var per = [], total = 0;
    S.getIndex().courses.forEach(function (c) {
      if (searchState.deck && c.id !== searchState.deck) return;
      var d = S.getDeck(c.id); if (!d) return;
      var mine = [];
      d.cards.forEach(function (card) {
        var hay = hayOf(card);
        for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return;
        mine.push(card);
      });
      total += mine.length;
      if (mine.length) per.push(mine);
    });
    // round-robin across the decks, so the rendered slice is never one course
    var hits = [];
    for (var r = 0; hits.length < 400 && per.length; r++) {
      var any = false;
      for (var pi = 0; pi < per.length; pi++) {
        if (r < per[pi].length) { hits.push(per[pi][r]); any = true; }
      }
      if (!any) break;
    }
    if (!hits.length) {
      // "No matches in French" is a lie when French never arrived
      var gone = searchState.deck && !S.getDeck(searchState.deck);
      out.innerHTML = '<div class="empty">' +
        (gone ? esc(nice(searchState.deck)) + ' did not load'
              : 'No matches' + (searchState.deck ? ' in ' + esc(nice(searchState.deck)) : '')) +
        '</div>';
      return;
    }
    hits.sort(function (a, b) {
      var aq = fold(T.plain(a.q).toLowerCase()).indexOf(q), bq = fold(T.plain(b.q).toLowerCase()).indexOf(q);
      return (aq === -1 ? 999 : aq) - (bq === -1 ? 999 : bq);
    });
    // the sheet belongs here too: the print stylesheet already knows .list.tight
    // typing into the field replaced 120 rows and said nothing about how many
    out.innerHTML = '<div class="scoperow"><span class="k" role="status" aria-live="polite">' +
        plural(total, 'card') + '</span>' +
      '<button class="textbtn quiet end" data-print>Print</button></div>' +
      '<ul class="list tight still">' + hits.slice(0, 120).map(function (c) {
        var d = S.getDeck(c.deck), u = d.unitById[c.u];
        return '<li><button class="qrow" data-peek="' + c.i + '" aria-expanded="false">' +
          '<span class="qq">' + T.html(c.q) + '</span>' +
          '<span class="qa" hidden>' + T.html(c.a) + '</span>' +
          (S.noteOf(c.i) ? '<span class="qn" hidden>' + esc(S.noteOf(c.i)) + '</span>' : '') +
          '<span class="qmeta">' + esc(nice(d)) + ' · ' + esc(u ? u.title : '') + '</span></button>' +
          // a search result was a dead end: reading the answer was all you
          // could do with it. An open row offers the unit it came from — and
          // the star, so a card found here can be kept without a session.
          rowActs(c, '#/d/' + c.deck + (u ? '/u/' + u.id : '')) + '</li>';
      }).join('') + '</ul>' +
      (total > 120 ? '<div class="empty cap">First 120</div>' : '');
  }

  /* ==========================================================================
     VIEW · progress
     ========================================================================== */
  function viewStats() {
    curDeckId = null;
    var ix = S.getIndex();
    var totals = { total: 0, known: 0, seen: 0, due: 0 };
    var rows = ix.courses.map(function (c) {
      var d = S.getDeck(c.id); if (!d) return '';
      var st = S.deckStats(d);
      totals.total += st.total; totals.known += st.known; totals.seen += st.seen; totals.due += st.due;
      if (!st.seen) return '';   // a percent column exists only where some rows are non-zero
      // Mastery needs two correct answers and a week's interval, so an honest
      // first session reads "0%" — which tells a student who just did the work
      // that they did none. The row says what they have actually seen too.
      return '<li><button class="ledger mid" data-go="#/d/' + c.id + '">' +
        '<span class="lname">' + esc(nice(c.id)) + '</span>' +
        '<span class="lval num">' + pct(st.pct) + '</span>' +
        '<span class="lsub">' + st.seen.toLocaleString() + ' of ' +
          st.total.toLocaleString() + ' seen' +
          (st.known ? ' · ' + st.known.toLocaleString() + ' known' : '') + '</span>' +
        '</button></li>';
    }).join('');

    // the verdict per course, once two weeks of study have earned one
    var paceRows = ix.courses.map(function (c) {
      var d2 = S.getDeck(c.id); if (!d2) return '';
      var w = paceWord(d2);
      if (!w) return '';
      // the row opens the course's Plan: the verdict, then what to do about it
      return '<li><button class="ledger mid" data-go="#/d/' + c.id + '/plan">' +
        '<span class="lname">' + esc(nice(c.id)) + '</span>' +
        '<span class="lval word">' + esc(w) + '</span>' +
        '<span class="lsub">' + esc(examName(c.id) + ' · ' + plural(examDayNum(c.id) - S.dayNum(), 'day') + ' · the plan') + '</span>' +
        '</button></li>';
    }).join('');
    var paceBlock = paceRows
      ? '<div class="k sec">At this pace</div><ul class="list tight">' + paceRows + '</ul>'
      : '';

    // The week ahead — but only when a week is the truth. With a pile of
    // overdue cards deeper than a session can reach, seven rows of "0" say the
    // week is free when it is a hundred days of work; that gets one sentence.
    var over = overdueCount(), sizeNow = S.getSettings().sessionSize || 30, fcBlock = '';
    // a forecast before the first card is studied is a projection of a habit
    // that does not exist yet — the screen already says "Nothing tracked yet"
    var fc = totals.seen ? forecast(7) : [];
    var fcTotal = fc.reduce(function (a, b) { return a + b; }, 0);
    if (totals.seen && over > sizeNow * 2) {
      // the honest horizon, from the same forward walk the week ahead uses —
      // a flat overdue ÷ slots assumed a reviewed card never comes back, and
      // printed a month for a pile these settings never clear
      var cd = clearDays();
      var when = cd === null
        ? 'not clearing at this pace'
        : cd === 0 ? 'clear today' : plural(cd, 'day') + ' to clear';
      fcBlock = '<div class="k sec">The backlog</div>' +
        '<ul class="list tight"><li><div class="ledger mid">' +
        '<span class="lname">Overdue</span>' +
        '<span class="lval num">' + over.toLocaleString() + '</span>' +
        '<span class="lsub">' + esc(when + ' · ' + plural(reviewSlots(), 'review') +
          ' a session · ' + sizeNow + ' cards, ' + (S.getSettings().newPerSession || 0) + ' new') +
        '</span></div></li></ul>' +
        // the way out, next to the number that needs one
        '<button class="textbtn quiet" data-spread>Spread · ' + reviewSlots() + ' a day</button>' +
        '<div class="empty cap">Spreading keeps every card and every interval ' +
        'it has earned — it only moves the day each one comes back, oldest ' +
        'first, so no day carries more than a session.</div>' +
        missLine('this count');
    } else if (fcTotal > 0) {
      // the bar reads against a day's session, not against the week's own
      // maximum: a full rule always means the same amount of work
      var ref = Math.max(sizeNow, Math.max.apply(null, fc));
      fcBlock = '<div class="k sec">The week ahead</div>' +
        '<ul class="list tight">' + fc.map(function (n, i) {
          return '<li><div class="ledger mid fc' + (n ? '' : ' zero') + '"' +
            ' style="--fc:' + Math.round((n / ref) * 100) + '%">' +
            '<span class="lname">' + esc(dayWord(i)) + '</span>' +
            '<span class="lval num">' + n.toLocaleString() + '</span></div></li>';
        }).join('') + '</ul>' +
        // the assumption, in full: the walk grades every card Good, because
        // that is the only assumption available and the one the app's own
        // interval preview makes
        '<div class="empty cap">If you study every day and grade everything Good, ' +
        sizeNow + ' cards a session</div>' + missLine('the forecast');
    }

    // the three units that bite back hardest — each tap is the fix, not a report
    var weak = weakBuckets(), weakBlock = '', wtop = weakTopics().length, wsk = weakSkills();
    if (weak.length || wtop || wsk.length) {
      weakBlock = '<div class="k sec">Weak spots</div>' + (weak.length ? '<ul class="list tight">' : '') +
        weak.slice(0, 3).map(function (w) {
          return '<li><button class="ledger mid" data-go="#/study/' + w.deck.id + '/hard/' + w.unit.id + '">' +
            '<span class="lname">' + esc(w.unit.title) + '</span>' +
            // the column has to be the number the list is RANKED on, or it
            // climbs as you read down: 4, then 9, then 26
            '<span class="lval num">' + pct(w.bad / w.studied) + '</span>' +
            '<span class="lsub">' + esc(nice(w.deck)) + ' · ' + w.bad + ' of ' + w.studied + ' missed</span>' +
            '</button></li>';
        }).join('') + (weak.length ? '</ul>' : '') +
        (wsk.length ? '<ul class="list tight mt4"><li><div class="ulabel">Weakest skills</div></li>' +
          wsk.slice(0, 2).map(skillRow).join('') + '</ul>' : '') +
        (weak.length > 3 || wtop || wsk.length > 2 ? '<button class="textbtn quiet" data-go="#/weak">' +
          (weak.length > 3 ? 'All weak spots, by topic and skill' : 'Weak spots by topic and skill') + '</button>' : '');
    }

    // the cards themselves, under the units they sit in: a unit you keep
    // missing is a topic to reread, but one card missed six times is a card
    // to rewrite, and only this list can tell you which you have
    var stuck = stuckCards(), stuckBlock = '';
    if (stuck.length) {
      stuckBlock = '<div class="k sec">Trouble spots</div>' +
        '<ul class="list tight">' + stuck.slice(0, 3).map(function (c) {
          var d3 = S.getDeck(c.deck), u3 = d3.unitById[c.u], st3 = S.cs(c.i) || {};
          return '<li><button class="ledger mid" data-go="#/stuck">' +
            '<span class="lname">' + esc(T.plain(c.q)) + '</span>' +
            '<span class="lval num">' + (st3.l || 0) + '</span>' +
            '<span class="lsub">' + esc(nice(d3) + (u3 ? ' · ' + u3.title : '')) + '</span>' +
            '</button></li>';
        }).join('') + '</ul>' +
        '<button class="textbtn quiet" data-go="#/stuck">' +
        (stuck.length > 3 ? 'All ' + stuck.length.toLocaleString() + ' sticking points' : 'Open') +
        '</button>' + missLine('this list');
    }

    // a chart only earns its place with 7+ real data points (skill §7.13)
    var hist = S.history(28);
    var real = hist.filter(function (h) { return h.count > 0; }).length;
    var spark = '';
    if (real >= 7) {
      var max = Math.max(1, Math.max.apply(null, hist.map(function (h) { return h.count; })));
      spark = '<div class="k" style="margin:var(--s-5) 0 10px">Last four weeks</div><div class="spark">' +
        hist.map(function (h) {
          return '<i' + (h.count ? '' : ' class="zero"') + ' style="height:' + Math.max(2, (h.count / max) * 100) + '%"></i>';
        }).join('') + '</div>';
    }

    // the hero states what is true today — "0 of 4,097" over "12 cards today"
    // reads as a contradiction, so lead with the day until cards are known
    // …and with nothing tracked at all it must not echo the deck list's own
    // headline: "4,441 cards" on two different tabs reads as a screen that
    // failed to load rather than one waiting for you
    var blank = !totals.seen && !S.studiedToday();
    var hero = blank ? 'Nothing tracked yet'
      : totals.known ? totals.known.toLocaleString() + ' of ' + totals.total.toLocaleString()
      : S.studiedToday() ? plural(S.studiedToday(), 'review') + ' today'
      : totals.total.toLocaleString() + ' cards';
    var caption = [];
    if (blank) caption.push('Study a card and this fills in');
    if (totals.known && S.studiedToday()) caption.push(plural(S.studiedToday(), 'review') + ' today');
    if (S.streak() > 1) caption.push(S.streak().toLocaleString() + '-day streak');
    mount(
      '<div class="head">' +
      '<h1>' + hero + '</h1>' +
      (caption.length ? '<div class="sub">' + caption.join(' · ') + '</div>' : '') + '</div>' +
      (rows ? '<ul class="list tight">' + rows + '</ul>' : '') +
      paceBlock +
      fcBlock +
      weakBlock +
      stuckBlock +
      spark +
      (totals.due ? '<div class="mt5"><button class="act" data-go="#/review">Review ' + totals.due.toLocaleString() + '</button></div>'
        : !totals.seen ? '<button class="textbtn" data-go="#/">Courses</button>' : '')
    );
  }

  /* every weak spot, when three rows are not the whole story */
  /* the same measure, a topic at a time: a unit can be sound while one of
     its topics is not, and a topic is small enough to recall on its own */
  function weakTopics() {
    var out = [];
    S.getIndex().courses.forEach(function (c) {
      var d = S.getDeck(c.id); if (!d) return;
      var per = {};
      d.cards.forEach(function (card) {
        var u = d.unitById[card.u];
        if (!card.t || !u || !u.topics || !u.topics.length) return;
        var s = S.cs(card.i);
        if (!s || !(s.r || s.t || s.l)) return;
        var k = card.u + '|' + card.t;
        var b = per[k] || (per[k] = { unit: u, topic: card.t, studied: 0, bad: 0 });
        b.studied++;
        if ((s.l || 0) > 0 && !S.isKnown(card.i)) b.bad++;
      });
      Object.keys(per).forEach(function (k) {
        var b = per[k];
        if (b.studied >= 4 && b.bad >= 2 && recallCards(d, b.unit.id, b.topic).length >= 3)
          out.push({ deck: d, unit: b.unit, topic: b.topic, studied: b.studied, bad: b.bad, score: b.bad / b.studied });
      });
    });
    out.sort(function (a, b) { return (b.score - a.score) || (b.bad - a.bad); });
    return out.slice(0, 12);
  }
  /* the same miss rate, by exam skill: a skill missed across units is a move
     not yet learned, which no single unit's list can show */
  function weakSkills() {
    var out = [];
    S.getIndex().courses.forEach(function (c) {
      var d = S.getDeck(c.id); if (!d || !d.skills || !d.skills.length) return;
      var byCode = {}; d.skills.forEach(function (x) { byCode[x.code] = x; });
      var per = {};
      d.cards.forEach(function (card) {
        if (!card.s || !byCode[card.s]) return;
        var s = S.cs(card.i);
        if (!s || !(s.r || s.t || s.l)) return;
        var b = per[card.s] || (per[card.s] = { skill: byCode[card.s], studied: 0, bad: 0 });
        b.studied++;
        if ((s.l || 0) > 0 && !S.isKnown(card.i)) b.bad++;
      });
      Object.keys(per).forEach(function (k) {
        var b = per[k];
        if (b.studied >= 8 && b.bad >= 3)
          out.push({ deck: d, skill: b.skill, studied: b.studied, bad: b.bad, score: b.bad / b.studied });
      });
    });
    out.sort(function (a, b) { return (b.score - a.score) || (b.bad - a.bad); });
    return out.slice(0, 12);
  }
  function skillRow(w) {
    return '<li><button class="ledger mid" data-go="#/study/' + w.deck.id + '/s:' + encodeURIComponent(w.skill.code) + '">' +
      '<span class="lname">' + esc(w.skill.short || w.skill.name) + '</span>' +
      '<span class="lval num">' + pct(w.bad / w.studied) + '</span>' +
      '<span class="lsub">' + esc(nice(w.deck) + ' · Skill ' + w.skill.code) + ' · ' + w.bad + ' of ' + w.studied + ' missed</span>' +
      '</button></li>';
  }
  function viewWeak() {
    curDeckId = null;
    var list = weakBuckets(), topics = weakTopics(), skills = weakSkills();
    if (!list.length && !topics.length && !skills.length) return goReplace('#/stats');
    mount(
      backbar('Progress') +
      '<div class="head"><h1 class="uhead">Weak spots</h1></div>' +
      '<ul class="list tight">' + list.map(function (w) {
        return '<li><button class="ledger mid" data-go="#/study/' + w.deck.id + '/hard/' + w.unit.id + '">' +
          '<span class="lname">' + esc(w.unit.title) + '</span>' +
          '<span class="lval num">' + pct(w.bad / w.studied) + '</span>' +
          '<span class="lsub">' + esc(nice(w.deck)) + ' · ' + w.bad + ' of ' + w.studied + ' missed</span>' +
          '</button></li>';
      }).join('') + '</ul>' +
      (topics.length
        ? '<ul class="list tight mt4"><li><div class="ulabel">By topic · each opens a recall, then deals what it missed</div></li>' +
          topics.map(function (w) {
            var tp = (w.unit.topics || []).filter(function (x) { return x.c === w.topic; })[0];
            return '<li><button class="ledger mid" data-go="#/recall/' + w.deck.id + '/' + w.unit.id + '/' + encodeURIComponent(w.topic) + '">' +
              '<span class="lname">' + esc(tp && tp.t ? tp.t : w.topic) + '</span>' +
              '<span class="lval num">' + pct(w.bad / w.studied) + '</span>' +
              '<span class="lsub">' + esc(nice(w.deck) + ' · ' + w.unit.title) + ' · ' + w.bad + ' of ' + w.studied + ' missed</span>' +
              '</button></li>';
          }).join('') + '</ul>'
        : '') +
      (skills.length
        ? '<ul class="list tight mt4"><li><div class="ulabel">By skill · each deals that skill from every unit</div></li>' +
          skills.map(skillRow).join('') + '</ul>'
        : '')
    );
  }

  /* ==========================================================================
     VIEW · starred
     ========================================================================== */
  /* Starring was write-only: the star went on in a session and the only way
     back to it was a per-deck mode button that appeared on one course page.
     These are the cards the reader themselves said were worth another look,
     so they get a screen: every one of them, across every deck, readable
     without starting a session, and unstarrable from the row. */
  /* A course in the index with no deck behind it is a hole in every count the
     app prints. Naming it is the difference between "6 cards" and "6 cards,
     and French did not load". */
  function missingDecks() {
    return (S.getIndex().courses || []).filter(function (c) { return !S.getDeck(c.id); })
      .map(function (c) { return nice(c.id); });
  }
  function missLine(what) {
    var m = missingDecks();
    if (!m.length) return '';
    return '<div class="warnline soft">' + esc(m.join(' and ')) +
      ' did not load. ' + esc(what.charAt(0).toUpperCase() + what.slice(1)) + ' leaves ' +
      (m.length > 1 ? 'them' : 'it') + ' out.</div>';
  }

  function starredCards(deckOrder) {
    var out = [];
    (S.getIndex().courses || []).forEach(function (c) {
      var d = S.getDeck(c.id); if (!d) return;
      d.cards.forEach(function (card) { if (S.isStarred(card.i)) out.push(card); });
    });
    // newest star first — the one you flagged this morning is the one you came
    // here for, not the one from October sitting four thousand pixels down
    if (!deckOrder) out.sort(function (a, b) {
      return ((S.cs(b.i) || {}).sa || 0) - ((S.cs(a.i) || {}).sa || 0);
    });
    return out;
  }

  /* A card missed three times or more is rarely a card you have not learnt —
     it is usually a card that is badly asked, or one that needs a hook. The
     weak-spot list ranks UNITS; this ranks the individual cards, because the
     fix for one bad card is not another pass over its unit. */
  var STUCK_MIN = 3;
  function stuckCards() {
    var out = [];
    (S.getIndex().courses || []).forEach(function (c) {
      var d = S.getDeck(c.id); if (!d) return;
      d.cards.forEach(function (card) {
        var st = S.cs(card.i);
        if (st && (st.l || 0) >= STUCK_MIN) out.push(card);
      });
    });
    // most-missed first, and the more recent miss breaks a tie: the card that
    // beat you this week outranks the one you have since fixed
    out.sort(function (a, b) {
      var A = S.cs(a.i) || {}, B = S.cs(b.i) || {};
      return (B.l || 0) - (A.l || 0) || (B.t || 0) - (A.t || 0);
    });
    return out;
  }

  /* the same cycling word the unit list and search use: All, then each deck
     that has stars in it. In memory, and it goes when the screen does. */
  var starFilter = 0;
  function starDecks() {
    var seen = [], out = [];
    starredCards(true).forEach(function (c) {
      if (seen.indexOf(c.deck) === -1) { seen.push(c.deck); out.push(c.deck); }
    });
    return out;
  }
  function starWord() {
    var ids = starDecks();
    return starFilter && ids[starFilter - 1] ? nice(ids[starFilter - 1]) : 'All courses';
  }

  function viewStuck() {
    curDeckId = null;
    var all = stuckCards();
    if (!all.length) return mount(
      backbar('Progress') +
      '<div class="head"><h1 class="uhead">Trouble spots</h1>' +
      '<div class="sub">Nothing has been missed ' + STUCK_MIN + ' times. ' +
      'When a card starts beating you, it lands here.</div></div>' +
      // …and a course that did not load has no lapses to report, which at the
      // limit is this very screen claiming nothing is stuck when things are
      missLine('this list'));
    var today = S.dayNum();
    var deal = Math.min(all.length, S.getSettings().sessionSize || 30);
    mount(
      backbar('Progress') +
      '<div class="head"><h1 class="uhead">Trouble spots</h1>' +
      '<div class="sub">' + esc(plural(all.length, 'card')) + ' missed ' +
      STUCK_MIN + ' times or more</div></div>' +
      missLine('this list') +
      '<button class="act" data-go="#/stuck/go">Study ' +
        (deal < all.length ? deal.toLocaleString() + ' of ' + all.length.toLocaleString() : 'these') + '</button>' +
      // the remedy, said once — and where it lives: the note control is on
      // the card in a session, not on this screen
      '<div class="empty cap">A card at this count usually needs saying in your ' +
      'own words, not another pass. In the session the note control is on the ' +
      'card — write the version that would have worked.</div>' +
      '<ul class="list tight still mt4">' + all.map(function (c) {
        var d = S.getDeck(c.deck), u = d.unitById[c.u], st = S.cs(c.i) || {};
        var when = dueWord(st, today);
        return '<li><button class="qrow" data-peek="' + c.i + '" aria-expanded="false">' +
          '<span class="qq">' + T.html(c.q) + '</span>' +
          '<span class="qa" hidden>' + T.html(c.a) + '</span>' +
          (S.noteOf(c.i) ? '<span class="qn" hidden>' + esc(S.noteOf(c.i)) + '</span>' : '') +
          '<span class="qmeta">' + esc(plural(st.l || 0, 'miss', 'misses')) + ' · ' +
            esc(when) + ' · ' + esc(nice(d)) + (u ? ' · ' + esc(u.title) : '') + '</span></button>' +
          rowActs(c, '#/d/' + c.deck + (u ? '/u/' + u.id : '')) + '</li>';
      }).join('') + '</ul>'
    );
  }

  /* the sticking points cross decks the way the stars do */
  function startStuck() {
    if (savedPending()) return waitingScreen();
    if (resume()) return;
    var list = stuckCards();
    if (!list.length) return goReplace('#/stuck');
    list = list.slice(0, S.getSettings().sessionSize || 30);
    S.shuffle(list);
    sess = {
      deck: null, unitId: null, mode: 'stuck', quiz: false, mixed: true,
      back: '#/stuck',
      typing: S.getSettings().typing,
      queue: list, done: 0, planned: list.length, redo: 0,
      revealed: false, again: 0, hard: 0, good: 0, easy: 0, lapsed: {}, right: 0, wrong: 0,
      history: [], answered: false, typed: ''
    };
    renderCard();
  }

  function viewStarred() {
    curDeckId = null;
    var all = starredCards();
    // nothing starred is not an error — it is the state before the feature is
    // used, and it says what the star is for rather than showing an empty list
    if (!all.length) return mount(
      backbar('Courses') +
      '<div class="head"><h1 class="uhead">Starred</h1>' +
      '<div class="sub">Nothing yet. In a session, tap the star or swipe the card up; ' +
      'anywhere a card row opens, tap Star. They all land here.</div></div>' +
      missLine('this screen'));
    var ids = starDecks();
    if (starFilter > ids.length) starFilter = 0;
    var pick = starFilter ? ids[starFilter - 1] : null;
    var list = pick ? all.filter(function (c) { return c.deck === pick; }) : all;

    var today = S.dayNum();
    // a session is a session here too: the deal is capped like every other one
    var deal = Math.min(list.length, S.getSettings().sessionSize || 30);
    mount(
      backbar('Courses') +
      '<div class="head"><h1 class="uhead">Starred</h1>' +
      '<div class="sub">' + esc(plural(all.length, 'card')) + '</div></div>' +
      missLine('this screen') +
      '<button class="act" data-go="#/starred/go">Study ' +
        (deal < list.length ? deal.toLocaleString() + ' of ' + list.length.toLocaleString() : 'these') + '</button>' +
      // the filter word, its count, and the sheet — one quiet line, not three
      '<div class="scoperow unit">' +
        (ids.length > 1
          ? '<button class="textbtn quiet" data-star-filter>' + esc(starWord()) + '</button>' +
            '<span class="scount num">' + list.length.toLocaleString() + '</span>'
          : '') +
        '<button class="textbtn quiet end" data-print>Print</button></div>' +
      '<ul class="list tight still mt4">' + list.map(function (c) {
        var d = S.getDeck(c.deck), u = d.unitById[c.u], st = S.cs(c.i);
        var when = dueWord(st, today);
        return '<li><button class="qrow" data-peek="' + c.i + '" aria-expanded="false">' +
          '<span class="qq">' + T.html(c.q) + '</span>' +
          '<span class="qa" hidden>' + T.html(c.a) + '</span>' +
          (S.noteOf(c.i) ? '<span class="qn" hidden>' + esc(S.noteOf(c.i)) + '</span>' : '') +
          // the schedule word leads: a wrapped meta line must not orphan "due"
          '<span class="qmeta">' + esc(when) + ' · ' + esc(nice(d)) +
          (u ? ' · ' + esc(u.title) : '') + '</span></button>' +
          '<div class="qacts">' +
          '<button class="textbtn quiet" data-go="#/d/' + c.deck + (u ? '/u/' + u.id : '') + '">Open this unit</button>' +
          '<button class="textbtn quiet" data-unstar="' + esc(c.i) + '">Unstar</button></div></li>';
      }).join('') + '</ul>'
    );
  }

  /* the starred session crosses decks, like Review does — a star is a note to
     self about a card, not about the course it happens to sit in */
  function startStarred() {
    if (savedPending()) return waitingScreen();
    if (resume()) return;
    var list = starredCards();
    if (starFilter) {
      var ids2 = starDecks(), pick2 = ids2[starFilter - 1];
      if (pick2) list = list.filter(function (c) { return c.deck === pick2; });
    }
    if (!list.length) return goReplace('#/starred');
    S.shuffle(list);
    // due and overdue stars first, so a capped session is the useful part of
    // the pile rather than a random slice of it
    var todayN = S.dayNum();
    list.sort(function (a, b) {
      return (S.isDue(b.i, todayN) ? 1 : 0) - (S.isDue(a.i, todayN) ? 1 : 0);
    });
    list = list.slice(0, S.getSettings().sessionSize || 30);
    sess = {
      deck: null, unitId: null, mode: 'starred', quiz: false, mixed: true,
      back: '#/starred',
      typing: S.getSettings().typing,
      queue: list, done: 0, planned: list.length, redo: 0,
      revealed: false, again: 0, hard: 0, good: 0, easy: 0, lapsed: {}, right: 0, wrong: 0,
      history: [], answered: false, typed: ''
    };
    renderCard();
  }

  /* ==========================================================================
     VIEW · settings
     ========================================================================== */
  /* the sync word tells the truth: when data last actually moved, not
     whether a token string happens to exist */
  /* the reminder row: one word for its state, and a line that says what the
     word means on this device — "Not here" on an iPhone is the app not yet
     added to the Home Screen, which is the one thing worth telling */
  function remindWord() {
    var st = S.remind.status();
    return st === 'on' ? 'On' : st === 'denied' ? 'Blocked' : st === 'unsupported' ? 'Not here' : 'Off';
  }
  function remindNote() {
    var st = S.remind.status();
    if (st === 'on') return 'One note a day on this device, on the days something is due. Tap it to land on Review.';
    if (st === 'denied') return 'Notifications are blocked for this site in the browser\'s settings; allow them there, then turn the reminder on.';
    if (st === 'unsupported') return 'Reminders reach installed apps: add this to the Home Screen first, or open it in a browser that allows notifications.';
    return 'One note a day with the cards due, on this device, on the days something is due.';
  }
  function syncWord() {
    var at = S.account.lastSyncAt();
    // a failure that says nothing is worse than one that says so: the row used
    // to read "Never" through an entire review whatever the server answered
    var f = S.account.lastFail ? S.account.lastFail() : '';
    if (f === 'auth') return 'Token refused';
    if (f === 'off') {
      var w = S.account.offWhy ? S.account.offWhy() : '';
      return 'Sync is off here';
    }
    if (f === 'net' && !at) return 'Cannot reach sync';
    if (!at) return 'Never';
    var m = (Date.now() - at) / 60000;
    if (m < 5) return 'Just now';
    if (m < 120) return plural(Math.round(m), 'minute') + ' ago';
    if (m < 48 * 60) return plural(Math.round(m / 60), 'hour') + ' ago';
    return plural(Math.round(m / 1440), 'day') + ' ago';
  }
  function viewSettings() {
    curDeckId = null;
    var s = S.getSettings();
    mount(
      // the screen's name, sized for a utility page — not the content hero
      '<div class="head"><h1 class="uhead">Settings</h1></div>' +

      // sync leads — the one setting that matters; every value is a word
      '<div class="setgroup">' +
      (S.account.connected()
        ? '<div class="setrow"><div class="sname">Sync</div>' +
          // the value doubles as the control, so it has to name the verb
          '<button class="cyc" data-acct-off>' + esc(syncWord()) + ' · turn off</button></div>' +
          // the account id a private deck is addressed to — tap copies it
          (S.account.ownerId()
            ? '<div class="setrow"><div class="sname">ID</div>' +
              '<button class="cyc" data-acct-id>' + esc(S.account.ownerId()) + '</button></div>'
            : '')
        : '<div class="setrow stack"><div class="sname">Sync</div>' +
          '<div class="searchbar" style="margin-top:6px"><input id="acct-tok" type="text" aria-label="Account sync token" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Account token">' +
          '<button class="textbtn quiet" data-tok-paste>Paste</button></div></div>') +
      '<div class="setrow"><div class="sname" id="set-remind">Reminder</div>' +
        '<button class="cyc" data-remind aria-labelledby="set-remind" ' +
        'aria-label="Reminder ' + remindWord() + '">' + remindWord() + '</button></div>' +
      '<div class="setnote">' + esc(remindNote()) + '</div>' +
      '<div class="setrow"><div class="sname" id="set-typing">Typing</div>' +
        '<button class="cyc" data-typing-cycle aria-labelledby="set-typing" ' +
        'aria-label="Typing ' + (s.typing ? 'On' : 'Off') + '">' + (s.typing ? 'On' : 'Off') + '</button></div>' +
      '<div class="setrow"><div class="sname" id="set-session">Session</div>' +
        '<button class="cyc num" data-cycle="sessionSize" ' +
        'aria-label="Session ' + s.sessionSize + ' cards">' + s.sessionSize + '</button></div>' +
      '<div class="setrow"><div class="sname" id="set-new">New cards</div>' +
        '<button class="cyc num" data-cycle="newPerSession" ' +
        'aria-label="New cards ' + s.newPerSession + ' a session">' + s.newPerSession + '</button></div>' +
      // the two numbers above are a trade, and the trade was invisible
      (S.getIndex().courses.some(function (c) { return S.getDeck(c.id); })
        ? '<div class="setnote">' + esc(paceVerdict()) + '</div>' : '') +

      '</div>' +

      '<div class="data-list">' +
        '<button class="textbtn" data-export>Backup</button>' +
        '<button class="textbtn" data-import>Restore</button>' +
        '<button class="textbtn" data-reset>Reset progress</button>' +
      '</div>' +
      '<div class="data-list"><button class="textbtn" data-go="#/how">How it works</button></div>' +
      reqHTML('Request a feature') +
      // the keys, said once, where a keyboard exists — CSS hides this line on
      // coarse-pointer screens, where it would only be clutter
      '<div class="keyline">Keyboard · space reveal · a s d f grade · * star · n note · ' +
        '1–4 answer · enter next · / search · ← → tabs · esc back</div>' +
      '<div class="foot">' + S.getIndex().total.toLocaleString() + ' cards</div>'
    );
  }

  /* ==========================================================================
     VIEW · how it works — the whole system on one page, in the words the
     screens use. Numbers come from Settings so the page never drifts from
     what the buttons will actually deal.
     ========================================================================== */
  function viewHow() {
    curDeckId = null;
    var s = S.getSettings();
    var book = S.getDeck('sixladders');
    function sec(k, ps) {
      return '<div class="k">' + esc(k) + '</div>' + ps.map(function (t) { return '<p>' + t + '</p>'; }).join('');
    }
    function b(t) { return '<b>' + esc(t) + '</b>'; }
    mount(
      '<div class="head"><span class="k">Before you start</span><h1 class="uhead">How it works</h1></div>' +
      '<div class="how">' +
      sec('Each day', [
        'Open a course and tap ' + b('Study') + '. The deal is what is due today, then new cards: up to ' +
          s.sessionSize + ' a session, ' + s.newPerSession + ' of them new. On a fresh deck that is ' + s.newPerSession + ' new cards. ' +
          'The line under the button counts the two halves.',
        'The line over a course name says when its exam is and whether this pace sees every card before it. ' +
          'Both numbers move under Settings.',
        'The course list adds it up: the big number is what is due across every course, and ' + b('Start') + ' deals it. ' +
          b('Quick ten') + ' is the same deal cut to ten.'
      ]) +
      sec('Grading a card', [
        'Read the question, answer it in your head, then turn the card. ' + b('Hint') + ' shows the shape of the answer, only when you tap it. ' +
          'After the answer, the grey note is the trap or the reason, from the card itself.',
        b('Again') + ': you did not have it. The card comes back this session and its ladder starts over.',
        b('Hard') + ': you had it, but only just. It keeps its place and comes back sooner: a new card in a day, a known one a fifth further than last time, and its ease slips so the steps after stay short.',
        b('Good') + ': the normal step. A new card goes 3 days, then each step multiplies by the card\'s ease, about two and a half: 3, 8, 20, 50.',
        b('Easy') + ': half again as far as Good would send it, a week for a new card, and the ease grows so later steps stretch further.',
        'On a phone each grade prints when it would bring the card back; with a keyboard it prints its key, and the day is in the button\'s tooltip. Nothing is ever scheduled past the exam.'
      ]) +
      sec('Keeping your place', [
        'Leave a deal for another course and it waits for you, for the day: a ' + b('Continue') + ' line on the course list and on every course page brings you back to the same card. The × beside a line clears it.',
        'When a test is done, ' + b('Exam over') + ' on the course page stops its pile: nothing from it counts as due or is dealt by Review, and the reminder leaves it out. ' + b('Resume the schedule') + ' brings every card back as it was.',
        b('Reminder') + ', under Settings, sends one note a day to this device on the days something is due; tap it to land on Review. An iPhone or iPad sends it only to an app added to the Home Screen.',
        'Chemistry carries two tables, the polyatomic ions and the VSEPR shapes: drill either on its own or both together from the course page. They stay out of the daily deal until you have studied them.'
      ]) +
      sec('Ways into a course', [
        b('High-yield') + ': ' + esc(MODE_DESC.core) + '.',
        b('Quiz') + ': ' + esc(MODE_DESC.quiz) + '. The card\'s note appears under the right choice.',
        b('Trouble spots') + ': ' + esc(MODE_DESC.hard) + '.',
        b('Score it') + ', on an AP course or unit: ' + esc(MODE_DESC.score) + '. The answers are the explain-whys\' own: the model, the other arguments that earn the point, and the confident ones that lose it. Judging never moves the schedule.',
        b('By skill') + ', on an AP course: ' + esc(MODE_DESC.skills) + '. The exam asks every skill about every unit, so a skill\'s cards come mixed from across the course.',
        b('Exam mix') + ': ' + esc(MODE_DESC.mix) + '.',
        b('Shuffle') + ': ' + esc(MODE_DESC.all) + '.',
        b('Catch up') + ' — appears when more is due than fits a session. ' + esc(MODE_DESC.due) + '.',
        b('Cram') + ', on a unit: ' + esc(MODE_DESC.cram) + '. Practice before a test, without moving anything the schedule owns.',
        b('Justify') + ', on a unit of an AP course: ' + esc(MODE_DESC.justify) + '. Dealt like Cram. In Quiz, the wrong choices are the answers that earn nothing.',
        b('Free response') + ', on a unit of an AP course: ' + esc(MODE_DESC.frq) + '. Point splits are estimates; the essays are laid out by rubric row. ' + b('Practice it') + ' on a question: write each part, then score it against the model, part by part; the best score stays on this device.',
        b('Grammar') + ', on French: ' + esc(MODE_DESC.focus) + '. A point deals every card on it, from both grammar units, the least-known first, like Cram.',
        b('Print') + ', on a unit: ' + esc(MODE_DESC.print) + '.',
        b('Plan') + ', on a course with an exam date: ' + esc(MODE_DESC.plan) + '. It keeps two weeks at the end for review and offers to set the new-cards rate it needs.',
        'A unit page opens with its key ideas, then its cards under their topics; ' + b('Study') + ' beside a topic deals that topic alone, and ' + b('Recall') + ' asks you to write down everything you remember about it first, then deals only what your recall missed.',
        'When an ordinary card gets Again, its topic\'s explain-why follows a few cards later, marked ' + b('After a miss') + ', in the place of a new card, so the session is no longer.'
      ]) +
      sec('Stars, notes and typing', [
        'The ' + b('star') + ' keeps a card. Starred cards collect under Starred on the course list and under Study starred on their course; swiping a card up stars it.',
        b('Note') + ' is your own words on a card: a mnemonic, the trap you keep hitting. It shows under the answer every time after.',
        b('Typing') + ', under Settings, asks you to type the answer before you turn the card. The app checks it against the answer and any accepted wording and recommends a grade; a miss recommends Again.'
      ]) +
      sec('Games', [
        'Every game deals rounds built from a course, so a round is practice on the same material. ' +
          b('Match') + ' pairs two columns. ' + b('Order') + ' puts items in sequence. ' + b('Quiz') + ' is one prompt and four answers. ' +
          b('Board') + ' shows a prompt and a board of tiles; tap the one it names. ' + b('Circle') + ' is the unit circle. ' + b('Graph') + ' asks which trig function is drawn.',
        'Each game keeps a best, and the Games page says under every name what its round asks.'
      ]) +
      sec('Progress', [
        b('Progress') + ' shows what is due, the week ahead at this pace, the units where you are weakest, the cards you keep missing, and the last four weeks of reviews. ' +
          'Weak spots and sticking points open as sessions.'
      ]) +
      sec('Sync', [
        'Progress lives on this device until you paste an account token under Settings → Sync. Then every device with the same token shares one record: ' +
          'reviews, stars, notes, settings' + (book ? ', lesson ticks' : '') + '. Two devices that both worked offline both keep their work, card by card.',
        'The ID under Sync is derived from the token and is safe to share; the token is not.'
      ]) +
      (book ? sec('The Ladders', [
        'The Ladders is a course with a book of its own. Its unit pages list the phases to read, each lesson at six reading levels, ' +
          'and the pages before Phase 0 lay the whole project out file by file. Tick a lesson done at its foot, and tick each line of a phase\'s Done when as you see it happen; both count on the unit page and sync with everything else. Every word the course uses is explained at six levels where it first appears, and all of them together under Every word, explained on the course page.'
      ]) : '') +
      sec('Keys and swipes', [
        'In a session: ' + b('space') + ' or ' + b('→') + ' turns the card, ' + b('a s d f') + ' (or 1 2 3 4) grade it Again, Hard, Good, Easy, ' + b('←') + ' takes the last grade back, ' +
          b('*') + ' stars, ' + b('n') + ' opens the note, ' + b('esc') + ' leaves. In a quiz, 1 to 4 pick and enter moves on.',
        'Anywhere: ' + b('/') + ' searches, ' + b('← →') + ' move between tabs, ' + b('esc') + ' goes back. In a Ladders lesson, ← → turn its pages.',
        'On a phone: swipe a card left for Again, right for Good, up to star it.'
      ]) +
      '</div>'
    );
  }

  /* the request line: write it here, it lands as a GitHub issue under the
     owner's own login — the site itself holds no token at all */
  function reqHTML(label) {
    return '<div class="reqwrap"><button class="textbtn" data-req>' + esc(label) + '</button>' +
      '<div class="reqbox" hidden><textarea rows="3" aria-label="Describe what you want" placeholder="A feature, a game, a fix"></textarea>' +
      '<button class="textbtn" data-req-send>Send</button></div></div>';
  }
  window.__reqHTML = reqHTML;   // the games hub renders the same line

  /* destructive actions arm on the first tap and revert after ~3s — ink and
     weight say "are you sure", never a dialog and never red */
  /* A settings row rebuilds the screen under the button you just pressed, so
     the keyboard was left on <body> and a second Enter did nothing. Re-render,
     then hand focus back to the row's own control. */
  /* is the list under a filter this row may have just fallen out of? */
  function starFiltered() {
    var w = document.querySelector('[data-unit-filter]');
    if (w && UNIT_FILTERS[unitFilter][0] === 'Starred') return true;
    return !!document.querySelector('[data-star-filter]') ||
           (location.hash.replace(/^#/, '') || '/').indexOf('/starred') === 0;
  }
  function bumpCount(by) {
    var el = document.querySelector('.scoperow .scount');
    if (!el) return;
    var n = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10);
    if (isNaN(n)) return;
    el.textContent = Math.max(0, n + by).toLocaleString();
  }

  /* The print stylesheet drops every control, including the word that says
     the list is filtered — so a four-card starred sheet printed as if it were
     the unit. The header is stamped before the dialog opens and cleared after,
     and an installed PWA that has no print dialog at all says so. */
  function printSheet() {
    var stamp = document.createElement('div');
    stamp.className = 'printonly';
    var word = document.querySelector('[data-unit-filter], [data-star-filter]');
    var cnt = document.querySelector('.scoperow .scount');
    var bits = [];
    if (word && word.textContent.trim() !== 'All cards' && word.textContent.trim() !== 'All courses')
      bits.push(word.textContent.trim().toLowerCase() + (cnt ? ' · ' + cnt.textContent.trim() + ' cards' : ''));
    bits.push(S.dayKey(S.dayNum()));      // the local day, not UTC's
    stamp.textContent = bits.join(' · ');
    var host = app.querySelector('.pane-r .inner') || app.querySelector('.screen') || app;
    host.insertBefore(stamp, host.firstChild);
    var ok = true;
    try { window.print(); } catch (e) { ok = false; }
    // an installed home-screen app has no print dialog to fall back on
    var standalone = window.navigator.standalone === true ||
      (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    setTimeout(function () { if (stamp.parentNode) stamp.parentNode.removeChild(stamp); }, 1200);
    if (!ok || standalone) toast('Open the app in Safari or Chrome to print');
  }

  function refocus(render, sel) {
    var had = document.activeElement && document.activeElement.matches &&
              document.activeElement.matches(sel);
    render();
    if (!had) return;
    var el = app.querySelector(sel);
    if (el) try { el.focus(); } catch (e) {}
  }

  function armConfirm(btn, label) {
    if (btn.getAttribute('data-armed')) { disarm(btn); return true; }
    btn.setAttribute('data-armed', '1');
    btn._label = btn.textContent;
    btn.textContent = label;
    btn.classList.add('armed');
    // three seconds is under the time it takes to read what is about to
    // happen, let alone to hear it — and a reader was told nothing at all
    btn.setAttribute('aria-pressed', 'true');
    announce(label);
    btn._disarm = setTimeout(function () { disarm(btn); }, 9000);
    return false;
  }
  function disarm(btn) {
    if (!btn || !btn.getAttribute('data-armed')) return;
    clearTimeout(btn._disarm);
    btn.removeAttribute('data-armed');
    btn.setAttribute('aria-pressed', 'false');
    btn.classList.remove('armed');
    if (btn._label) btn.textContent = btn._label;
  }

  /* ==========================================================================
     global delegation
     ========================================================================== */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var goEl = t.closest('[data-go]');
    if (goEl) { go(goEl.getAttribute('data-go')); return; }
    if (t.closest('[data-back]')) {
      if (pushDepth > 0) { pushDepth--; history.back(); }
      else goReplace(parentOf(location.hash));   // opened here — never leave the app
      return;
    }
    if (t.closest('[data-exit]')) { exitSession(); return; }
    if (t.closest('[data-undo]')) { undo(); return; }
    if (t.closest('[data-hint]')) {
      // the button is replaced by the hint it asked for, so nothing is left to
      // read the change off — say it
      if (sess && !sess.revealed) {
        sess.hinted = true; renderCard();
        var hn = document.getElementById('cardhint');
        announce('Hint. ' + (hn ? hn.textContent : ''));
      }
      return;
    }
    if (t.closest('[data-reveal]')) { reveal(); return; }
    if (t.closest('[data-star]')) { starCurrent(); return; }
    if (t.closest('[data-note]')) { openNote(); return; }
    if (t.closest('[data-note-save]')) { closeNote(true); return; }
    if (t.closest('[data-note-cancel]')) { closeNote(false); return; }
    var g = t.closest('[data-grade]');
    if (g) { doGrade(parseInt(g.getAttribute('data-grade'), 10)); return; }
    var pk = t.closest('[data-pick]');
    if (pk) { pickChoice(parseInt(pk.getAttribute('data-pick'), 10)); return; }
    if (recallClick(t)) return;
    if (frqClick(t)) return;
    if (t.closest('[data-next]')) { nextQuiz(); return; }

    if (t.closest('[data-unit-filter]')) {
      unitFilter = (unitFilter + 1) % UNIT_FILTERS.length;
      route();
      return;
    }
    if (t.closest('[data-unit-all]')) { unitFilter = 0; route(); return; }
    if (t.closest('[data-print]')) { printSheet(); return; }
    if (t.closest('[data-spread]')) {
      var n = spreadBacklog();
      toast(n ? n.toLocaleString() + ' cards spread over the days ahead — nothing lost'
              : 'Nothing to spread');
      if (n) route();
      return;
    }
    if (t.closest('[data-search-scope]')) {
      var q0 = document.getElementById('q');
      var sel = q0 ? [q0.selectionStart, q0.selectionEnd] : null;
      cycleScope();
      // the word is a control that changes the list under it — repaint the
      // word in place and re-run, never remount the screen and lose the caret
      var sw = document.querySelector('[data-search-scope]');
      if (sw) sw.textContent = scopeWord();
      runSearch();
      // …and the tap itself must not take the caret either: on a phone that
      // drops the keyboard in the middle of a query
      if (q0) try { q0.focus({ preventScroll: true }); if (sel) q0.setSelectionRange(sel[0], sel[1]); } catch (e) {}
      return;
    }
    if (t.closest('[data-star-filter]')) {
      starFilter = (starFilter + 1) % (starDecks().length + 1);
      viewStarred();
      return;
    }
    var sc = t.closest('[data-star-card]');
    if (sc) {
      var onNow = S.toggleStar(sc.getAttribute('data-star-card'));
      // the row stays where it is and its own word changes — repainting the
      // screen would close the card the reader is in the middle of reading
      sc.textContent = onNow ? 'Starred' : 'Star';
      var li2 = sc.closest('li');
      if (li2) li2.classList.toggle('dropped', !onNow && starFiltered());
      toast(onNow ? 'Starred' : 'Unstarred');
      // …but a count beside a filter that this row no longer matches has to
      // move, or the number and the list tell two different stories
      if (starFiltered()) bumpCount(onNow ? 1 : -1);
      return;
    }
    var un = t.closest('[data-unstar]');
    if (un) {
      var onNow2 = S.toggleStar(un.getAttribute('data-unstar'));
      toast(onNow2 ? 'Starred' : 'Unstarred');
      // the list can be 22,000px tall — repainting it threw the reader back to
      // the top and closed the row they were reading. The row stays, struck
      // through, and the same word puts the star back.
      var li = un.closest('li');
      if (li) li.classList.toggle('dropped', !onNow2);
      un.textContent = onNow2 ? 'Unstar' : 'Star again';
      bumpCount(onNow2 ? 1 : -1);
      return;
    }
    var fp = t.closest('[data-fp]');
    if (fp) {
      var fa = fp.nextElementSibling;
      if (fa && fa.classList.contains('fpa')) {
        fa.hidden = !fa.hidden;
        fp.setAttribute('aria-expanded', fa.hidden ? 'false' : 'true');
        fp.classList.toggle('open', !fa.hidden);
      }
      return;
    }
    var peek = t.closest('[data-peek]');
    if (peek) {
      var a = peek.querySelector('.qa');
      a.hidden = !a.hidden;
      var qn = peek.querySelector('.qn');
      if (qn) qn.hidden = a.hidden;
      peek.classList.toggle('open', !a.hidden);
      peek.setAttribute('aria-expanded', a.hidden ? 'false' : 'true');
      if (peek.parentNode) peek.parentNode.classList.toggle('open', !a.hidden);
      return;
    }
    if (t.closest('[data-remind]')) {
      var rs = S.remind.status();
      if (rs === 'on') {
        S.remind.off().then(function () { announce('Reminder off'); toast('Reminder off'); refocus(viewSettings, '[data-remind]'); });
        return;
      }
      if (rs === 'denied' || rs === 'unsupported') { toast(remindNote()); return; }
      S.remind.on().then(function (r) {
        var word = r === 'on' ? 'Reminder on. One note a day when cards are due.'
          : r === 'denied' ? 'Notifications were not allowed'
          : r === 'off-server' ? 'Reminders are not available here'
          : 'Could not turn the reminder on';
        announce(word); toast(word);
        refocus(viewSettings, '[data-remind]');
      });
      return;
    }
    var overBtn = t.closest('[data-deck-over]');
    if (overBtn) {
      var oid = overBtn.getAttribute('data-deck-over');
      S.setRetired(oid, true);
      var ow = 'Exam over. ' + nice(oid) + ' no longer counts.';
      announce(ow); toast(ow);
      route(); return;
    }
    var fg = t.closest('[data-forget]');
    if (fg) {
      var fm = sessMap(); delete fm[fg.getAttribute('data-forget')]; writeSessMap(fm);
      announce('Cleared'); toast('Cleared.');
      route(); return;
    }
    var resBtn = t.closest('[data-deck-resume]');
    if (resBtn) {
      S.setRetired(resBtn.getAttribute('data-deck-resume'), false);
      announce('Back on the schedule'); toast('Back on the schedule');
      route(); return;
    }
    if (t.closest('[data-typing-cycle]')) {
      S.setSetting('typing', !S.getSettings().typing);
      // the value swaps in place, so nothing announces the change on its own
      announce('Typing ' + (S.getSettings().typing ? 'on' : 'off'));
      refocus(viewSettings, '[data-typing-cycle]'); return;
    }

    if (t.closest('[data-qmode]') && sess) {
      // an answered-but-not-advanced question would be re-served and graded a
      // second time — take the pending answer back before switching modes
      if (sess.quiz && sess.answered && sess.history.length) {
        var hm = sess.history.pop();
        if (hm.wrote !== false) S.restore(hm.card.i, hm.before, hm.day);   // the day log goes back too
        if (hm.g === 1) sess.right = Math.max(0, sess.right - 1);
        else sess.wrong = Math.max(0, sess.wrong - 1);
        S.save(true);
      }
      // cycles MCQ → Typing → Flip for THIS session; Settings owns the default
      if (sess.quiz) { sess.quiz = false; sess.typing = true; }
      else if (sess.typing) { sess.typing = false; }
      else { sess.quiz = true; }
      sess.choices = null; sess.answered = false; sess.picked = -1;
      sess.revealed = false; sess.verdict = null; sess.typed = null; sess.hinted = false;
      renderCard(); return;
    }
    var rq = t.closest('[data-req]');
    if (rq) {
      var bx = rq.parentElement.querySelector('.reqbox');
      bx.hidden = !bx.hidden;
      if (!bx.hidden) {
        bx.querySelector('textarea').focus();
        bx.scrollIntoView({ block: 'center' });   // clear of the glass bar
      }
      return;
    }
    if (t.closest('[data-req-send]')) {
      var ta = t.closest('.reqbox').querySelector('textarea');
      var txt = ta.value.trim();
      if (!txt) { ta.focus(); return; }
      var subj = 'Request: ' + txt.replace(/\s+/g, ' ').slice(0, 60);
      window.open('https://github.com/21AG21/JuniorYearFlashcardsApp/issues/new?title=' +
        encodeURIComponent(subj) + '&body=' + encodeURIComponent(txt + '\n\n— sent from the app'),
        '_blank', 'noopener');
      ta.value = '';
      toast('Finish on GitHub. It posts from your account.');
      return;
    }
    var cyc = t.closest('[data-cycle]');
    if (cyc) {
      var ckey = cyc.getAttribute('data-cycle');
      var opts = ckey === 'sessionSize' ? [15, 20, 30, 50, 100] : [5, 10, 20, 40];
      var at = opts.indexOf(S.getSettings()[ckey]);
      S.setSetting(ckey, opts[(at + 1) % opts.length]);
      announce((ckey === 'sessionSize' ? 'Session ' : 'New cards ') +
        S.getSettings()[ckey] + (ckey === 'sessionSize' ? ' cards' : ' a session'));
      if (sess) renderCard(); else refocus(route, '[data-cycle="' + ckey + '"]');
      return;
    }
    var pace = t.closest('[data-pace]');
    if (pace) {
      var n = parseInt(pace.getAttribute('data-pace'), 10);
      if (n > 0) {
        S.setSetting('newPerSession', n);
        if (n > S.getSettings().sessionSize) S.setSetting('sessionSize', n);
        route();
        toast(n + ' new cards a day');
      }
      return;
    }
    var rst = t.closest('[data-reset]');
    if (rst) {
      if (armConfirm(rst, 'Tap again to reset')) {
        S.resetProgress(); viewSettings(); toast('Progress reset');
      }
      return;
    }
    if (t.closest('[data-tok-paste]')) {
      // the tap is the user gesture the clipboard API needs
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (txt) {
          // saving a token is not syncing — the row's word reports the truth
          if (txt && S.account.setToken(txt.trim())) { route(); toast('Token saved'); }
          else { toast('That does not look like a token'); }
        }, function () {
          var f = document.getElementById('acct-tok');
          if (f) f.focus();
          toast('Paste into the field instead');
        });
      } else {
        var f2 = document.getElementById('acct-tok');
        if (f2) f2.focus();
      }
      return;
    }
    if (t.closest('[data-export]')) {
      var data = S.exportData();
      var d8 = new Date();
      var fname = 'apdecks-' + d8.getFullYear() + '-' + ('0' + (d8.getMonth() + 1)).slice(-2) +
        '-' + ('0' + d8.getDate()).slice(-2) + '.json';
      // outside the v1 namespace on purpose — Reset progress must not erase
      // the memory of when the last backup happened
      var mark = function () { try { localStorage.setItem('apdecks.backup.last', String(Date.now())); } catch (e2) {} };
      var asFile = null;
      try { asFile = new File([data], fname, { type: 'application/json' }); } catch (e3) {}
      // a real file beats a clipboard: it survives the phone
      if (asFile && navigator.share && navigator.canShare && navigator.canShare({ files: [asFile] })) {
        navigator.share({ files: [asFile] }).then(function () { mark(); toast('Backup saved'); },
          function () { /* sheet dismissed — nothing left the phone */ });
        return;
      }
      try {
        var lnk = document.createElement('a');
        lnk.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        lnk.download = fname;
        document.body.appendChild(lnk); lnk.click(); lnk.remove();
        setTimeout(function () { URL.revokeObjectURL(lnk.href); }, 4000);
        mark(); toast('Backup downloaded');
      } catch (e4) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(data).then(function () { mark(); toast('Backup copied'); },
            function () { showBackup(data); });
        } else showBackup(data);
      }
      return;
    }
    var imp = t.closest('[data-import]');
    if (imp) {
      // Restore replaces everything — it is the most destructive control on
      // the screen and used to run on one tap, while the milder reset above it
      // asked twice. It asks twice now, and it takes the file Backup wrote.
      if (!armConfirm(imp, 'Tap again to replace everything')) return;
      var paste = function () { var text = prompt('Paste a backup'); if (text) doRestore(text); };
      if (!window.FileReader) { paste(); return; }
      var pick = document.createElement('input');
      pick.type = 'file'; pick.accept = 'application/json,.json';
      pick.style.cssText = 'position:fixed;left:-9999px;top:0';
      pick.addEventListener('change', function () {
        var f = pick.files && pick.files[0];
        pick.remove();
        if (!f) return;                        // cancelled — nothing was touched
        var fr = new FileReader();
        fr.onload = function () { doRestore(String(fr.result)); };
        fr.onerror = function () { toast('Could not read that file'); };
        fr.readAsText(f);
      });
      document.body.appendChild(pick);
      try { pick.click(); } catch (e5) { pick.remove(); paste(); }
      return;
    }
  });

  function doRestore(text) {
    if (!text) return;
    try { S.importData(text); applyTheme(); viewSettings(); toast('Backup restored'); }
    catch (err) { toast('That does not look like an AP Decks backup'); }
  }

  function showBackup(data) {
    var w = document.createElement('textarea');
    w.value = data;
    w.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;height:36vh;z-index:99;font-size:12px';
    document.body.appendChild(w); w.select();
    toast('Select and copy, then tap outside — or press Escape');
    // Escape closes it: the box autofocuses, and the global handler ignores
    // keys typed in a field, so without this there was no keyboard way out
    w.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); w.remove(); }
    });
    setTimeout(function () {
      document.addEventListener('click', function rm(ev) {
        if (ev.target === w) return;             // selecting inside must not dismiss
        w.remove(); document.removeEventListener('click', rm);
      });
    }, 400);
  }

  /* keyboard — the session's keys first, then a quiet set for the list
     screens. A key typed into any field, and any modified key, is never
     intercepted; a live game's route belongs to games.js. */
  function tabIdxOf(p0) {
    var i = ['review', 'search', 'stats', 'settings'].indexOf(p0);
    return i > -1 ? i + 1 : (p0 === 'weak' || p0 === 'stuck') ? 3 : 0;
  }
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;   // never a shortcut's shortcut
    var el = e.target;
    var inField = el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    if (inField) {
      // Escape is the one key a field may not swallow: typing mode autofocuses
      // its input on every card, which left no way out of the session at all.
      // Everywhere else it just gives the keyboard back.
      if (e.key !== 'Escape') return;
      try { el.blur(); } catch (e0) {}
      if (sess) { e.preventDefault(); exitSession(); }
      return;
    }
    if (e.repeat) return;                        // holding a key never burns cards
    /* #app is the only scroller and the document has no overflow at all, so
       PageDown, End and the arrows did nothing anywhere: 25,000 px of reader
       with Tab as the only way down, and every word of prose between two
       controls unreachable. When nothing else owns the key, they drive the
       scroller — a session keeps its own arrow keys, which are read below. */
    if (!sess && (el === document.body || el === app || !el)) {
      var page = app.clientHeight - 60, dy = 0;
      if (e.key === 'PageDown') dy = page;
      else if (e.key === 'PageUp') dy = -page;
      else if (e.key === 'ArrowDown') dy = 64;
      else if (e.key === 'ArrowUp') dy = -64;
      else if (e.key === 'End') dy = app.scrollHeight;
      else if (e.key === 'Home') dy = -app.scrollHeight;
      if (dy) { e.preventDefault(); app.scrollTop += dy; return; }
    }
    if (sess) {
      if (e.code === 'Space' || e.key === 'Enter') {
        // A focused control activates itself. The session's own Space/Enter
        // used to run first and preventDefault() the button's activation, so
        // Enter on Close revealed the card instead of closing the session —
        // and mount()'s focus restore parks focus on exactly those controls.
        var af = document.activeElement;
        if (af && af !== document.body && af.closest &&
            af.closest('button,[role="button"],a[href]') && app.contains(af)) return;
        e.preventDefault();
        if (sess.quiz) { if (sess.answered) nextQuiz(); }
        else if (!sess.revealed) reveal();
        else {
          // a breath after the reveal, and the shortcut grades what the verdict
          // says — a scored miss must never default to Good
          if (recent(sess.revealedAt, 300)) return;
          var miss = sess.verdict && sess.verdict.ok === 'miss' && typeable(sess.queue[0]);
          doGrade(miss ? 0 : 2);
        }
        return;
      }
      // the exit control's own path — never a raw hash jump
      if (e.key === 'Escape') return exitSession();
      if (!sess.quiz && sess.revealed) {
        // the home row, one finger per grade, and the numbers still count;
        // grading the last card ends the session and nulls sess — return,
        // never fall through
        var gk = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, s: 1, d: 2, f: 3 }[e.key.toLowerCase()];
        if (gk != null) return doGrade(gk);
      }
      if (sess.quiz && !sess.answered && /^[1-4]$/.test(e.key)) return pickChoice(parseInt(e.key, 10) - 1);
      // * is the star itself; s is Hard now, and a key that stars a card face
      // down and grades it face up would be a trap
      if (e.key === '*') { e.preventDefault(); starCurrent(); return; }
      // without this the shortcut's own letter lands in the note it just opened
      if (e.key === 'n') { e.preventDefault(); openNote(); return; }
      // A BARE ARROW NEVER LEAVES A SESSION. It used to switch tabs, which on
      // a laptop meant the most obvious "next card" key silently destroyed the
      // session in progress and dealt a different one. Right is the same as
      // Space — turn the card over, or advance a quiz — and Left takes back
      // the last grade. Leaving is the tab bar's job, or Escape's.
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (sess.quiz) { if (sess.answered) nextQuiz(); }
        else if (!sess.revealed) reveal();
        return;
      }
      if (e.key === 'ArrowLeft') { e.preventDefault(); undo(); return; }
      return;
    }
    var h = location.hash.replace(/^#/, '') || '/';
    var p = h.split('/').filter(Boolean);
    if (p[0] === 'game') return;                 // a live round owns its keys
    if (e.key === '/') { e.preventDefault(); goSearchFocus(); return; }
    if (e.key === 'Escape') {
      var par = parentOf(location.hash);
      if (h !== '/' && par !== '#' + h) goReplace(par);   // a no-op at the root
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && app.classList.contains('is-book')) {
      var pg = app.querySelector('.pager .' + (e.key === 'ArrowRight' ? 'next' : 'prev'));
      if (pg) { e.preventDefault(); go(pg.getAttribute('data-go')); }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      var idx = tabIdxOf(p[0] || '');
      var next = idx + (e.key === 'ArrowRight' ? 1 : -1);
      // the bar stops at its ends — wrapping would slide against the arrow
      if (next < 0 || next >= TAB_ROUTES.length) return;
      e.preventDefault();
      goTab(TAB_ROUTES[next]);
    }
  });

  /* ==========================================================================
     router
     ========================================================================== */
  var lastTabIdx = 0;
  function syncTabs(route) {
    var idx = route === '/review' ? 1 : route === '/search' ? 2 : route === '/stats' ? 3 : route === '/settings' ? 4 : 0;
    if (idx !== lastTabIdx) {          // crossing tabs — the screen slides that way
      pendingDir = idx > lastTabIdx ? 'fwd' : 'back';
      lastTabIdx = idx;
    }
    var items = tabbar.querySelectorAll('.lg-tab');
    // roving tabindex: one stop for the whole bar, arrows move inside it
    items.forEach(function (el, i) {
      el.classList.toggle('is-active', i === idx);
      el.tabIndex = i === idx ? 0 : -1;
    });
    // The sliding pill needs real geometry. Coming back from a session the bar
    // is still hidden at route time — select on the next frame, once it shows.
    var apply = function () { if (tabbar.lgSelect) tabbar.lgSelect(idx); };
    if (tabbar.offsetWidth === 0) requestAnimationFrame(function () { requestAnimationFrame(apply); });
    else apply();
  }

  var swRefreshDue = false;              // a new worker arrived mid-session
  function route() {
    var h = location.hash.replace(/^#/, '') || '/';
    var p = h.split('/').filter(Boolean);
    var root = '/' + (p[0] || '');
    if (swRefreshDue && !(p[0] === 'study' || p[0] === 'quiz' || p[0] === 'review' || p[0] === 'cram' || p[0] === 'ten' || p[0] === 'score')) {
      swRefreshDue = false; S.refreshIndex();
    }
    syncTabs(['review', 'search', 'stats', 'settings'].indexOf(p[0]) > -1 ? root
      : (p[0] === 'weak' || p[0] === 'stuck') ? '/stats' : '/');   // starred hangs off the deck list
    var onSess = (p[0] === 'study' || p[0] === 'quiz' || p[0] === 'review' || p[0] === 'cram' ||
                  p[0] === 'ten' || p[0] === 'score' || ((p[0] === 'starred' || p[0] === 'stuck') && p[1] === 'go'));
    // a deal left for another screen, or for another deal, is kept for the
    // day and offered back as a Continue line — it used to be dropped the
    // moment another course was opened
    if (sess && (!onSess || (sess.h && sess.h !== h))) { saveSess(); sess = null; }
    // leaving the unit page drops its filter, so coming back is always the
    // whole unit — the word lives in memory, and that memory ends with the
    // screen. This sits above every early return, or "#/" would slip past it.
    if (!(p[0] === 'd' && p[2] === 'u' && p[1] + '/' + p[3] === unitFilterFor)) unitFilterFor = '';
    // the same rule for the search scope: leaving the screen widens it again,
    // or you come back an hour later to "No matches in English"
    if (p[0] !== 'search') searchState.deck = null;
    if (p[0] !== 'recall') recallState = null;
    if (!(p[0] === 'd' && p[4] === 'frq' && p[5] != null)) frqState = null;
    if (window.Games) window.Games.onRoute(p[0] || '');

    if (!p.length) {
      if (isWide()) {
        var ixw = S.getIndex();
        var firstDue = null;
        ixw.courses.forEach(function (c) { var dk = S.getDeck(c.id); if (!firstDue && dk && S.deckStats(dk).due) firstDue = c.id; });
        return viewCourse(lastDeckId || firstDue || ixw.courses[0].id);
      }
      return viewDecks();
    }
    // A deep link can land before its deck has arrived — the app paints on the
    // index now, so the decks are still in flight. Say "Loading" and repaint
    // when it lands, rather than bouncing the reader off their own lesson.
    var wantsDeck = (p[0] === 'd' || p[0] === 'study' || p[0] === 'quiz' || p[0] === 'cram' ||
                     p[0] === 'score' || p[0] === 'recall') && p[1];
    if (wantsDeck && !S.getDeck(p[1]) && S.deckPending && S.deckPending(p[1]) &&
        (S.getIndex().courses || []).some(function (c) { return c.id === p[1]; })) {
      return mount('<div class="head"><h1>' + esc(nice(p[1])) + '</h1>' + RING + '</div>');
    }
    if (p[0] === 'd' && p[1] && p[2] === 'a' && p[3]) return viewAbout(p[1], p[3]);
    if (p[0] === 'd' && p[1] && p[2] === 'w') return viewWords(p[1]);
    if (p[0] === 'd' && p[1] && p[2] === 'plan') return viewPlan(p[1]);
    if (p[0] === 'd' && p[1] && p[2] === 'b' && p[3]) return viewPhase(p[1], p[3]);
    if (p[0] === 'd' && p[1] && p[2] === 'l' && p[3]) return viewLesson(p[1], p[3]);
    if (p[0] === 'd' && p[1] && p[2] === 'r' && p[3]) return viewResource(p[1], p[3]);
    if (p[0] === 'd' && p[1] && p[2] === 'g') return viewFocus(p[1]);
    if (p[0] === 'd' && p[1] && p[2] === 'k') return viewSkills(p[1]);
    if (p[0] === 'd' && p[1] && p[2] === 'u' && p[3] && p[4] === 'frq' && /^\d+$/.test(p[5] || '')) return viewFRQPractice(p[1], p[3], +p[5]);
    if (p[0] === 'd' && p[1] && p[2] === 'u' && p[3] && p[4] === 'frq') return viewFRQ(p[1], p[3]);
    if (p[0] === 'd' && p[1] && p[2] === 'u' && p[3]) return viewUnit(p[1], p[3]);
    if (p[0] === 'd' && p[1]) return viewCourse(p[1]);
    if (p[0] === 'study') return startSession(p[1], p[2] || 'smart', p[3], false);
    if (p[0] === 'quiz') return startSession(p[1], p[2] || 'smart', p[3], true);
    if (p[0] === 'review') return startReview();
    if (p[0] === 'ten') return startReview(10);
    if (p[0] === 'cram') return startCram(p[1], p[2], p[3]);
    if (p[0] === 'score' && p[1]) return startScore(p[1], p[2]);
    if (p[0] === 'recall' && p[1] && p[2] && p[3]) return viewRecall(p[1], p[2], decodeURIComponent(p[3]));
    if (p[0] === 'weak') return viewWeak();
    if (p[0] === 'stuck') return p[1] === 'go' ? startStuck() : viewStuck();
    if (p[0] === 'starred') return p[1] === 'go' ? startStarred() : viewStarred();
    if (p[0] === 'search') return viewSearch();
    if (p[0] === 'stats') return viewStats();
    if (p[0] === 'settings') return viewSettings();
    if (p[0] === 'how') return viewHow();
    if (p[0] === 'games' && window.Games) return window.Games.hub();
    if (p[0] === 'game' && p[1] && window.Games) return window.Games.play(p[1], p[2]);
    // an unknown hash is the root, and on two panes the root is a course —
    // falling through to viewDecks() painted the deck list in both panes
    if (h !== '/') return goReplace('#/');
    return viewDecks();
  }

  var TAB_ROUTES = ['/', '/review', '/search', '/stats', '/settings'];
  // tab-to-tab movement replaces the entry — fourteen tab taps must not
  // become fourteen steps for the platform back gesture to unwind
  function goTab(r) {
    var cur = location.hash.replace(/^#/, '') || '/';
    if (TAB_ROUTES.indexOf(cur) > -1) goReplace('#' + r);
    else go('#' + r);
  }
  tabbar.addEventListener('lg-change', function (e) {
    var r = TAB_ROUTES[e.detail];
    if (r) goTab(r);
  });
  tabbar.addEventListener('click', function (e) {
    // lg-change already fired from the pill's own pointerup, and mounting the
    // screen twice cancels the slide. A keyboard-synthesised click carries
    // detail 0; a bar that never initialised has no lgSelect and still needs
    // this path.
    if (tabbar.lgSelect && e.detail !== 0) return;
    var tab = e.target.closest('[data-route]');
    if (tab) goTab(tab.getAttribute('data-route'));
  });
  // Enter, Space and the arrows come from the pill group itself (liquid-glass),
  // which fires the same lg-change a tap does — one path, not two.

  // the store just found out it cannot write — repaint so the line shows
  window.addEventListener('apdecks-storage', function () {
    if (sess) renderCard(); else if (!window.Games || !window.Games.onResize()) route();
  });
  window.addEventListener('hashchange', route);

  /* A lesson is a long read, and crossing the 900px breakpoint re-routes it —
     landing back at the top of a 4,000px page loses your place. Sessions and
     games already survive the flip; the book is put back where it was. */
  var bookFrac = -1, wasWide = isWide(), sizeTimer = null;
  document.addEventListener('scroll', function (e) {
    var sc = e.target;
    if (sc !== app && !(sc.classList && sc.classList.contains('pane-r'))) return;
    if (!app.classList.contains('is-book')) { bookFrac = -1; return; }
    var span = sc.scrollHeight - sc.clientHeight;
    // a pane that has not laid out yet says nothing — keep the last real read
    if (span > 40) bookFrac = sc.scrollTop / span;
  }, true);

  function reflowSplit() {
    // both the MQ change and the resize watchdog land here; whichever arrives
    // first owns the flip, or the second re-routes over the first's work
    wasWide = isWide();
    // never restart a session — or a live game round — over a resize
    if (sess) return renderCard();
    if (window.Games && window.Games.onResize()) return;
    var f = bookFrac;
    route();
    if (f < 0 || !app.classList.contains('is-book')) return;
    // the new pane has to lay out before its height means anything, and a long
    // lesson settles over a few frames — try until it has one
    var tries = 0;
    (function settle() {
      var now = app.querySelector('.pane-r') || app;
      var span = now.scrollHeight - now.clientHeight;
      if (span > 40) { now.scrollTop = Math.round(f * span); return; }
      if (tries++ < 12) requestAnimationFrame(settle);
    })();
  }
  WIDE_MQ.addEventListener('change', reflowSplit);
  // Some engines never fire the MQ change event under emulation or in-page
  // resizes — watch resize too and re-render only when the split actually flips.
  window.addEventListener('resize', function () {
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(function () {
      if (isWide() === wasWide) { fitVals(); return; }   // widths moved — refit values
      wasWide = isWide();
      reflowSplit();
    }, 120);
  });

  /* the book: done marks, the all-levels word, term panels, the level switcher */
  document.addEventListener('click', function (e) {
    var dn = e.target.closest('[data-book-done]');
    if (dn) { var on = !dn.classList.contains('on'); setBookDone(dn.getAttribute('data-book-done'), on); dn.classList.toggle('on', on); return; }
    var jp = e.target.closest('[data-jump]');
    if (jp) {
      var part = document.getElementById(jp.getAttribute('data-jump'));
      if (part) {
        var top = app.querySelector('.book .topline'), pad = top ? top.getBoundingClientRect().height + 12 : 12;
        var sc = app.scrollHeight > app.clientHeight ? app : document.scrollingElement;
        var y = part.getBoundingClientRect().top - (sc === app ? app.getBoundingClientRect().top : 0) + sc.scrollTop - pad;
        try { sc.scrollTo({ top: y, behavior: 'smooth' }); } catch (err) { sc.scrollTop = y; }
      }
      return;
    }
    var ck = e.target.closest('[data-book-check]');
    if (ck) {
      var li = ck.closest('li'), on2 = !li.classList.contains('on');
      setBookCheck(ck.getAttribute('data-book-check'), on2);
      li.classList.toggle('on', on2); ck.classList.toggle('on', on2); ck.setAttribute('aria-pressed', String(on2));
      var row = ck.closest('.ckrow'), cnt = row && row.querySelector('.ckcnt');
      if (cnt) cnt.textContent = row.querySelectorAll('.cklist li.on').length + ' of ' + row.querySelectorAll('.cklist li').length;
      return;
    }
    var al = e.target.closest('[data-book-all]');
    if (al) { ladder.all = !ladder.all; applyLevel(); readMinutes(); return; }
    var tb = e.target.closest('[data-term]');
    if (tb) {
      var host = tb.closest('.term') || tb.closest('p, li, .lede, .note, .try, .d');
      if (!host) return;
      var open = host.nextElementSibling && host.nextElementSibling.classList && host.nextElementSibling.classList.contains('tmx') ? host.nextElementSibling : host.querySelector('.tmx');
      if (open) { open.remove(); tb.classList.remove('on'); return; }
      var root = app.querySelector('.book'), deckId = curDeckId, bk = deckId && bookOf(deckId);
      var t = bk && bk.terms[tb.getAttribute('data-term')];
      if (!t || !root) return;
      // in the list the word and its definition already show; inline, only the word does
      var panel = document.createElement('div'); panel.innerHTML = termPanelHTML(t, !tb.closest('.term'));
      var el = panel.firstChild;
      if (tb.closest('.term')) host.appendChild(el); else host.insertAdjacentElement('afterend', el);
      tb.classList.add('on');
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'wq') filterWords(e.target.value);
  });
  document.addEventListener('lg-change', function (e) {
    if (!e.target || e.target.id !== 'lvlseg') return;
    ladder.lvl = e.detail; ladder.all = false; applyLevel(); readMinutes();
  });

  /* account: paste-token commit + disconnect + re-render when a pull merges */
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'acct-tok') {
      if (S.account.setToken(e.target.value)) {
        // never rebuild the DOM out from under the focused field mid-blur
        try { e.target.blur(); } catch (err) {}
        setTimeout(function () { route(); toast('Account connected'); }, 0);
      } else if (e.target.value.trim()) {
        toast('That does not look like a token');
      }
    }
  });
  document.addEventListener('click', function (e) {
    var off = e.target.closest('[data-acct-off]');
    if (off && armConfirm(off, 'Tap again to turn off')) { S.account.clearToken(); route(); }
    var idb = e.target.closest('[data-acct-id]');
    if (idb) {
      var id = S.account.ownerId();
      var done = function () { toast('Copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(done, function () { toast(id); });
      else toast(id);
    }
  });
  window.addEventListener('apdecks-sync', function (ev) {
    if (ev.detail && ev.detail.changed) route();   // fresher progress just merged in
  });

  /* ==========================================================================
     boot
     ========================================================================== */
  if (window.Games) window.Games.init({
    mount: mount, esc: esc, go: go, toast: toast, nice: nice, backbar: backbar,
    // a game belongs to a course, and on two panes the rail's lit row has to
    // say which — it used to stay on whatever course you came from
    markDeck: function (id) { curDeckId = id || null; }
  });
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  bare('<div class="head"><span class="k">AP Decks</span>' + RING + '</div>');
  // the skip link's own hash used to be caught by the router and sent home
  var skipLink = document.querySelector('.skip');
  if (skipLink) skipLink.addEventListener('click', function (e) {
    e.preventDefault(); try { app.focus(); } catch (x) {}
  });

  /* The deck list needs the 6 KB index, not the 2.8 MB of decks behind it.
     Holding the whole app until the last deck landed meant 16.5 s of a blank
     screen on a slow connection — 36 s with the private deck — while every
     row's name and count was already in hand. Paint on the index, fill in as
     each deck arrives. */
  var booting = true;
  window.addEventListener('apdecks-deck', function () {
    if (!sess && !booting) route();
  });
  S.loadIndex().then(function (ix) {
    booting = false;
    // start every deck fetching BEFORE the first route, so a deep link to a
    // lesson sees "pending" rather than "missing" and waits instead of
    // bouncing the reader back to the course
    (ix.courses || []).forEach(function (c) { S.loadDeck(c.id); });
    route();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
      // A version bump lands while the page is open: the new worker claims it
      // and its precached index may carry a deck this shelf has never listed.
      // Re-shelve now, not on the next visit — unless a session is running,
      // in which case it waits for the screen to change.
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        // the shell this page is running is now the OLD one: the new worker
        // has cached a newer app.js and app.css that this page will never
        // execute until it is loaded again. An open PWA on a desk stays on
        // last week's code for as long as nobody closes it, so a fix that
        // shipped days ago looks unshipped. The page reloads itself the next
        // time it is out of sight — never under the reader's hands, and a
        // session in progress is saved on every grade and resumes.
        shellStale = true;
        if (sess) { swRefreshDue = true; return; }
        S.refreshIndex();
      });
      document.addEventListener('visibilitychange', function () {
        if (shellStale && document.visibilityState === 'hidden') { saveSess(); location.reload(); }
      });
      // a tap on the day's note: the worker brings this page forward and
      // says where to land
      navigator.serviceWorker.addEventListener('message', function (e) {
        var to = e && e.data && e.data.go;
        if (typeof to === 'string' && /^#\//.test(to)) location.hash = to;
      });
    }
    return S.loadAll();
  }).then(function () {
    if (!sess) route();                    // counts and due numbers settle
    warmSearch();
    S.remind.sync();                       // the days ahead, as this device now sees them
  }).catch(function (err) {
    try { console.error(err); } catch (x) {}
    bare('<div class="head"><span class="k">AP Decks</span><h1>Could not load the decks</h1>' +
      '<div class="sub">Check the connection and try again.</div></div>' +
      '<button class="act" onclick="location.reload()">Try again</button>');
  });
})();
