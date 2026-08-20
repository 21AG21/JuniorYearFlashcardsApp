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
  function mount(html, opts) {
    if (isWide()) {
      // Two full-height panes: the deck list lives on the left, every view on
      // the right — the same content as the phone, never extra chrome.
      app.innerHTML = '<div class="pane-l">' + decksListHTML() + '</div>' +
        '<div class="pane-r"><div class="inner">' + html + '</div></div>';
    } else {
      app.innerHTML = html;
    }
    app.classList.toggle('is-wide', isWide());
    app.classList.toggle('is-session', !!(opts && opts.session));
    app.classList.toggle('is-quiz', !!(opts && opts.quiz));
    tabs.hidden = isWide() || !!(opts && opts.session);
    if (window.LG) window.LG.init(app);
    wireGlassControls();
    if (!(opts && opts.keepScroll)) {
      var pr = app.querySelector('.pane-r');
      if (pr) pr.scrollTop = 0; else window.scrollTo(0, 0);
    }
  }
  function wireGlassControls() {
    app.querySelectorAll('.lg-toggle[data-set]').forEach(function (el) {
      if (el._wired) return; el._wired = true;
      el.addEventListener('lg-change', function (e) {
        var on = !!e.detail;
        S.setSetting(el.getAttribute('data-set'), on);
        el.setAttribute('aria-checked', String(on));
        if (el.getAttribute('data-set') === 'glass') applyTheme();
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          var on = !el.classList.contains('is-on');
          el.classList.toggle('is-on', on);
          if (el.lgSet) el.lgSet(on ? 1 : 0);
          S.setSetting(el.getAttribute('data-set'), on);
          el.setAttribute('aria-checked', String(on));
          if (el.getAttribute('data-set') === 'glass') applyTheme();
        }
      });
    });
    var seg = app.querySelector('#themeseg');
    if (seg && !seg._wired) {
      seg._wired = true;
      seg.addEventListener('lg-change', function (e) {
        var items = seg.querySelectorAll('[data-theme]');
        var pick = items[e.detail];
        if (!pick) return;
        S.setSetting('theme', pick.getAttribute('data-theme'));
        applyTheme();
      });
    }
  }

  /* ---------------- two-pane wide layout (skill §5.6) -------------------- */
  var WIDE_MQ = matchMedia('(min-width:900px) and (min-height:500px)');
  function isWide() { return WIDE_MQ.matches; }
  var curDeckId = null;          // which deck the right pane is about (marks the left row)
  var lastDeckId = null;         // remembered so "/" can open somewhere sensible on wide

  function decksListHTML() {
    var ix = S.getIndex(), due = 0;
    var rows = ix.courses.map(function (c) {
      var d = S.getDeck(c.id);
      var st = d ? S.deckStats(d) : { due: 0 };
      due += st.due;
      return '<li><button class="ledger' + (c.id === curDeckId ? ' on' : '') + '" data-go="#/d/' + c.id + '">' +
        '<span class="lname">' + esc(nice(c.id)) + '</span>' +
        '<span class="lval num">' + c.count + '</span>' +
        (st.due ? '<span class="lsub">' + st.due + ' due</span>' : '') +
        '</button></li>';
    }).join('');
    var hero = due ? plural(due, 'card') + ' due' : ix.total.toLocaleString() + ' cards';
    return '<div class="head">' +
        (due ? '<button class="hero-tap" data-go="#/review"><h1>' + esc(hero) + '</h1></button>'
             : '<h1>' + esc(hero) + '</h1>') + '</div>' +
      '<ul class="list tight">' + rows + '</ul>' +
      '<div class="lnav">' +
        '<button class="textbtn" data-go="#/search">Search</button>' +
        '<button class="textbtn" data-go="#/stats">Progress</button>' +
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
  function go(hash) {
    var next = hash.charAt(0) === '#' ? hash : '#' + hash;
    if (location.hash === next) route(); else location.hash = next;
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  // Shorten the label before the type (skill §3): the course identity, one line.
  var NICE = { lang: 'English', chem: 'Chemistry', french: 'French', calcbc: 'Calc BC', apush: 'US History' };
  function nice(idOrDeck) { var id = typeof idOrDeck === 'string' ? idOrDeck : idOrDeck.id; return NICE[id] || (typeof idOrDeck === 'string' ? id : idOrDeck.short); }
  function pct(x) { return Math.round(x * 100) + '%'; }

  function backbar(title, rightHtml) {
    return '<div class="backbar">' +
      '<button class="iconbtn" data-back aria-label="Back"><svg><use href="#i-back"/></svg></button>' +
      '<span class="k">' + esc(title) + '</span>' +
      (rightHtml || '') + '</div>';
  }

  /* ---------------- theme ------------------------------------------------ */
  function applyTheme() {
    var t = S.getSettings().theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    var dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.remove(); });
    var m = document.createElement('meta');
    m.name = 'theme-color'; m.content = dark ? '#000000' : '#f2f2f4';
    document.head.appendChild(m);
    document.documentElement.classList.toggle('no-glass', S.getSettings().glass === false);
  }

  /* ==========================================================================
     VIEW · Decks
     ========================================================================== */
  function viewDecks() {
    var ix = S.getIndex();
    var due = 0;
    var rows = ix.courses.map(function (c) {
      var d = S.getDeck(c.id);
      var st = d ? S.deckStats(d) : { due: 0, known: 0, total: c.count, pct: 0, fresh: c.count };
      due += st.due;
      // one meaning per column: every row shows its total; a due count is a
      // second line on the rows where it is true (skill §4.1)
      return '<li><button class="ledger" data-go="#/d/' + c.id + '">' +
        '<span class="lname">' + esc(nice(c.id)) + '</span>' +
        '<span class="lval num">' + c.count + '</span>' +
        (st.due ? '<span class="lsub">' + st.due + ' due</span>' : '') +
        '</button></li>';
    }).join('');

    // The hero is the fact, and when there is one obvious action it IS the tap.
    var hero = due ? plural(due, 'card') + ' due' : ix.total.toLocaleString() + ' cards';
    mount(
      '<div class="head">' +
        (due ? '<button class="hero-tap" data-go="#/review"><h1>' + esc(hero) + '</h1></button>'
             : '<h1>' + esc(hero) + '</h1>') +
      '</div>' +
      '<ul class="list tight">' + rows + '</ul>' +
      '<div style="margin-top:var(--s-5)"><button class="textbtn" data-go="#/settings">Settings</button></div>'
    );
  }

  /* ==========================================================================
     VIEW · one course
     ========================================================================== */
  function viewCourse(deckId) {
    var d = S.getDeck(deckId);
    if (!d) return go('#/');
    curDeckId = lastDeckId = deckId;
    var st = S.deckStats(d);
    // units in course order, each under a small muted label — never a header (skill §4.2)
    var units = d.units.map(function (u) {
      var us = S.unitStats(d, u.id);
      if (!us.total) return '';
      return '<li>' +
        '<div class="ulabel">Unit ' + u.n + '</div>' +
        '<button class="ledger mid' + (us.pct >= 0.9 ? ' done' : '') + '" data-go="#/d/' + deckId + '/u/' + u.id + '">' +
        '<span class="lname">' + esc(u.title) + '</span>' +
        '<span class="lval num">' + us.total + '</span>' +
        (us.due ? '<span class="lsub">' + us.due + ' due</span>' : '') +
        '</button></li>';
    }).join('');

    mount(
      backbar('') +
      '<div class="dhero"><span class="dn">' + esc(nice(d)) + '</span><span class="dv">' + st.total + '</span></div>' +
      '<button class="act" data-go="#/study/' + deckId + '/smart">' + (st.due ? 'Review ' + st.due : 'Study') + '</button>' +
      '<div class="modes">' +
        '<button class="textbtn" data-go="#/study/' + deckId + '/core">High-yield</button>' +
        '<button class="textbtn" data-go="#/quiz/' + deckId + '/smart">Multiple choice</button>' +
        (st.starred ? '<button class="textbtn" data-go="#/study/' + deckId + '/starred">Starred</button>' : '') +
        '<button class="textbtn" data-go="#/study/' + deckId + '/hard">Trouble spots</button>' +
        '<button class="textbtn" data-go="#/study/' + deckId + '/all">Shuffle all</button>' +
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
    var cards = d.cards.filter(function (c) { return c.u === unitId; });

    var list = cards.map(function (c, n) {
      var known = S.isKnown(c.i);
      return '<li><button class="qrow' + (known ? ' done' : '') + '" data-peek="' + c.i + '">' +
        '<span class="qq' + (known ? ' dim' : '') + '">' + T.html(c.q) + '</span>' +
        '<span class="qa" hidden>' + T.html(c.a) + '</span>' +
        '<span class="qmeta">' + esc(c.v) + (topicLabel(c) ? ' · ' + esc(topicLabel(c)) : '') +
          (known ? ' · known' : (S.isNew(c.i) ? '' : ' · learning')) + '</span>' +
        '</button></li>';
    }).join('');

    mount(
      backbar(nice(d) + ' · Unit ' + u.n) +
      '<div class="dhero"><span class="dn">' + esc(u.title) + '</span><span class="dv">' + us.total + '</span></div>' +
      '<button class="act" data-go="#/study/' + deckId + '/smart/' + unitId + '">' + (us.due ? 'Review ' + us.due : 'Study') + '</button>' +
      '<div class="modes">' +
        '<button class="textbtn" data-go="#/study/' + deckId + '/core/' + unitId + '">High-yield</button>' +
        '<button class="textbtn" data-go="#/quiz/' + deckId + '/smart/' + unitId + '">Multiple choice</button>' +
        '<button class="textbtn" data-go="#/study/' + deckId + '/all/' + unitId + '">Shuffle all</button>' +
      '</div>' +
      '<ul class="list tight" style="margin-top:var(--s-4)">' + list + '</ul>'
    );
  }

  /* ==========================================================================
     SESSION · shared engine for flashcards and multiple choice
     ========================================================================== */
  var sess = null;

  function startSession(deckId, mode, unitId, quiz) {
    var d = S.getDeck(deckId);
    if (!d) return go('#/');
    var queue = S.buildSession(d, unitId || null, mode || 'smart');
    if (!queue.length) return renderEmptySession(d, unitId, mode);
    sess = {
      deck: d, unitId: unitId || null, mode: mode, quiz: !!quiz,
      queue: queue, done: 0, planned: queue.length,
      revealed: false, again: 0, good: 0, easy: 0, right: 0, wrong: 0,
      history: [], answered: false, typed: ''
    };
    renderCard();
  }

  /* review across every deck */
  function startReview() {
    var ix = S.getIndex(), all = [];
    ix.courses.forEach(function (c) {
      var d = S.getDeck(c.id);
      if (!d) return;
      d.cards.forEach(function (card) { if (S.isDue(card.i)) all.push(card); });
    });
    if (!all.length) {
      return mount(
        '<div class="head"><h1>Nothing due</h1>' +
        '<div class="sub">Next: whatever comes due tomorrow</div></div>' +
        '<button class="textbtn" data-go="#/">Decks</button>'
      );
    }
    S.shuffle(all);
    var limit = S.getSettings().sessionSize;
    sess = {
      deck: null, unitId: null, mode: 'due', quiz: false, mixed: true,
      queue: all.slice(0, Math.max(limit, 10)), done: 0, planned: Math.min(all.length, Math.max(limit, 10)),
      revealed: false, again: 0, good: 0, easy: 0, right: 0, wrong: 0, history: [], answered: false, typed: ''
    };
    renderCard();
  }

  function renderEmptySession(d, unitId, mode) {
    var label = mode === 'starred' ? 'No starred cards yet.' :
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

  function sessTop(c) {
    // One small label line: scope on the left, position on the right (skill §4.3).
    var d = c ? cardDeckOf(c) : sess.deck;
    var unit = c && d ? d.unitById[c.u] : null;
    var scope = d ? nice(d) + (unit ? ' · ' + unit.title : '') : 'Review';
    return '<div class="sess-top">' +
      '<span class="scope">' + esc(scope) + '</span>' +
      '<span class="pos num">' + Math.min(sess.done + 1, sess.planned) + ' of ' + sess.planned + '</span>' +
      '</div>';
  }
  // Done / Undo / Star as quiet text — the affordances survive, the chrome does not.
  function sessUtil(starred) {
    return '<div class="sess-util">' +
      '<button class="textbtn quiet" data-exit>Done</button>' +
      (sess.history.length ? '<button class="textbtn quiet" data-undo>Undo</button>' : '') +
      (starred != null ? '<button class="textbtn quiet" data-star aria-pressed="' + starred + '">' + (starred ? 'Starred' : 'Star') + '</button>' : '') +
      '</div>';
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
    if (!sess || !sess.queue.length) return renderDone();
    var c = sess.queue[0];
    curDeckId = sess.deck ? sess.deck.id : null;
    var d = cardDeckOf(c);
    var unit = d.unitById[c.u];
    var starred = S.isStarred(c.i);
    var settings = S.getSettings();

    if (sess.quiz) return renderQuizCard(c, d, unit);

    var body =
      '<div class="q' + sizeClass(c.q) + '">' + T.html(c.q) + '</div>' +
      (!sess.revealed && c.h ? '<div class="hint">' + T.html(c.h) + '</div>' : '');

    if (!sess.revealed) {
      // the prompt itself is the tap; no "Tap to reveal" caption (skill §8)
      if (settings.typing) body += '<div class="typewrap"><input class="typein" id="typein" autocomplete="off" autocorrect="off" ' +
          'autocapitalize="none" spellcheck="false" placeholder="Type your answer"></div>';
    } else {
      body += '<div class="rule reveal"></div>' +
        '<div class="a reveal' + sizeClass(c.a) + '">' + T.html(c.a) + '</div>' +
        (sess.verdict ? '<div class="verdict reveal ' + sess.verdict.ok + '">' + esc(sess.verdict.text) + '</div>' : '') +
        (c.n ? '<div class="note reveal' + (stacked(c.n) ? ' mathy' : '') + '">' + T.html(c.n) + '</div>' : '') +
        (topicLabel(c) ? '<div class="meta reveal">' + esc(topicLabel(c)) + '</div>' : '');
    }

    // grades in the flow, as text; the recommended grade is the heavier ink
    var footer = sess.revealed
      ? '<div class="rate">' +
          '<button class="r-again" data-grade="0"><span class="lab">Again</span><span class="when">' + S.preview(c.i, 0) + '</span></button>' +
          '<button class="r-good" data-grade="1"><span class="lab">Good</span><span class="when">' + S.preview(c.i, 1) + '</span></button>' +
          '<button class="r-easy" data-grade="2"><span class="lab">Easy</span><span class="when">' + S.preview(c.i, 2) + '</span></button>' +
        '</div>'
      : '<div class="rate"><button class="r-good" data-reveal><span class="lab">Show answer</span><span class="when kbd">space</span></button></div>';

    mount(
      '<div class="session">' + sessTop(c) +
      '<div class="cardstage">' +
        '<span class="swipehint l">Again</span><span class="swipehint r">Good</span>' +
        '<div class="cardwrap"><div class="card enter" id="card" role="group">' + body + '</div></div>' +
      '</div>' + footer + sessUtil(starred) + '</div>',
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
        return '<button class="choice' + (stacked(ch.text) ? ' mathy' : '') + '" data-pick="' + n + '"' + (state ? ' data-state="' + state + '"' : '') +
          (sess.answered ? ' disabled' : '') + '>' + T.html(ch.text) + '</button>';
      }).join('') + '</div>' +
      (sess.answered && c.n ? '<div class="note reveal">' + T.html(c.n) + '</div>' : '');

    var footer = sess.answered
      ? '<div class="rate"><button class="r-good" data-next><span class="lab">Next</span></button></div>'
      : '';

    mount(
      '<div class="session">' + sessTop(c) +
      '<div class="cardstage"><div class="cardwrap"><div class="card enter" id="card">' + body + '</div></div></div>' +
      footer + sessUtil(starred) + '</div>', { session: true, quiz: true });
    wireCard();
  }

  function makeChoices(c, d) {
    var sameUnit = d.cards.filter(function (x) { return x.u === c.u && x.i !== c.i && x.v === c.v; });
    if (sameUnit.length < 3) sameUnit = d.cards.filter(function (x) { return x.u === c.u && x.i !== c.i; });
    if (sameUnit.length < 3) sameUnit = d.cards.filter(function (x) { return x.i !== c.i; });
    var picks = S.shuffle(sameUnit.slice()).slice(0, 3);
    var out = picks.map(function (x) { return { text: trim(x.a), correct: false }; });
    out.push({ text: trim(c.a), correct: true });
    return S.shuffle(out);
  }
  function trim(a) {
    var t = String(a);
    return t.length > 170 ? t.slice(0, 167).replace(/\s+\S*$/, '') + '…' : t;
  }

  /* ---- interaction ------------------------------------------------------ */
  function wireCard() {
    var card = document.getElementById('card');
    if (!card) return;
    var wrap = card.parentNode;

    if (!sess.quiz && !sess.revealed) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('[data-star]') || e.target.closest('input')) return;
        reveal();
      });
    }
    var input = document.getElementById('typein');
    if (input) {
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); sess.typed = input.value; reveal(); }
      });
    }
    if (sess.revealed && !sess.quiz) attachSwipe(wrap);
  }

  function normalize(s) {
    return T.plain(s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function checkTyped(c, typed) {
    if (!typed || !typed.trim()) return null;
    var got = normalize(typed);
    var targets = [c.a].concat(c.x || []);
    for (var i = 0; i < targets.length; i++) {
      var want = normalize(targets[i]);
      if (!want) continue;
      if (got === want) return { ok: 'hit', text: 'exact' };
      if (want.indexOf(got) === 0 && got.length >= Math.min(6, want.length)) return { ok: 'hit', text: 'close enough' };
      if (got.indexOf(want) > -1 || want.indexOf(got) > -1) {
        var ratio = Math.min(got.length, want.length) / Math.max(got.length, want.length);
        if (ratio > 0.55) return { ok: 'hit', text: 'close enough' };
      }
    }
    return { ok: 'miss', text: 'you wrote "' + typed.trim().slice(0, 60) + '"' };
  }

  function reveal() {
    if (!sess || sess.revealed) return;
    var c = sess.queue[0];
    if (S.getSettings().typing) {
      var input = document.getElementById('typein');
      var typed = input ? input.value : sess.typed;
      sess.verdict = checkTyped(c, typed);
      if (input) try { input.blur(); } catch (e) {}
    }
    sess.revealed = true;
    renderCard();
  }

  function doGrade(g) {
    if (!sess || !sess.revealed) return;
    var c = sess.queue.shift();
    var before = S.cs(c.i) ? JSON.parse(JSON.stringify(S.cs(c.i))) : null;
    S.grade(c.i, g);
    sess.history.push({ card: c, before: before, index: 0 });
    if (g === 0) { sess.again++; sess.queue.splice(Math.min(4, sess.queue.length), 0, c); }
    else if (g === 1) sess.good++;
    else sess.easy++;
    sess.done++;
    sess.revealed = false; sess.verdict = null; sess.typed = '';
    renderCard();
  }

  function undo() {
    if (!sess || !sess.history.length) return;
    var h = sess.history.pop();
    // pull the card back out of the queue if "Again" re-queued it
    for (var i = 0; i < sess.queue.length; i++) {
      if (sess.queue[i].i === h.card.i) { sess.queue.splice(i, 1); break; }
    }
    S.restore(h.card.i, h.before);
    sess.queue.unshift(h.card);
    sess.done = Math.max(0, sess.done - 1);
    sess.revealed = true; sess.verdict = null;
    S.save(true);
    renderCard();
  }

  function pickChoice(n) {
    if (!sess || sess.answered) return;
    sess.picked = n; sess.answered = true;
    var c = sess.queue[0];
    var correct = sess.choices[n] && sess.choices[n].correct;
    if (correct) sess.right++; else sess.wrong++;
    S.grade(c.i, correct ? 1 : 0);
    renderCard();
  }
  function nextQuiz() {
    var c = sess.queue.shift();
    if (!sess.choices[sess.picked] || !sess.choices[sess.picked].correct) {
      sess.queue.splice(Math.min(4, sess.queue.length), 0, c);
    }
    sess.done++; sess.answered = false; sess.picked = -1; sess.choices = null;
    renderCard();
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
      if (Math.abs(dx) > 92 && Math.abs(dx) > Math.abs(dy)) doGrade(dx < 0 ? 0 : 1);
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
    if (btn) { btn.setAttribute('aria-pressed', String(on)); btn.textContent = on ? 'Starred' : 'Star'; }
  }

  /* ---- session complete -------------------------------------------------- */
  function renderDone() {
    var d = sess.deck;
    var total = sess.done;
    var lines = sess.quiz
      ? [['Correct', sess.right], ['Missed', sess.wrong]]
      : [['Again', sess.again], ['Good', sess.good], ['Easy', sess.easy]];
    var rows = lines.map(function (l) {
      return '<button class="ledger" style="pointer-events:none"><span class="lname">' + l[0] +
        '</span><span class="lval num">' + l[1] + '</span></button>';
    }).join('');
    var st = d ? S.deckStats(d) : null;
    var again = sess.mixed ? '#/review' :
      '#/' + (sess.quiz ? 'quiz' : 'study') + '/' + d.id + '/' + sess.mode + (sess.unitId ? '/' + sess.unitId : '');
    sess = null;
    mount(
      '<div class="done-hero">' +
        '<span class="k">Session complete</span>' +
        '<div class="v">' + total + '</div>' +
        '<div class="sub" style="margin-top:8px;color:var(--ink-soft);font-size:14.5px">' +
          plural(total, 'card') + ' reviewed · ' + plural(S.streak(), 'day') + ' streak</div>' +
      '</div>' +
      '<div style="margin:var(--s-4) 0 var(--s-5)">' + rows + '</div>' +
      (st && st.due ? '<button class="act" data-go="' + again + '" style="margin-bottom:16px">Keep going</button>' : '') +
      '<div><button class="textbtn" data-go="' + (d ? '#/d/' + d.id : '#/') + '">Done</button></div>'
    );
  }

  /* ==========================================================================
     VIEW · search
     ========================================================================== */
  var searchState = { q: '' };
  function viewSearch() {
    curDeckId = null;
    // the field and the results — no hero, no scope chips, no instructions (skill §4.4)
    mount(
      '<div class="searchbar"><input id="q" type="search" placeholder="a term, a formula, a year" ' +
        'autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(searchState.q) + '"></div>' +
      '<div id="results"></div>'
    );
    var input = document.getElementById('q');
    var timer = null;
    input.addEventListener('input', function () {
      searchState.q = input.value;
      clearTimeout(timer); timer = setTimeout(runSearch, 130);
    });
    if (!searchState.q) { try { input.focus(); } catch (e) {} }
    runSearch();
  }

  function runSearch() {
    var out = document.getElementById('results');
    if (!out) return;
    var q = searchState.q.trim().toLowerCase();
    if (q.length < 2) { out.innerHTML = ''; return; }   // show results or show nothing
    var terms = q.split(/\s+/);
    var hits = [];
    S.getIndex().courses.forEach(function (c) {
      var d = S.getDeck(c.id); if (!d) return;
      d.cards.forEach(function (card) {
        if (hits.length > 400) return;
        var hay = (card._hay || (card._hay = (T.plain(card.q) + ' ' + T.plain(card.a) + ' ' + (card.n || '') + ' ' + (card.t || '')).toLowerCase()));
        for (var i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return;
        hits.push(card);
      });
    });
    if (!hits.length) { out.innerHTML = '<div class="empty">No card matches.</div>'; return; }
    hits.sort(function (a, b) {
      var aq = T.plain(a.q).toLowerCase().indexOf(q), bq = T.plain(b.q).toLowerCase().indexOf(q);
      return (aq === -1 ? 999 : aq) - (bq === -1 ? 999 : bq);
    });
    out.innerHTML = '<div class="k" style="margin-bottom:var(--s-3)">' + plural(hits.length, 'card') + '</div>' +
      '<ul class="list tight">' + hits.slice(0, 120).map(function (c) {
        var d = S.getDeck(c.deck), u = d.unitById[c.u];
        return '<li><button class="qrow" data-peek="' + c.i + '">' +
          '<span class="qq">' + T.html(c.q) + '</span>' +
          '<span class="qa" hidden>' + T.html(c.a) + '</span>' +
          '<span class="qmeta">' + esc(nice(d)) + ' · ' + esc(u ? u.title : '') + '</span></button></li>';
      }).join('') + '</ul>' +
      (hits.length > 120 ? '<div class="empty cap">Showing the first 120.</div>' : '');
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
      return '<li><button class="ledger mid" data-go="#/d/' + c.id + '">' +
        '<span class="lname">' + esc(nice(c.id)) + '</span>' +
        '<span class="lval num">' + pct(st.pct) + '</span></button></li>';
    }).join('');

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

    var caption = [];
    if (S.studiedToday()) caption.push(plural(S.studiedToday(), 'card') + ' today');
    if (S.streak() > 1) caption.push(S.streak() + '-day streak');
    mount(
      '<div class="head"><span class="k">Known</span>' +
      '<h1>' + totals.known.toLocaleString() + ' of ' + totals.total.toLocaleString() + '</h1>' +
      (caption.length ? '<div class="sub">' + caption.join(' · ') + '</div>' : '') + '</div>' +
      (rows ? '<ul class="list tight">' + rows + '</ul>' : '') +
      spark +
      (totals.due ? '<div style="margin-top:var(--s-5)"><button class="act" data-go="#/review">Review ' + totals.due + '</button></div>' : '')
    );
  }

  /* ==========================================================================
     VIEW · settings
     ========================================================================== */
  function viewSettings() {
    curDeckId = null;
    var s = S.getSettings();
    var profs = S.listProfiles(), active = S.activeProfile();
    mount(
      backbar('Settings') +
      '<div class="head"><span class="k">Studying as</span><h1 style="font-size:var(--t-title)">' + esc(active.name) + '</h1></div>' +
      '<div class="profile">' + profs.map(function (p) {
        return '<button class="chip" data-profile="' + p.id + '" aria-pressed="' + (p.id === active.id) + '">' + esc(p.name) + '</button>';
      }).join('') + '<button class="chip" data-addprofile>+ Add</button></div>' +

      '<div class="k" style="margin:var(--s-5) 0 var(--s-2)">Session</div>' +
      setRow('Typing mode', 'Type the answer before you reveal it', 'typing', s.typing) +
      setRow('High-yield first', 'Put the core cards at the front of new material', 'coreFirst', s.coreFirst) +
      numRow('Cards per session', 'How long one sitting runs', 'sessionSize', s.sessionSize, [15, 20, 30, 50, 100]) +
      numRow('New cards per session', 'Caps how much unseen material arrives at once', 'newPerSession', s.newPerSession, [5, 10, 20, 40]) +

      '<div class="k" style="margin:var(--s-5) 0 var(--s-2)">Appearance</div>' +
      '<div class="setrow"><div class="sname">Theme<small>Follows the phone unless you pin it</small></div></div>' +
      '<div class="lg lg-seg" id="themeseg">' +
        ['auto', 'light', 'dark'].map(function (t) {
          return '<div class="lg-seg-item' + (s.theme === t ? ' is-active' : '') + '" data-theme="' + t + '">' +
            t.charAt(0).toUpperCase() + t.slice(1) + '</div>';
        }).join('') + '</div>' +
      setRow('Glass material', 'Turn off for maximum contrast and battery', 'glass', s.glass) +

      '<div class="k" style="margin:var(--s-5) 0 var(--s-2)">Account</div>' +
      (S.account.connected()
        ? '<div class="setrow"><div class="sname">Synced<small>This profile follows your account across devices</small></div>' +
          '<button class="chip" data-acct-off>Disconnect</button></div>'
        : '<div class="setrow stack"><div class="sname">Connect<small>Open your account link, or paste the token from it</small></div>' +
          '<div class="searchbar" style="margin-top:6px"><input id="acct-tok" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="account token"></div></div>') +

      '<div class="k" style="margin:var(--s-5) 0 var(--s-2)">Data</div>' +
      '<div class="data-list">' +
        '<button class="textbtn" data-export>Copy backup to clipboard</button>' +
        '<button class="textbtn" data-import>Restore from a backup</button>' +
        '<button class="textbtn" data-reset>Reset this profile’s progress</button>' +
        (profs.length > 1 ? '<button class="textbtn" data-delprofile>Delete profile “' + esc(active.name) + '”</button>' : '') +
      '</div>' +
      '<div class="empty" style="font-size:13px">' + S.getIndex().total.toLocaleString() + ' cards, written to the College Board Course and Exam Descriptions. ' +
      (S.account.connected()
        ? 'Everything runs offline once installed; progress syncs to your account.</div>'
        : 'Everything runs offline once installed; progress never leaves this phone.</div>')
    );

  }

  function setRow(name, sub, key, on) {
    return '<div class="setrow"><div class="sname">' + esc(name) + '<small>' + esc(sub) + '</small></div>' +
      '<div class="lg lg-toggle' + (on ? ' is-on' : '') + '" data-set="' + key + '" role="switch" tabindex="0" aria-checked="' + !!on + '"><div class="lg-knob"></div></div></div>';
  }
  function numRow(name, sub, key, val, choices) {
    return '<div class="setrow stack"><div class="sname">' + esc(name) + '<small>' + esc(sub) + '</small></div>' +
      '<div class="numchips">' + choices.map(function (n) {
        return '<button class="chip" data-num="' + key + '" data-val="' + n + '" aria-pressed="' + (val === n) + '">' + n + '</button>';
      }).join('') + '</div></div>';
  }

  /* ==========================================================================
     global delegation
     ========================================================================== */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var goEl = t.closest('[data-go]');
    if (goEl) { go(goEl.getAttribute('data-go')); return; }
    if (t.closest('[data-back]')) { history.back(); return; }
    if (t.closest('[data-exit]')) {
      var back = sess && sess.deck ? '#/d/' + sess.deck.id : '#/';
      sess = null; go(back); return;
    }
    if (t.closest('[data-undo]')) { undo(); return; }
    if (t.closest('[data-reveal]')) { reveal(); return; }
    if (t.closest('[data-star]')) { starCurrent(); return; }
    var g = t.closest('[data-grade]');
    if (g) { doGrade(parseInt(g.getAttribute('data-grade'), 10)); return; }
    var pk = t.closest('[data-pick]');
    if (pk) { pickChoice(parseInt(pk.getAttribute('data-pick'), 10)); return; }
    if (t.closest('[data-next]')) { nextQuiz(); return; }

    var peek = t.closest('[data-peek]');
    if (peek) {
      var a = peek.querySelector('.qa');
      a.hidden = !a.hidden;
      peek.classList.toggle('open', !a.hidden);
      return;
    }
    var numEl = t.closest('[data-num]');
    if (numEl) {
      S.setSetting(numEl.getAttribute('data-num'), parseInt(numEl.getAttribute('data-val'), 10));
      viewSettings(); return;
    }
    var pr = t.closest('[data-profile]');
    if (pr) { S.switchProfile(pr.getAttribute('data-profile')); applyTheme(); viewSettings(); toast('Switched profile'); return; }
    if (t.closest('[data-addprofile]')) {
      var name = prompt('Name for the new profile');
      if (name && name.trim()) { S.addProfile(name.trim()); applyTheme(); viewSettings(); }
      return;
    }
    if (t.closest('[data-delprofile]')) {
      if (confirm('Delete this profile and its progress?')) { S.removeProfile(S.activeProfile().id); viewSettings(); }
      return;
    }
    if (t.closest('[data-reset]')) {
      if (confirm('Reset all progress for this profile? Cards stay, scheduling is wiped.')) { S.resetProgress(); viewSettings(); toast('Progress reset'); }
      return;
    }
    if (t.closest('[data-export]')) {
      var data = S.exportData();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data).then(function () { toast('Backup copied'); },
          function () { showBackup(data); });
      } else showBackup(data);
      return;
    }
    if (t.closest('[data-import]')) {
      var text = prompt('Paste a backup');
      if (!text) return;
      try { S.importData(text); applyTheme(); viewSettings(); toast('Backup restored'); }
      catch (err) { alert('That does not look like an AP Decks backup.'); }
      return;
    }
  });

  function showBackup(data) {
    var w = document.createElement('textarea');
    w.value = data;
    w.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;height:36vh;z-index:99;font-size:12px';
    document.body.appendChild(w); w.select();
    toast('Select and copy, then tap outside');
    setTimeout(function () {
      document.addEventListener('click', function rm() { w.remove(); document.removeEventListener('click', rm); });
    }, 400);
  }

  /* keyboard */
  document.addEventListener('keydown', function (e) {
    if (!sess) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      if (sess.quiz) { if (sess.answered) nextQuiz(); }
      else if (!sess.revealed) reveal(); else doGrade(1);
      return;
    }
    if (!sess.quiz && sess.revealed) {
      if (e.key === '1') doGrade(0);
      if (e.key === '2') doGrade(1);
      if (e.key === '3') doGrade(2);
    }
    if (sess.quiz && !sess.answered && /^[1-4]$/.test(e.key)) pickChoice(parseInt(e.key, 10) - 1);
    if (e.key === 's') starCurrent();
  });

  /* ==========================================================================
     router
     ========================================================================== */
  function syncTabs(route) {
    var idx = route === '/review' ? 1 : route === '/search' ? 2 : route === '/stats' ? 3 : 0;
    var items = tabbar.querySelectorAll('.lg-tab');
    items.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
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
    syncTabs(['review', 'search', 'stats'].indexOf(p[0]) > -1 ? root : '/');
    sess = (p[0] === 'study' || p[0] === 'quiz' || p[0] === 'review') ? sess : null;

    if (!p.length) {
      if (isWide()) {
        var ixw = S.getIndex();
        var firstDue = null;
        ixw.courses.forEach(function (c) { var dk = S.getDeck(c.id); if (!firstDue && dk && S.deckStats(dk).due) firstDue = c.id; });
        return viewCourse(lastDeckId || firstDue || ixw.courses[0].id);
      }
      return viewDecks();
    }
    if (p[0] === 'd' && p[1] && p[2] === 'u' && p[3]) return viewUnit(p[1], p[3]);
    if (p[0] === 'd' && p[1]) return viewCourse(p[1]);
    if (p[0] === 'study') return startSession(p[1], p[2] || 'smart', p[3], false);
    if (p[0] === 'quiz') return startSession(p[1], p[2] || 'smart', p[3], true);
    if (p[0] === 'review') return startReview();
    if (p[0] === 'search') return viewSearch();
    if (p[0] === 'stats') return viewStats();
    if (p[0] === 'settings') return viewSettings();
    return viewDecks();
  }

  var TAB_ROUTES = ['/', '/review', '/search', '/stats'];
  tabbar.addEventListener('lg-change', function (e) {
    var r = TAB_ROUTES[e.detail];
    if (r) go('#' + r);
  });
  tabbar.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-route]');
    if (tab) go('#' + tab.getAttribute('data-route'));
  });

  window.addEventListener('hashchange', route);
  WIDE_MQ.addEventListener('change', function () {
    if (sess) renderCard(); else route();   // never restart a session over a resize
  });
  // Some engines never fire the MQ change event under emulation or in-page
  // resizes — watch resize too and re-render only when the split actually flips.
  var wasWide = isWide(), sizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(function () {
      if (isWide() === wasWide) return;
      wasWide = isWide();
      if (sess) renderCard(); else route();
    }, 120);
  });

  /* account: paste-token commit + disconnect + re-render when a pull merges */
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'acct-tok') {
      if (S.account.setToken(e.target.value)) route();
    }
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-acct-off]')) { S.account.clearToken(); route(); }
  });
  window.addEventListener('apdecks-sync', function (ev) {
    if (ev.detail && ev.detail.changed) route();   // fresher progress just merged in
  });

  /* ==========================================================================
     boot
     ========================================================================== */
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  app.innerHTML = '<div class="head"><span class="k">AP Decks</span><h1>Loading</h1></div>';
  S.loadAll().then(function () {
    route();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }).catch(function (err) {
    app.innerHTML = '<div class="head"><span class="k">AP Decks</span><h1>Could not load the decks</h1>' +
      '<div class="sub">' + esc(err.message) + '</div></div>' +
      '<button class="act" onclick="location.reload()">Try again</button>';
  });
})();
