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

  function mount(html, opts) {
    var keepFocus = opts && opts.session ? focusKey() : '';
    var dir = opts && opts.session ? '' : pendingDir;
    pendingDir = '';
    // a device that cannot write is a device losing every grade you give it —
    // the store has known this all along and nothing ever said so
    var warn = S.storageFailed && S.storageFailed()
      ? '<div class="warnline">Not saving — this browser is refusing to store progress.</div>' : '';
    var shell = '<div class="screen' + (dir ? ' ' + dir : '') + '">' + warn + html + '</div>';
    if (isWide()) {
      // Two full-height panes: the deck list lives on the left, every view on
      // the right — the same content as the phone, never extra chrome.
      app.innerHTML = '<div class="pane-l">' + decksListHTML() + '</div>' +
        '<div class="pane-r"><div class="inner">' + shell + '</div></div>';
    } else {
      app.innerHTML = shell;
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
      return '<li><button class="ledger' + (c.id === curDeckId ? ' on' : '') + '" data-go="#/d/' + c.id + '">' +
        '<span class="lname">' + esc(nice(c.id)) + '</span>' +
        '<span class="lval num">' + c.count.toLocaleString() + '</span>' +
        (st.due ? '<span class="lsub">' + st.due.toLocaleString() + ' due</span>' : '') +
        '</button></li>';
    }).join('');
    var hero = due ? plural(due, 'card') + ' due' : ix.total.toLocaleString() + ' cards';
    return '<div class="head">' +
        (due ? '<button class="hero-tap" data-go="#/review"><h1>' + esc(hero) + '</h1></button>'
             : '<h1>' + esc(hero) + '</h1>') + '</div>' +
      '<ul class="list tight">' + rows + '</ul>' +
      backupNudge(seen) +
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

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1700);
  }
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
    if (p[0] === 'd' && p[2] === 'u') return '#/d/' + p[1];
    if (p[0] === 'd' && p[2] === 'l') { var bi = bookOf(p[1]), it = bi && bi.items[p[3]]; return '#/d/' + p[1] + (it ? '/u/' + it.u : ''); }
    if (p[0] === 'd' && p[2] === 'r') { var br = bookOf(p[1]), rp = br && br.resPhase[p[3]]; return '#/d/' + p[1] + (rp ? '/b/' + rp.n : ''); }
    if (p[0] === 'd' && p[2] === 'b') { var bp = bookOf(p[1]), ph = bp && bp.phases[p[3]]; return '#/d/' + p[1] + (ph ? '/u/' + ph.u : ''); }
    if ((p[0] === 'study' || p[0] === 'quiz') && p[1]) return '#/d/' + p[1] + (p[3] ? '/u/' + p[3] : '');
    if (p[0] === 'cram' && p[1]) return p[2] ? '#/d/' + p[1] + '/u/' + p[2] : '#/d/' + p[1];
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
  var NICE = { lang: 'English', chem: 'Chemistry', french: 'French', calcbc: 'Calc BC', apush: 'US History' };
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
      var dk = S.getDeck(c.id); if (!dk) return;
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
        (spare > 0 ? ' · ' + spare + ' days spare' : '')) + '</div>';
    }
    // the honest version: name the shortfall, and make the rate that closes it
    // one tap away — a forecast you cannot act on is just bad news. The rate
    // is SOLVED for, not scaled: raising it changes every deck's share, so
    // "16 a day covers it" once set turned into "18 a day covers it".
    var want = paceFor(deckId, cv.days);
    if (!want) return '<div class="ulabel cover">' +
      esc('Not every card before the exam at ' + cv.perDay + ' new a day') + '</div>';
    return '<div class="ulabel cover">' +
      esc('Not every card before the exam at ' + cv.perDay + ' new a day · ') +
      '<button class="pace" data-pace="' + want + '">' + want + ' a day covers it</button></div>';
  }
  function dateWord(dayN) {
    var dt = new Date(S.dayKey(dayN) + 'T12:00:00Z');
    return dt.getUTCDate() + ' ' + MONTHS[dt.getUTCMonth() + 1];   // MONTHS is 1-indexed
  }

  function paceLine(d) {
    var p = corePace(d);
    if (!p) return '';
    // "May 3 · 241 days" in grey above the title read as a date with no
    // subject — it could have been a goal, or when the deck was written
    var out = 'Exam ' + examName(d.id) + ' · ' + p.days + ' days';
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
    if (!p.left) return 'done';
    if (!p.sure) return '';
    if (p.drift <= -3) return (-p.drift) + ' days behind';
    if (p.drift >= 3) return p.drift + ' days ahead';
    return 'on pace';
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
        cd.r += 1;
        cd.i = cd.r === 1 ? 1 : cd.r === 2 ? 3 : Math.max(1, Math.round(cd.i * cd.e));
        cd.d = day + cd.i;
      }
      // and the new cards it introduces, which come back tomorrow
      var got = Math.min(fresh, newLeft, Math.max(0, size - take));
      newLeft -= got;
      for (var g = 0; g < got; g++) sched.push({ d: day + 1, i: 1, e: 2.5, r: 1 });
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
      (fresh < size ? ' — with nothing due, a session is ' + fresh : '');
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
      (fix ? ' — a session of ' + fix + ' would hold it.'
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
      if (s.d <= today && (s.r || s.t || s.l)) score += Math.min(2, (today - s.d) / 7);
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
    var due = [], fresh = [];
    decks.forEach(function (d) {
      S.pool(d, (opts && opts.unit) || null, null).forEach(function (c) {
        var s = S.cs(c.i);
        var studied = s && (s.r || s.t || s.l);
        c._sc = cardScore(c, d, today);
        if (S.isNew(c.i) || !studied) fresh.push(c);
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
       one card from seven Chemistry units. An explicitly sized deal ("Quick
       ten") is a request for that many cards, so it sets its own cap. */
    var newCap = (opts && opts.noNew) ? 0
      : (opts && opts.limit) ? limit : set.newPerSession;
    var byScore = function (a, b) { return b._sc - a._sc; };
    S.shuffle(due); S.shuffle(fresh);          // ties break fresh every day
    due.sort(byScore); fresh.sort(byScore);
    var wantNew = Math.min(newCap, fresh.length, limit);
    var takeDue = due.slice(0, Math.max(0, limit - wantNew));
    // reviews came up short — the room they left goes back to new cards, and
    // the new cards are taken deck by deck in rotation, so a first session
    // touches every course instead of twenty cards of the heaviest unit
    var picked = takeDue.concat(roundRobin(fresh, Math.min(newCap, limit - takeDue.length)));
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
    var dark = matchMedia('(prefers-color-scheme: dark)').matches;
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.remove(); });
    var m = document.createElement('meta');
    m.name = 'theme-color'; m.content = dark ? '#000000' : '#f2f2f4';
    document.head.appendChild(m);
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
      // second line on the rows where it is true (skill §4.1)
      return '<li><button class="ledger" data-go="#/d/' + c.id + '">' +
        '<span class="lname">' + esc(nice(c.id)) + '</span>' +
        '<span class="lval num">' + c.count.toLocaleString() + '</span>' +
        (st.due ? '<span class="lsub">' + st.due.toLocaleString() + ' due</span>' : '') +
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
    mount(
      '<div class="head">' +
        (due ? '<button class="hero-tap" data-go="#/review"><h1>' + esc(hero) + '</h1></button>'
             : '<h1>' + esc(hero) + '</h1>') +
      '</div>' +
      (deal0 ? '<button class="act" data-go="#/review">Start · ' + deal0 + ' cards</button>' : '') +
      '<ul class="list tight">' + rows + '</ul>' +
      // these three are navigation, not modes: as a stack of 26px words they
      // pushed themselves 92px below the fold, under the tab bar, where the
      // first tap on "Starred" landed on the Search tab instead
      '<div class="modes nav" style="margin-top:var(--s-5)">' +
        '<button class="textbtn" data-go="#/ten">Quick ten</button>' +
        '<button class="textbtn" data-go="#/games">Games</button>' +
        // starring a card in a session used to be a one-way trip: the star was
        // only reachable from the deck it belonged to, and never as a list.
        // The word is here before the first star, or there is nowhere for one
        // to go and no way to find out what the star is for.
        '<button class="textbtn" data-go="#/starred">Starred' +
          (nStarred ? ' · ' + nStarred.toLocaleString() : '') + '</button>' +
      '</div>' + nudge
    );
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
      '<div class="head"><span class="k">' + esc(nice(deckId)) + '</span><h1>Loading</h1></div>');
    if (!d) return mount(
      '<div class="head"><span class="k">' + esc(nice(deckId)) + '</span>' +
      '<h1>Not downloaded</h1><div class="sub">This course did not load. Open it once with a connection.</div></div>' +
      '<button class="act" onclick="location.reload()">Try again</button>' +
      '<button class="textbtn" data-back>Decks</button>');
    curDeckId = lastDeckId = deckId;
    var st = S.deckStats(d);
    // units in course order, each under a small muted label — never a header (skill §4.2)
    // once anything in the deck is studied the column flips to mastery, all
    // rows at once — never a % beside a count in the same column
    var anySeen = st.seen > 0;
    var units = d.units.map(function (u) {
      var us = S.unitStats(d, u.id);
      if (!us.total) return '';
      var bits = [];
      var wt = weightText(u);
      if (wt) bits.push(wt);
      // the column flips to mastery once anything is studied, and the count
      // used to vanish with it — "0%" beside nothing is not progress
      if (anySeen) bits.push(us.seen ? us.seen.toLocaleString() + ' of ' + us.total.toLocaleString() + ' seen'
                                     : 'not started · ' + us.total.toLocaleString() + ' cards');
      if (us.due) bits.push(us.due.toLocaleString() + ' due');
      return '<li>' +
        '<div class="ulabel">Unit ' + u.n + '</div>' +
        '<button class="ledger mid' + (us.pct >= 0.9 ? ' done' : '') + '" data-go="#/d/' + deckId + '/u/' + u.id + '">' +
        '<span class="lname">' + esc(u.title) + '</span>' +
        '<span class="lval num">' + (anySeen ? pct(us.pct) : us.total.toLocaleString()) + '</span>' +
        (bits.length ? '<span class="lsub">' + esc(bits.join(' · ')) + '</span>' : '') +
        '</button></li>';
    }).join('');

    // the app knows when the exam is — the countdown sits over the course name
    var pl = paceLine(d);
    var cl = coverLine(deckId);
    var dealNow = buildDaily({ deck: d }).length;

    // the name is the way back; the number is a fact, not a hidden link
    mount(
      (pl ? '<div class="ulabel" style="margin-top:0">' + esc(pl) + '</div>' : '') +
      cl +
      '<div class="dhero">' +
        '<button class="dn" data-back>' + esc(nice(d)) + '</button>' +
        '<span class="dv num">' + st.total.toLocaleString() + '</span>' +
      '</div>' +
      // "Review 20" used to name the DUE count and then deal thirty, because
      // the deal is due cards plus the day's new ones. It names the deal.
      '<button class="act" data-go="#/study/' + deckId + '/smart">' +
        (dealNow ? (st.due && dealNow === st.due ? 'Review ' : 'Study ') + dealNow.toLocaleString()
                 : 'Study') + '</button>' +
      '<div class="modes">' +
        '<button class="textbtn" data-go="#/study/' + deckId + '/core">High-yield</button>' +
        '<button class="textbtn" data-go="#/quiz/' + deckId + '/smart">Quiz</button>' +
        (st.starred ? '<button class="textbtn" data-go="#/study/' + deckId + '/starred">Study starred</button>' : '') +
        (st.due > S.getSettings().sessionSize
          ? '<button class="textbtn" data-go="#/study/' + deckId + '/due">Catch up · ' +
            st.due.toLocaleString() + '</button>' : '') +
        '<button class="textbtn" data-go="#/study/' + deckId + '/hard">Trouble spots</button>' +
        '<button class="textbtn" data-go="#/study/' + deckId + '/all">Shuffle</button>' +
        (window.Games && window.Games.linksFor(deckId).length
          ? '<button class="textbtn" data-go="#/games">Games</button>' : '') +
      '</div>' +
      '<ul class="list" style="margin-top:var(--s-4);gap:0">' + units + '</ul>'
    );
  }

  /* ==========================================================================
     VIEW · one unit
     ========================================================================== */
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
    var list = shown.map(function (c, n) {
      var known = S.isKnown(c.i);
      return '<li><button class="qrow' + (known ? ' done' : '') + '" data-peek="' + c.i + '">' +
        '<span class="qq' + (known ? ' dim' : '') + '">' + T.html(c.q) + '</span>' +
        '<span class="qa" hidden>' + T.html(c.a) + '</span>' +
        (S.noteOf(c.i) ? '<span class="qn" hidden>' + esc(S.noteOf(c.i)) + '</span>' : '') +
        '<span class="qmeta">' + esc(verb(c.v)) + (topicLabel(c) ? ' · ' + esc(topicLabel(c)) : '') + '</span>' +
        '</button>' + rowActs(c) + '</li>';
    }).join('');

    mount(
      '<div class="ulabel" style="margin-top:0">' + esc(nice(d)) + ' · Unit ' + u.n +
        (weightText(u) ? ' · ' + esc(weightText(u)) : '') + '</div>' +
      '<div class="dhero">' +
        '<button class="dn" data-back>' + esc(u.title) + '</button>' +
        '<span class="dv num">' + us.total.toLocaleString() + '</span>' +
      '</div>' +
      '<button class="act" data-go="#/study/' + deckId + '/smart/' + unitId + '">' + (us.due ? 'Review ' + us.due.toLocaleString() : 'Study') + '</button>' +
      '<div class="modes">' +
        '<button class="textbtn" data-go="#/study/' + deckId + '/core/' + unitId + '">High-yield</button>' +
        '<button class="textbtn" data-go="#/quiz/' + deckId + '/smart/' + unitId + '">Quiz</button>' +
        '<button class="textbtn" data-go="#/cram/' + deckId + '/' + unitId + '">Cram</button>' +
        // the print sheet has existed in the stylesheet for months with no way
        // in: two columns, questions and answers, no chrome
        '<button class="textbtn" data-print>Print</button>' +
        gameLinks +
      '</div>' +
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
  function bookDone() { return S.getSettings().ladderDone || {}; }
  function setBookDone(id, on) {
    var d = {}; var cur = bookDone();
    for (var k in cur) d[k] = cur[k];
    if (on) d[id] = 1; else delete d[id];
    S.setSetting('ladderDone', d);
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
  }

  /* the unit page: what to read, with progress, before the cards */
  function bookUnitHTML(deckId, unitId) {
    var bk = bookOf(deckId);
    if (!bk || !bk.byUnit[unitId]) return '';
    var done = bookDone();
    var lis = bk.byUnit[unitId].map(function (ph) {
      var n = ph.items.length, dn = ph.items.filter(function (it) { return done[it.id]; }).length;
      return '<li><button class="ph" data-go="#/d/' + deckId + '/b/' + ph.n + '"><span class="n"><span>Phase ' + ph.n + '</span><span class="pct">' + dn + ' / ' + n + '</span></span>' +
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
    var after = (ph.after || []).map(function (s) { return '<div class="row"><h3>' + esc(secLabel(s)) + '</h3>' + bookBlocks(s.b) + '</div>'; }).join('');
    var html = toplineHTML('#/d/' + deckId + '/u/' + ph.u, nice(d) + (u ? ' · Unit ' + u.n : '') + ' · Phase ' + ph.n) +
      '<section class="page phase stack-l"><div class="stack">' +
      '<div class="eyebrow">Phase ' + ph.n + (ph.meta ? ' · ' + mdT(ph.meta) : '') + '</div>' +
      '<h2>' + esc(ph.title) + '</h2>' +
      (goal ? '<p class="lede">' + bookBlocks(goal.b).replace(/^<p>|<\/p>$/g, '') + '</p>' : '') +
      wordsHTML(bk, ph.terms) + '</div>' +
      (learn ? '<div class="row"><h3>What you need to learn</h3>' + bookBlocks(learn.b) + '</div>' : '') +
      '<div class="row"><h3>Lessons and topics</h3>' + lessons + '</div>' +
      (res ? '<div class="row"><h3>Read and watch</h3><p class="note">Every one explained at every level, with a study guide.</p>' + res + '</div>' : '') +
      after + '</section>';
    endTerms();
    bookMount(html);
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
      '<div class="head"><div class="hd"><div class="eyebrow">Six levels' + (nq ? ' · ' + nq + (nq === 1 ? ' question' : ' questions') + ' to check yourself' : '') + '</div>' + checkRow(deckId, it) + '</div>' +
      '<h3 class="title">' + mdT(it.title) + '</h3>' +
      (goal ? '<p class="lede">' + bookBlocks(goal.b).replace(/^<p>|<\/p>$/g, '') + '</p>' : '') +
      (it.lives ? '<p class="note">' + mdT(it.lives) + '</p>' : '') +
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
  function saveSess() {
    try {
      if (!sess || !sess.queue.length) { localStorage.removeItem(SESS_KEY); return; }
      localStorage.setItem(SESS_KEY, JSON.stringify({
        h: location.hash.replace(/^#/, '') || '/',
        day: S.dayNum(),
        ids: sess.queue.map(function (c) { return c.i; }),
        done: sess.done, planned: sess.planned, lapsed: sess.lapsed || {},
        again: sess.again, hard: sess.hard || 0, good: sess.good, easy: sess.easy,
        right: sess.right, wrong: sess.wrong,
        quiz: !!sess.quiz, typing: !!sess.typing, cram: !!sess.cram,
        mixed: !!sess.mixed, mode: sess.mode, unitId: sess.unitId || null,
        deck: sess.deck ? sess.deck.id : null, back: sess.back || null
      }));
    } catch (e) {}
  }
  function clearSess() { try { localStorage.removeItem(SESS_KEY); } catch (e) {} }
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
    var raw; try { raw = localStorage.getItem(SESS_KEY); } catch (e) { return false; }
    if (!raw) return false;
    var j; try { j = JSON.parse(raw); } catch (e) { return false; }
    return !!j && j.day === S.dayNum() && j.h === (location.hash.replace(/^#/, '') || '/');
  }
  /* the saved deal for THIS route, if it is still today's */
  function savedSess() {
    var raw;
    try { raw = localStorage.getItem(SESS_KEY); } catch (e) { return null; }
    if (!raw) return null;
    var j; try { j = JSON.parse(raw); } catch (e) { return null; }
    if (!j || j.day !== S.dayNum()) { clearSess(); return null; }
    if (j.h !== (location.hash.replace(/^#/, '') || '/')) return null;
    var q = (j.ids || []).map(cardById).filter(Boolean);
    if (q.length !== (j.ids || []).length) {
      // a deck that has not arrived is not a corrupt blob — never delete on it
      if (!decksInFlight()) clearSess();
      return null;
    }
    if (!q.length) { clearSess(); return null; }
    return {
      deck: j.deck ? S.getDeck(j.deck) : null, unitId: j.unitId, mode: j.mode,
      quiz: j.quiz, cram: j.cram, mixed: j.mixed, typing: j.typing, back: j.back,
      queue: q, done: j.done || 0, planned: j.planned || q.length, lapsed: j.lapsed || {},
      again: j.again || 0, hard: j.hard || 0, good: j.good || 0, easy: j.easy || 0,
      right: j.right || 0, wrong: j.wrong || 0,
      revealed: false, answered: false, typed: '', history: [], resumed: true
    };
  }
  /* the screen that waits for the decks so the saved deal can be read */
  function waitingScreen() {
    mount('<div class="head"><h1>Loading</h1><div class="sub">Finding where you were.</div></div>');
    return true;
  }
  function resume() {
    var r = savedSess();
    if (!r) return false;
    sess = r;
    renderCard();
    toast(plural(r.queue.length, 'card') + ' left — picked up where you were');
    return true;
  }

  function startSession(deckId, mode, unitId, quiz) {
    var d = S.getDeck(deckId);
    if (!d) return go('#/');
    if (savedPending()) return waitingScreen();
    if (resume()) return;
    // the daily path deals the chosen queue; fixed modes stay literal
    var lesson = (mode || '').indexOf('l:') === 0 ? mode.slice(2) : null;
    var queue = lesson ? lessonQueue(d, lesson)
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
      back: lesson ? '#/d/' + deckId + '/l/' + lesson : null,
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
    var queue = buildDaily(limit ? { limit: limit } : null);
    if (!queue.length) {
      // say when the next card comes back, and where — not just that none are due
      var today = S.dayNum(), next = null, nextDeck = null;
      S.getIndex().courses.forEach(function (c) {
        var d = S.getDeck(c.id); if (!d) return;
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
        '<button class="textbtn" data-go="#/">Decks</button>'
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
  function startCram(deckId, unitId) {
    var d = S.getDeck(deckId);
    if (!d) return go('#/');
    if (savedPending()) return waitingScreen();
    if (resume()) return;
    if (unitId && !d.unitById[unitId]) return go('#/d/' + deckId);
    var cards = d.cards.filter(function (c) { return !unitId || c.u === unitId; });
    if (!cards.length) return go('#/d/' + deckId);
    S.shuffle(cards);
    cards.sort(function (a, b) { return cramRank(a) - cramRank(b); });
    sess = {
      deck: d, unitId: unitId || null, mode: 'cram', cram: true, quiz: false,
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

  function renderEmptySession(d, unitId, mode) {
    var label = mode === 'starred' ? 'No starred cards yet.' :
                mode === 'stuck' ? 'Nothing is sticking — no card has been missed three times.' :
                mode === 'hard' ? 'No trouble spots — nothing has been missed twice.' :
                'Nothing due here right now.';
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
    // never truncated, and it names the CED topic the card comes from
    var ced = c && c.t && /^\d+\.\d+$/.test(c.t) ? ' · CED ' + c.t : '';
    var scope = d ? nice(d) + (unit ? ' · ' + unit.title : '') + ced : 'Review';
    return '<div class="sess-top">' +
      '<span class="scope">' + esc(scope) + '</span>' +
      '<span class="pos num">' + Math.min(sess.done + 1, sess.planned) + ' of ' + sess.planned +
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
      '<button class="sizebtn" data-qmode>' + (sess.quiz ? 'MCQ' : (sess.typing ? 'Typing' : 'Flip')) + '</button>' +
      '</div>';
  }

  /* Your own words on a card. It shows on the back, under whatever the deck
     had to say, and the same "Note" control opens it for editing. The field is
     written into the rendered card and never re-rendered while you type — a
     repaint per keystroke would lose the caret every time. */
  function noteHTML(c) {
    if (sess && sess.noting) {
      return '<div class="mynote editing reveal"><textarea id="mynote" rows="2" maxlength="' +
        (S.NOTE_MAX || 400) + '" placeholder="your own words — a mnemonic, the trap you keep hitting">' +
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

  function topicLabel(c) {
    if (!c.t) return c.c ? 'high-yield' : '';
    var t = /^\d+\.\d+$/.test(c.t) ? 'CED ' + c.t : c.t;
    return t + (c.c ? ' · high-yield' : '');
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
        ? '<div class="hint">' + T.html(c.h) + '</div>'
        : '<button class="hint-btn" data-hint>Hint</button>') : '');

    if (!sess.revealed) {
      // the prompt itself is the tap; no "Tap to reveal" caption (skill §8)
      if (sess.typing) body += '<div class="typewrap"><input class="typein" id="typein" autocomplete="off" autocorrect="off" ' +
          'autocapitalize="none" spellcheck="false" placeholder="' +
          (typeable(c) ? 'Type your answer' : 'Type what you can') + '"></div>';
    } else {
      body += '<div class="rule reveal"></div>' +
        '<div class="a reveal' + sizeClass(c.a) + '">' + T.html(c.a) + '</div>' +
        (sess.verdict ? '<div class="verdict reveal ' +
          (sess.verdict.ok === 'miss' && !typeable(c) ? 'long' : sess.verdict.ok) + '">' +
          esc(sess.verdict.ok === 'miss' && !typeable(c) ? 'too long to type — grade yourself'
              : sess.verdict.text) + '</div>' : '') +
        (c.n ? '<div class="note reveal' + (stacked(c.n) ? ' mathy' : '') + '">' + T.html(c.n) + '</div>' : '') +
        noteHTML(c) +
        (topicLabel(c) ? '<div class="meta reveal">' + esc(topicLabel(c)) + '</div>' : '');
    }

    // grades in the flow, as text; the recommended grade is the heavier ink —
    // and after a scored miss the recommendation is Again, not Good
    var footer = sess.revealed
      ? '<div class="rate' + (sess.verdict && sess.verdict.ok === 'miss' && typeable(c) ? ' miss' : '') + '">' +
          // Four grades, the standard set. There was no honest button for
          // "I got it, but only just": Again buries a card you did know and
          // Good sends one you half-knew a fortnight away.
          '<button class="r-again" data-grade="0"><span class="lab">Again</span><span class="when">' + S.preview(c.i, 0) + '</span></button>' +
          '<button class="r-hard" data-grade="1"><span class="lab">Hard</span><span class="when">' + esc(passWord(c, 1)) + '</span></button>' +
          '<button class="r-good" data-grade="2"><span class="lab">Good</span><span class="when">' + esc(passWord(c, 2)) + '</span></button>' +
          '<button class="r-easy" data-grade="3"><span class="lab">Easy</span><span class="when">' + esc(passWord(c, 3)) + '</span></button>' +
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
        '<div class="cardwrap"><div class="card' + (sess.revealed ? '' : ' enter') + '" id="card" role="group">' + body + '</div></div>' +
      '</div><div class="morecue" aria-hidden="true">\u2304</div>' + footer + sessUtil(starred) + '</div>',
      { session: true }
    );
    wireCard();
  }

  function renderQuizCard(c, d, unit) {
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
        return '<button class="choice' + cls + '" data-pick="' + n + '"' + (state ? ' data-state="' + state + '"' : '') +
          (sess.answered ? ' disabled' : '') + '>' + T.html(ch.text) + why + '</button>';
      }).join('') + '</div>';

    var footer = sess.answered
      ? '<div class="rate"><button class="r-good" data-next><span class="lab">Next</span></button></div>'
      : '';

    mount(
      '<div class="session">' + sessTop(c) +
      '<div class="cardstage"><div class="cardwrap"><div class="card' + (sess.answered ? '' : ' enter') + '" id="card">' + body + '</div></div></div>' +
      '<div class="morecue" aria-hidden="true">\u2304</div>' +
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
      if (got === want) return { ok: 'hit', text: 'exact' };
      // a prefix only counts when it covers most of the answer — two words
      // of a long sentence is not knowing it. Prefixes are judged HERE only,
      // never re-admitted by the looser substring rule below.
      if (want.indexOf(got) === 0) {
        if (got.length >= Math.min(want.length, Math.max(6, Math.ceil(want.length * 0.6)))) {
          return { ok: 'hit', text: 'close enough' };
        }
        continue;
      }
      if (got.indexOf(want) > -1 || want.indexOf(got) > 0) {
        var ratio = Math.min(got.length, want.length) / Math.max(got.length, want.length);
        if (ratio > 0.55) return { ok: 'hit', text: 'close enough' };
      }
    }
    return { ok: 'miss', text: 'you wrote "' + typed.trim().slice(0, 60) + '"' };
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
      sess.verdict = checkTyped(c, typed) || { ok: 'miss', text: 'nothing typed' };
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
    var wrote = !sess.cram || !correct || S.isNew(c.i) || S.isDue(c.i);
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
    sess.done++; sess.answered = false; sess.picked = -1; sess.choices = null; sess.hinted = false;
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
      return '<div class="ledger"><span class="lname">' + l[0] +
        '</span><span class="lval num">' + l[1] + '</span></div>';
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
      '#/' + (sess.quiz ? 'quiz' : 'study') + '/' + d.id + '/' + sess.mode + (sess.unitId ? '/' + sess.unitId : '');
    // one line under the number, and it earns its place: caught up beats a
    // milestone streak beats the day's count — never the same rote line
    var stk = S.streak();
    var moment = !dueLeft ? 'All caught up' :
      [3, 7, 14, 21, 30, 50, 75, 100, 150, 200].indexOf(stk) > -1 ? stk.toLocaleString() + '-day streak' :
      // the day log counts grades given, not distinct cards: twenty cards
      // missed and redone read "80 cards today", which is not what happened
      plural(S.studiedToday(), 'review') + ' today';
    sess = null;
    // the session is over — a reload or a back gesture should land on the
    // deck, not silently deal a brand-new session (no hashchange fires here)
    try { history.replaceState(null, '', location.href.replace(/#.*$/, '') + (d ? '#/d/' + d.id : '#/')); } catch (e) {}
    mount(
      '<div class="done-hero">' +
        '<span class="k">Session complete</span>' +
        '<div class="v">' + total + '</div>' +
        '<div class="sub" style="margin-top:8px;color:var(--ink-soft);font-size:14.5px">' +
          esc(moment) + '</div>' +
      '</div>' +
      '<div class="done-rows">' + rows + '</div>' +
      (dueLeft ? '<button class="act" data-go="' + again + '">Keep going</button>' : '')
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
  function scopeWord() { return searchState.deck ? nice(searchState.deck) : 'All decks'; }
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
      '<div class="searchbar"><input id="q" type="search" placeholder="a term, a formula, a year" ' +
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
      (T.plain(card.q) + ' ' + T.plain(card.a) + ' ' + (card.n || '') + ' ' + (card.t || '')).toLowerCase()));
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
    if (!q) { out.innerHTML = ''; return; }
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
    out.innerHTML = '<div class="scoperow"><span class="k">' + plural(total, 'card') + '</span>' +
      '<button class="textbtn quiet end" data-print>Print</button></div>' +
      '<ul class="list tight still">' + hits.slice(0, 120).map(function (c) {
        var d = S.getDeck(c.deck), u = d.unitById[c.u];
        return '<li><button class="qrow" data-peek="' + c.i + '">' +
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
      return '<li><button class="ledger mid" data-go="#/d/' + c.id + '">' +
        '<span class="lname">' + esc(nice(c.id)) + '</span>' +
        '<span class="lval word">' + esc(w) + '</span>' +
        '<span class="lsub">' + esc(examName(c.id) + ' · ' + (examDayNum(c.id) - S.dayNum()) + ' days') + '</span>' +
        '</button></li>';
    }).join('');
    var paceBlock = paceRows
      ? '<div class="k" style="margin:var(--s-5) 0 var(--s-3)">At this pace</div><ul class="list tight">' + paceRows + '</ul>'
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
      var bd = backlogDays(over);
      fcBlock = '<div class="k" style="margin:var(--s-5) 0 var(--s-3)">The backlog</div>' +
        '<ul class="list tight"><li><div class="ledger mid">' +
        '<span class="lname">Overdue</span>' +
        '<span class="lval num">' + over.toLocaleString() + '</span>' +
        // the honest denominator is the REVIEW slots, not the session size: a
        // 30-card session that deals 20 new cards has ten places for old ones
        '<span class="lsub">' + esc(plural(bd, 'day') + ' at ' + reviewSlots() +
          ' reviews a session · ' + sizeNow + ' cards, ' + (S.getSettings().newPerSession || 0) + ' new') +
        '</span></div></li></ul>' + missLine('this count');
    } else if (fcTotal > 0) {
      // the bar reads against a day's session, not against the week's own
      // maximum: a full rule always means the same amount of work
      var ref = Math.max(sizeNow, Math.max.apply(null, fc));
      fcBlock = '<div class="k" style="margin:var(--s-5) 0 var(--s-3)">The week ahead</div>' +
        '<ul class="list tight">' + fc.map(function (n, i) {
          return '<li><div class="ledger mid fc"' +
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
    var weak = weakBuckets(), weakBlock = '';
    if (weak.length) {
      weakBlock = '<div class="k" style="margin:var(--s-5) 0 var(--s-3)">Weak spots</div><ul class="list tight">' +
        weak.slice(0, 3).map(function (w) {
          return '<li><button class="ledger mid" data-go="#/study/' + w.deck.id + '/hard/' + w.unit.id + '">' +
            '<span class="lname">' + esc(w.unit.title) + '</span>' +
            // the column has to be the number the list is RANKED on, or it
            // climbs as you read down: 4, then 9, then 26
            '<span class="lval num">' + pct(w.bad / w.studied) + '</span>' +
            '<span class="lsub">' + esc(nice(w.deck)) + ' · ' + w.bad + ' of ' + w.studied + ' missed</span>' +
            '</button></li>';
        }).join('') + '</ul>' +
        (weak.length > 3 ? '<button class="textbtn quiet" data-go="#/weak">All weak spots</button>' : '');
    }

    // the cards themselves, under the units they sit in: a unit you keep
    // missing is a topic to reread, but one card missed six times is a card
    // to rewrite, and only this list can tell you which you have
    var stuck = stuckCards(), stuckBlock = '';
    if (stuck.length) {
      stuckBlock = '<div class="k" style="margin:var(--s-5) 0 var(--s-3)">Sticking points</div>' +
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
        '</button>';
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
      (totals.due ? '<div style="margin-top:var(--s-5)"><button class="act" data-go="#/review">Review ' + totals.due.toLocaleString() + '</button></div>'
        : !totals.seen ? '<button class="textbtn" data-go="#/">Decks</button>' : '')
    );
  }

  /* every weak spot, when three rows are not the whole story */
  function viewWeak() {
    curDeckId = null;
    var list = weakBuckets();
    if (!list.length) return goReplace('#/stats');
    mount(
      backbar('Progress') +
      '<div class="head"><h1 class="uhead">Weak spots</h1></div>' +
      '<ul class="list tight">' + list.map(function (w) {
        return '<li><button class="ledger mid" data-go="#/study/' + w.deck.id + '/hard/' + w.unit.id + '">' +
          '<span class="lname">' + esc(w.unit.title) + '</span>' +
          '<span class="lval num">' + pct(w.bad / w.studied) + '</span>' +
          '<span class="lsub">' + esc(nice(w.deck)) + ' · ' + w.bad + ' of ' + w.studied + ' missed</span>' +
          '</button></li>';
      }).join('') + '</ul>'
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
      (m.length > 1 ? ' did not load' : ' did not load') + ' — ' + esc(what) + ' leaves ' +
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
    return starFilter && ids[starFilter - 1] ? nice(ids[starFilter - 1]) : 'All decks';
  }

  function viewStuck() {
    curDeckId = null;
    var all = stuckCards();
    if (!all.length) return mount(
      backbar('Progress') +
      '<div class="head"><h1 class="uhead">Sticking points</h1>' +
      '<div class="sub">Nothing has been missed ' + STUCK_MIN + ' times. ' +
      'When a card starts beating you, it lands here.</div></div>');
    var today = S.dayNum();
    var deal = Math.min(all.length, S.getSettings().sessionSize || 30);
    mount(
      backbar('Progress') +
      '<div class="head"><h1 class="uhead">Sticking points</h1>' +
      '<div class="sub">' + esc(plural(all.length, 'card')) + ' missed ' +
      STUCK_MIN + ' times or more</div></div>' +
      '<button class="act" data-go="#/stuck/go">Study ' +
        (deal < all.length ? deal + ' of ' + all.length.toLocaleString() : 'these') + '</button>' +
      // the remedy, said once — and where it lives: the note control is on
      // the card in a session, not on this screen
      '<div class="empty cap">A card at this count usually needs saying in your ' +
      'own words, not another pass. In the session the note control is on the ' +
      'card — write the version that would have worked.</div>' +
      '<ul class="list tight still" style="margin-top:var(--s-4)">' + all.map(function (c) {
        var d = S.getDeck(c.deck), u = d.unitById[c.u], st = S.cs(c.i) || {};
        var when = st.d <= today ? 'due' : 'in ' + (st.d - today) + ' d';
        return '<li><button class="qrow" data-peek="' + c.i + '">' +
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
      backbar('Decks') +
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
      backbar('Decks') +
      '<div class="head"><h1 class="uhead">Starred</h1>' +
      '<div class="sub">' + esc(plural(all.length, 'card')) + '</div></div>' +
      missLine('this screen') +
      '<button class="act" data-go="#/starred/go">Study ' +
        (deal < list.length ? deal + ' of ' + list.length.toLocaleString() : 'these') + '</button>' +
      // the filter word, its count, and the sheet — one quiet line, not three
      '<div class="scoperow unit">' +
        (ids.length > 1
          ? '<button class="textbtn quiet" data-star-filter>' + esc(starWord()) + '</button>' +
            '<span class="scount num">' + list.length.toLocaleString() + '</span>'
          : '') +
        '<button class="textbtn quiet end" data-print>Print</button></div>' +
      '<ul class="list tight still" style="margin-top:var(--s-4)">' + list.map(function (c) {
        var d = S.getDeck(c.deck), u = d.unitById[c.u], st = S.cs(c.i);
        var when = !st || !(st.r || st.t || st.l) ? 'new'
          : st.d <= today ? 'due'
          : 'in ' + (st.d - today) + ' d';
        return '<li><button class="qrow" data-peek="' + c.i + '">' +
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
  function syncWord() {
    var at = S.account.lastSyncAt();
    // a failure that says nothing is worse than one that says so: the row used
    // to read "Never" through an entire review whatever the server answered
    var f = S.account.lastFail ? S.account.lastFail() : '';
    if (f === 'auth') return 'Token refused';
    if (f === 'off') return 'Sync is off here';
    if (f === 'net' && !at) return 'Cannot reach sync';
    if (!at) return 'Never';
    var m = (Date.now() - at) / 60000;
    if (m < 5) return 'Just now';
    if (m < 120) return Math.round(m) + ' min ago';
    if (m < 48 * 60) return Math.round(m / 60) + ' h ago';
    return Math.round(m / 1440) + ' d ago';
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
          '<div class="searchbar" style="margin-top:6px"><input id="acct-tok" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="account token">' +
          '<button class="textbtn quiet" data-tok-paste>Paste</button></div></div>') +
      '<div class="setrow"><div class="sname">Typing</div>' +
        '<button class="cyc" data-typing-cycle>' + (s.typing ? 'On' : 'Off') + '</button></div>' +
      '<div class="setrow"><div class="sname">Session</div>' +
        '<button class="cyc num" data-cycle="sessionSize">' + s.sessionSize + '</button></div>' +
      '<div class="setrow"><div class="sname">New cards</div>' +
        '<button class="cyc num" data-cycle="newPerSession">' + s.newPerSession + '</button></div>' +
      // the two numbers above are a trade, and the trade was invisible
      (S.getIndex().courses.some(function (c) { return S.getDeck(c.id); })
        ? '<div class="setnote">' + esc(paceVerdict()) + '</div>' : '') +

      '</div>' +

      '<div class="data-list">' +
        '<button class="textbtn" data-export>Backup</button>' +
        '<button class="textbtn" data-import>Restore</button>' +
        '<button class="textbtn" data-reset>Reset progress</button>' +
      '</div>' +
      reqHTML('Request a feature') +
      // the keys, said once, where a keyboard exists — CSS hides this line on
      // coarse-pointer screens, where it would only be clutter
      '<div class="keyline">Keyboard — space reveal · 1 2 3 4 grade · s star · n note · ' +
        '1–4 answer · enter next · / search · ← → tabs · esc back</div>' +
      '<div class="foot">' + S.getIndex().total.toLocaleString() + ' cards</div>'
    );
  }

  /* the request line: write it here, it lands as a GitHub issue under the
     owner's own login — the site itself holds no token at all */
  function reqHTML(label) {
    return '<div class="reqwrap"><button class="textbtn" data-req>' + esc(label) + '</button>' +
      '<div class="reqbox" hidden><textarea rows="3" placeholder="a feature, a game, a fix"></textarea>' +
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
    if (word && word.textContent.trim() !== 'All cards' && word.textContent.trim() !== 'All decks')
      bits.push(word.textContent.trim().toLowerCase() + (cnt ? ' · ' + cnt.textContent.trim() + ' cards' : ''));
    bits.push(new Date().toISOString().slice(0, 10));
    stamp.textContent = bits.join(' · ');
    var host = app.querySelector('.pane-r .inner') || app.querySelector('.screen') || app;
    host.insertBefore(stamp, host.firstChild);
    var ok = true;
    try { window.print(); } catch (e) { ok = false; }
    // an installed home-screen app has no print dialog to fall back on
    var standalone = window.navigator.standalone === true ||
      (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    setTimeout(function () { if (stamp.parentNode) stamp.parentNode.removeChild(stamp); }, 1200);
    if (!ok || standalone) toast('Open apdecks in Safari or Chrome to print');
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
    btn._disarm = setTimeout(function () { disarm(btn); }, 3000);
    return false;
  }
  function disarm(btn) {
    if (!btn || !btn.getAttribute('data-armed')) return;
    clearTimeout(btn._disarm);
    btn.removeAttribute('data-armed');
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
      if (sess && !sess.revealed) { sess.hinted = true; renderCard(); }
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
    if (t.closest('[data-next]')) { nextQuiz(); return; }

    if (t.closest('[data-unit-filter]')) {
      unitFilter = (unitFilter + 1) % UNIT_FILTERS.length;
      route();
      return;
    }
    if (t.closest('[data-unit-all]')) { unitFilter = 0; route(); return; }
    if (t.closest('[data-print]')) { printSheet(); return; }
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
    var peek = t.closest('[data-peek]');
    if (peek) {
      var a = peek.querySelector('.qa');
      a.hidden = !a.hidden;
      var qn = peek.querySelector('.qn');
      if (qn) qn.hidden = a.hidden;
      peek.classList.toggle('open', !a.hidden);
      if (peek.parentNode) peek.parentNode.classList.toggle('open', !a.hidden);
      return;
    }
    if (t.closest('[data-typing-cycle]')) {
      S.setSetting('typing', !S.getSettings().typing);
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
      toast('Finish on GitHub — it posts from your account');
      return;
    }
    var cyc = t.closest('[data-cycle]');
    if (cyc) {
      var ckey = cyc.getAttribute('data-cycle');
      var opts = ckey === 'sessionSize' ? [15, 20, 30, 50, 100] : [5, 10, 20, 40];
      var at = opts.indexOf(S.getSettings()[ckey]);
      S.setSetting(ckey, opts[(at + 1) % opts.length]);
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
        // grading the last card ends the session and nulls sess — return, never fall through
        if (e.key === '1') return doGrade(0);
        if (e.key === '2') return doGrade(1);
        if (e.key === '3') return doGrade(2);
        if (e.key === '4') return doGrade(3);
      }
      if (sess.quiz && !sess.answered && /^[1-4]$/.test(e.key)) return pickChoice(parseInt(e.key, 10) - 1);
      if (e.key === 's') { starCurrent(); return; }
      if (e.key === 'n') { openNote(); return; }
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

  function route() {
    var h = location.hash.replace(/^#/, '') || '/';
    var p = h.split('/').filter(Boolean);
    var root = '/' + (p[0] || '');
    syncTabs(['review', 'search', 'stats', 'settings'].indexOf(p[0]) > -1 ? root
      : (p[0] === 'weak' || p[0] === 'stuck') ? '/stats' : '/');   // starred hangs off the deck list
    sess = (p[0] === 'study' || p[0] === 'quiz' || p[0] === 'review' || p[0] === 'cram' ||
            p[0] === 'ten' || ((p[0] === 'starred' || p[0] === 'stuck') && p[1] === 'go')) ? sess : null;
    // leaving the unit page drops its filter, so coming back is always the
    // whole unit — the word lives in memory, and that memory ends with the
    // screen. This sits above every early return, or "#/" would slip past it.
    if (!(p[0] === 'd' && p[2] === 'u' && p[1] + '/' + p[3] === unitFilterFor)) unitFilterFor = '';
    // the same rule for the search scope: leaving the screen widens it again,
    // or you come back an hour later to "No matches in English"
    if (p[0] !== 'search') searchState.deck = null;
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
    var wantsDeck = (p[0] === 'd' || p[0] === 'study' || p[0] === 'quiz' || p[0] === 'cram') && p[1];
    if (wantsDeck && !S.getDeck(p[1]) && S.deckPending && S.deckPending(p[1]) &&
        (S.getIndex().courses || []).some(function (c) { return c.id === p[1]; })) {
      return mount('<div class="head"><span class="k">' + esc(nice(p[1])) + '</span><h1>Loading</h1></div>');
    }
    if (p[0] === 'd' && p[1] && p[2] === 'b' && p[3]) return viewPhase(p[1], p[3]);
    if (p[0] === 'd' && p[1] && p[2] === 'l' && p[3]) return viewLesson(p[1], p[3]);
    if (p[0] === 'd' && p[1] && p[2] === 'r' && p[3]) return viewResource(p[1], p[3]);
    if (p[0] === 'd' && p[1] && p[2] === 'u' && p[3]) return viewUnit(p[1], p[3]);
    if (p[0] === 'd' && p[1]) return viewCourse(p[1]);
    if (p[0] === 'study') return startSession(p[1], p[2] || 'smart', p[3], false);
    if (p[0] === 'quiz') return startSession(p[1], p[2] || 'smart', p[3], true);
    if (p[0] === 'review') return startReview();
    if (p[0] === 'ten') return startReview(10);
    if (p[0] === 'cram') return startCram(p[1], p[2]);
    if (p[0] === 'weak') return viewWeak();
    if (p[0] === 'stuck') return p[1] === 'go' ? startStuck() : viewStuck();
    if (p[0] === 'starred') return p[1] === 'go' ? startStarred() : viewStarred();
    if (p[0] === 'search') return viewSearch();
    if (p[0] === 'stats') return viewStats();
    if (p[0] === 'settings') return viewSettings();
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
    var al = e.target.closest('[data-book-all]');
    if (al) { ladder.all = !ladder.all; applyLevel(); return; }
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
  document.addEventListener('lg-change', function (e) {
    if (!e.target || e.target.id !== 'lvlseg') return;
    ladder.lvl = e.detail; ladder.all = false; applyLevel();
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

  app.innerHTML = '<div class="head"><span class="k">AP Decks</span><h1>Loading</h1></div>';

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
    }
    return S.loadAll();
  }).then(function () {
    if (!sess) route();                    // counts and due numbers settle
    warmSearch();
  }).catch(function (err) {
    app.innerHTML = '<div class="head"><span class="k">AP Decks</span><h1>Could not load the decks</h1>' +
      '<div class="sub">' + esc(err.message) + '</div></div>' +
      '<button class="act" onclick="location.reload()">Try again</button>';
  });
})();
