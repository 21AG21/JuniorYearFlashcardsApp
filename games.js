/* ==========================================================================
   games.js — subject games. One mechanic family per subject:
   order (timeline / ranking), match (pairs), circle (the unit circle).
   Content is text on the ground; feedback is shade and weight, never color.
   ========================================================================== */
(function () {
  'use strict';

  var ctx = null;                 // {mount, esc, go, toast, nice, backbar}
  var S = null, T = null;
  var st = null;                  // live game state
  var timer = null;

  /* ---------------- registry --------------------------------------------- */
  var GAMES = {
    timeline:   { name: 'Timeline',         deck: 'apush',  kind: 'order'  },
    chemorder:  { name: 'Order it',         deck: 'chem',   kind: 'order'  },
    langmatch:  { name: 'Device match',     deck: 'lang',   kind: 'match'  },
    frmatch:    { name: 'Vocab match',      deck: 'french', kind: 'match'  },
    unitcircle: { name: 'Unit circle',      deck: 'calcbc', kind: 'circle' },
    derivmatch: { name: 'Derivative match', deck: 'calcbc', kind: 'match'  }
  };
  var ORDER_BY_DECK = ['lang', 'chem', 'french', 'calcbc', 'apush'];

  /* ---------------- data: US History timeline ---------------------------- */
  /* One event per year, well separated, spanning the CED periods. */
  var EVENTS = [
    ['Columbus reaches the Americas', 1492],
    ['Jamestown founded', 1607],
    ['Mayflower Compact', 1620],
    ["Bacon's Rebellion", 1676],
    ['Salem witch trials', 1692],
    ['French and Indian War begins', 1754],
    ['Proclamation of 1763', 1763],
    ['Boston Massacre', 1770],
    ['Boston Tea Party', 1773],
    ['Declaration of Independence', 1776],
    ['British surrender at Yorktown', 1781],
    ['Constitutional Convention', 1787],
    ['Bill of Rights ratified', 1791],
    ['Louisiana Purchase', 1803],
    ['War of 1812 begins', 1812],
    ['Missouri Compromise', 1820],
    ['Monroe Doctrine', 1823],
    ['Indian Removal Act', 1830],
    ['Trail of Tears', 1838],
    ['Seneca Falls Convention', 1848],
    ['California Gold Rush', 1849],
    ['Compromise of 1850', 1850],
    ['Kansas–Nebraska Act', 1854],
    ['Dred Scott decision', 1857],
    ['Attack on Fort Sumter', 1861],
    ['Emancipation Proclamation', 1863],
    ['Civil War ends', 1865],
    ['Transcontinental Railroad completed', 1869],
    ['Reconstruction ends', 1877],
    ['Dawes Act', 1887],
    ['Wounded Knee Massacre', 1890],
    ['Plessy v. Ferguson', 1896],
    ['Spanish–American War', 1898],
    ['Pure Food and Drug Act', 1906],
    ['United States enters World War I', 1917],
    ['19th Amendment ratified', 1920],
    ['Stock market crash', 1929],
    ['First New Deal begins', 1933],
    ['Attack on Pearl Harbor', 1941],
    ['D-Day', 1944],
    ['World War II ends', 1945],
    ['Brown v. Board of Education', 1954],
    ['Cuban Missile Crisis', 1962],
    ['March on Washington', 1963],
    ['Civil Rights Act', 1964],
    ['Voting Rights Act', 1965],
    ['Apollo 11 Moon landing', 1969],
    ['Watergate break-in', 1972],
    ['Nixon resigns', 1974],
    ['Berlin Wall falls', 1989],
    ['Soviet Union dissolves', 1991],
    ['September 11 attacks', 2001],
    ['Financial crisis', 2008]
  ];

  /* ---------------- data: Chemistry ranking axes ------------------------- */
  /* Every axis ranks biggest-first; values are far enough apart to be fair. */
  var CHEM_AXES = [
    { title: 'Most electronegative first', items: [
      ['F', 3.98, 'EN 3.98'], ['O', 3.44, 'EN 3.44'], ['Cl', 3.16, 'EN 3.16'],
      ['S', 2.58, 'EN 2.58'], ['H', 2.20, 'EN 2.20'], ['Na', 0.93, 'EN 0.93']] },
    { title: 'Largest atomic radius first', items: [
      ['Cs', 260, '260 pm'], ['K', 220, '220 pm'], ['Na', 180, '180 pm'],
      ['Mg', 150, '150 pm'], ['Al', 125, '125 pm'], ['Cl', 100, '100 pm'], ['F', 50, '50 pm']] },
    { title: 'Highest first ionization energy first', items: [
      ['He', 2372, '2372 kJ/mol'], ['Ne', 2081, '2081 kJ/mol'], ['F', 1681, '1681 kJ/mol'],
      ['N', 1402, '1402 kJ/mol'], ['O', 1314, '1314 kJ/mol'], ['C', 1086, '1086 kJ/mol'], ['Li', 520, '520 kJ/mol']] },
    { title: 'Strongest acid first', items: [
      ['HCl', 1e6, 'strong acid'], ['H₃PO₄', 7.5e-3, 'Ka 7.5×10⁻³'], ['HF', 6.6e-4, 'Ka 6.6×10⁻⁴'],
      ['CH₃COOH', 1.8e-5, 'Ka 1.8×10⁻⁵'], ['H₂CO₃', 4.3e-7, 'Ka 4.3×10⁻⁷'], ['NH₄⁺', 5.6e-10, 'Ka 5.6×10⁻¹⁰']] },
    { title: 'Highest boiling point first', items: [
      ['H₂O', 100, '100 °C'], ['CH₃OH', 65, '65 °C'], ['CH₃CHO', 20, '20 °C'],
      ['NH₃', -33, '−33 °C'], ['CH₄', -162, '−162 °C'], ['He', -269, '−269 °C']] },
    { title: 'Most active metal first', items: [
      ['Li', 3.04, 'E° −3.04 V'], ['Na', 2.71, 'E° −2.71 V'], ['Mg', 2.37, 'E° −2.37 V'],
      ['Zn', 0.76, 'E° −0.76 V'], ['Fe', 0.44, 'E° −0.44 V'], ['Cu', -0.34, 'E° +0.34 V'], ['Au', -1.50, 'E° +1.50 V']] }
  ];

  /* ---------------- data: English device pairs --------------------------- */
  var LANG_PAIRS = [
    ['Ethos', 'appeal to credibility'],
    ['Pathos', 'appeal to emotion'],
    ['Logos', 'appeal to logic'],
    ['Anaphora', 'repetition at the start of lines'],
    ['Antithesis', 'contrast set in parallel form'],
    ['Juxtaposition', 'side-by-side contrast'],
    ['Hyperbole', 'deliberate exaggeration'],
    ['Understatement', 'downplaying on purpose'],
    ['Verbal irony', 'saying one thing, meaning another'],
    ['Metonymy', 'an associated stand-in — “the crown”'],
    ['Synecdoche', 'a part for the whole — “all hands”'],
    ['Allusion', 'an indirect reference'],
    ['Anecdote', 'a short personal story as evidence'],
    ['Concession', 'granting part of the opposing point'],
    ['Refutation', 'disproving the opposing point'],
    ['Rhetorical question', 'a question asked for effect'],
    ['Parallelism', 'matching grammatical structure'],
    ['Diction', 'word choice'],
    ['Syntax', 'sentence structure'],
    ['Euphemism', 'softened phrasing for something harsh']
  ];

  /* ---------------- data: Calc BC derivative pairs ------------------------ */
  var DERIV_PAIRS = [
    ['sin x', 'cos x'],
    ['cos x', '−sin x'],
    ['tan x', 'sec² x'],
    ['ln x', '1/x'],
    ['eˣ', 'eˣ'],
    ['x²', '2x'],
    ['√x', '1/(2√x)'],
    ['1/x', '−1/x²'],
    ['sec x', 'sec x · tan x'],
    ['arctan x', '1/(1 + x²)'],
    ['arcsin x', '1/√(1 − x²)'],
    ['ln|sec x|', 'tan x'],
    ['x ln x − x', 'ln x'],
    ['sin(x²)', '2x cos(x²)']
  ];

  /* ---------------- data: the unit circle -------------------------------- */
  /* label, cos display, sin display, tan display, cos value, sin value */
  var ANGLES = [
    ['0',     '1',     '0',     '0',          1,      0],
    ['π/6',   '√3/2',  '1/2',   '√3/3',       0.866,  0.5],
    ['π/4',   '√2/2',  '√2/2',  '1',          0.707,  0.707],
    ['π/3',   '1/2',   '√3/2',  '√3',         0.5,    0.866],
    ['π/2',   '0',     '1',     'undefined',  0,      1],
    ['2π/3',  '−1/2',  '√3/2',  '−√3',       -0.5,    0.866],
    ['3π/4',  '−√2/2', '√2/2',  '−1',        -0.707,  0.707],
    ['5π/6',  '−√3/2', '1/2',   '−√3/3',     -0.866,  0.5],
    ['π',     '−1',    '0',     '0',         -1,      0],
    ['7π/6',  '−√3/2', '−1/2',  '√3/3',      -0.866, -0.5],
    ['5π/4',  '−√2/2', '−√2/2', '1',         -0.707, -0.707],
    ['4π/3',  '−1/2',  '−√3/2', '√3',        -0.5,   -0.866],
    ['3π/2',  '0',     '−1',    'undefined',  0,     -1],
    ['5π/3',  '1/2',   '−√3/2', '−√3',        0.5,   -0.866],
    ['7π/4',  '√2/2',  '−√2/2', '−1',         0.707, -0.707],
    ['11π/6', '√3/2',  '−1/2',  '−√3/3',      0.866, -0.5]
  ];

  /* ---------------- helpers ---------------------------------------------- */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr, n) { return shuffle(arr.slice()).slice(0, n); }
  function esc(s) { return ctx.esc(s); }

  function best() { return S.getSettings().gameBest || {}; }
  function saveBest(id, n, label) {
    var b = best();
    if (!b[id] || n > b[id].n) { b[id] = { n: n, label: label }; S.setSetting('gameBest', b); }
  }

  /* ---------------- hub ---------------------------------------------------- */
  function hub() {
    st = null;
    var b = best();
    var html = '<div class="head"><h1>Games</h1></div>';
    ORDER_BY_DECK.forEach(function (deckId) {
      var rows = '';
      Object.keys(GAMES).forEach(function (id) {
        if (GAMES[id].deck !== deckId) return;
        rows += '<li><button class="ledger mid" data-go="#/game/' + id + '">' +
          '<span class="lname">' + esc(GAMES[id].name) + '</span>' +
          (b[id] ? '<span class="lsub">best ' + esc(b[id].label) + '</span>' : '') +
          '</button></li>';
      });
      if (rows) html += '<div class="ulabel">' + esc(ctx.nice(deckId)) + '</div><ul class="list" style="gap:0">' + rows + '</ul>';
    });
    ctx.mount(html);
  }

  function play(id) {
    var g = GAMES[id];
    if (!g) return ctx.go('#/games');
    clearTimeout(timer);
    if (g.kind === 'order') startOrder(id);
    else if (g.kind === 'match') startMatch(id);
    else startCircle(id);
  }

  function gameTop(scopeText, posText) {
    return '<div class="sess-top"><span class="scope">' + esc(scopeText) + '</span>' +
      '<span class="pos num">' + esc(posText) + '</span></div>';
  }
  function gameDone(id, score, total, label) {
    saveBest(id, score / total, label);
    var g = GAMES[id];
    st = null;
    ctx.mount(
      ctx.backbar(GAMES[id].name) +
      '<div class="done-hero"><span class="k">' + esc(g.name) + '</span>' +
      '<div class="v num">' + esc(label) + '</div></div>' +
      '<button class="act" data-gagain="' + id + '">Play again</button>' +
      '<div style="margin-top:var(--s-3)"><button class="textbtn" data-go="#/games">All games</button></div>',
      { session: true }
    );
  }

  /* ==========================================================================
     ORDER — the timeline mechanic: place each item into the sequence
     ========================================================================== */
  function startOrder(id) {
    var axis, pool;
    if (id === 'timeline') {
      axis = { title: 'Earliest at the top' };
      pool = sample(EVENTS, 8).map(function (e) { return { n: e[0], v: e[1], vl: String(e[1]) }; });
    } else {
      var ax = CHEM_AXES[Math.floor(Math.random() * CHEM_AXES.length)];
      axis = { title: ax.title };
      // rank biggest-first: negate so the engine always sorts ascending
      pool = sample(ax.items, Math.min(6, ax.items.length)).map(function (e) { return { n: e[0], v: -e[1], vl: e[2] }; });
    }
    var anchor = pool.shift();
    st = { id: id, kind: 'order', axis: axis, queue: pool, placed: [anchor],
           cur: pool[0], score: 0, done: 0, total: pool.length };
    renderOrder();
  }

  function renderOrder(justIdx) {
    if (!st.cur) {
      var label = st.score + ' of ' + st.total;
      return gameDone(st.id, st.score, st.total, label);
    }
    var rows = '<button class="gap" data-gap="0" aria-label="Place first"></button>';
    st.placed.forEach(function (p, i) {
      rows += '<div class="grow' + (p.miss ? ' miss' : '') + (i === justIdx ? ' reveal' : '') + '">' +
        '<span class="gname">' + esc(p.n) + '</span><span class="gval num">' + esc(p.vl) + '</span></div>' +
        '<button class="gap" data-gap="' + (i + 1) + '" aria-label="Place after ' + esc(p.n) + '"></button>';
    });
    ctx.mount(
      ctx.backbar(GAMES[st.id].name) +
      gameTop(st.axis.title, (st.done + 1) + ' of ' + st.total) +
      '<div class="gcur"><span class="k">Place this</span><div class="gname">' + esc(st.cur.n) + '</div></div>' +
      '<div class="gline">' + rows + '</div>',
      { session: true, keepScroll: st.done > 0 }
    );
  }

  function placeAt(gapIdx) {
    if (!st || st.kind !== 'order' || !st.cur) return;
    var item = st.cur, placed = st.placed;
    var okBefore = gapIdx === 0 || placed[gapIdx - 1].v <= item.v;
    var okAfter = gapIdx === placed.length || item.v <= placed[gapIdx].v;
    var idx;
    if (okBefore && okAfter) {
      st.score++;
      idx = gapIdx;
    } else {
      item.miss = true;
      idx = 0;
      while (idx < placed.length && placed[idx].v < item.v) idx++;
      ctx.toast(item.n + ' — ' + item.vl);
    }
    placed.splice(idx, 0, item);
    st.done++;
    st.queue.shift();
    st.cur = st.queue[0] || null;
    renderOrder(idx);
  }

  /* ==========================================================================
     MATCH — two columns of text; pair them up
     ========================================================================== */
  function frenchPairs() {
    var d = S.getDeck('french');
    var out = [], seenQ = {}, seenA = {};
    if (d) {
      shuffle(d.cards.slice()).forEach(function (c) {
        if (out.length >= 6) return;
        var q = T.plain(c.q).trim(), a = T.plain(c.a).trim();
        if (!q || !a || q.length > 26 || a.length > 26) return;
        if (/\d/.test(q + a)) return;
        if (seenQ[q.toLowerCase()] || seenA[a.toLowerCase()]) return;
        seenQ[q.toLowerCase()] = seenA[a.toLowerCase()] = 1;
        out.push([q, a]);
      });
    }
    return out.length >= 4 ? out : LANG_PAIRS.slice(0, 6); // never render an empty board
  }

  function startMatch(id) {
    var pairs = id === 'frmatch' ? frenchPairs()
      : sample(id === 'derivmatch' ? DERIV_PAIRS : LANG_PAIRS, 6);
    var left = [], right = [];
    pairs.forEach(function (p, i) { left.push({ t: p[0], k: i }); right.push({ t: p[1], k: i }); });
    shuffle(left); shuffle(right);
    st = { id: id, kind: 'match', left: left, right: right, selL: -1, selR: -1,
           tries: 0, hits: 0, total: pairs.length };
    renderMatch();
  }

  function renderMatch() {
    if (st.hits === st.total) {
      var label = st.total + ' in ' + st.tries;
      return gameDone(st.id, st.total / Math.max(st.tries, st.total), label);
    }
    var head = st.id === 'derivmatch' ? ['f(x)', "f′(x)"]
      : st.id === 'frmatch' ? ['French', 'English'] : ['Device', 'What it is'];
    function col(items, side, sel) {
      return items.map(function (it, i) {
        var cls = 'mrow' + (it.done ? ' done' : i === sel ? ' sel' : '');
        return '<button class="' + cls + '" data-m' + side + '="' + i + '"' + (it.done ? ' disabled' : '') + '>' +
          esc(it.t) + '</button>';
      }).join('');
    }
    ctx.mount(
      ctx.backbar(GAMES[st.id].name) +
      gameTop(st.hits + ' of ' + st.total + ' matched', st.tries + (st.tries === 1 ? ' try' : ' tries')) +
      '<div class="mcols">' +
        '<div><div class="k mhead">' + esc(head[0]) + '</div>' + col(st.left, 'l', st.selL) + '</div>' +
        '<div><div class="k mhead">' + esc(head[1]) + '</div>' + col(st.right, 'r', st.selR) + '</div>' +
      '</div>',
      { session: true, keepScroll: true }
    );
  }

  function pickMatch(side, i) {
    if (!st || st.kind !== 'match') return;
    if (side === 'l') st.selL = (st.selL === i ? -1 : i); else st.selR = (st.selR === i ? -1 : i);
    if (st.selL > -1 && st.selR > -1) {
      st.tries++;
      var L = st.left[st.selL], R = st.right[st.selR];
      if (L.k === R.k) { L.done = R.done = true; st.hits++; }
      st.selL = st.selR = -1;
    }
    renderMatch();
  }

  /* ==========================================================================
     CIRCLE — the unit circle: tap angles, tap coordinates, name exact values
     ========================================================================== */
  function startCircle(id) {
    var qs = [];
    var idxs = shuffle(ANGLES.map(function (_, i) { return i; }));
    for (var i = 0; i < 12; i++) {
      var a = idxs[i % idxs.length];
      var type = i % 3; // rotate: tap the angle, tap the coordinates, name a value
      qs.push({ type: type, a: a });
    }
    st = { id: id, kind: 'circle', qs: shuffle(qs), i: 0, score: 0, total: 12,
           lock: false, wrong: -1 };
    renderCircle();
  }

  function circleSVG(q) {
    var s = '<svg viewBox="0 0 300 300" class="uc" aria-label="Unit circle">';
    s += '<line class="uc-axis" x1="20" y1="150" x2="280" y2="150"/>';
    s += '<line class="uc-axis" x1="150" y1="20" x2="150" y2="280"/>';
    s += '<circle class="uc-ring" cx="150" cy="150" r="110" fill="none"/>';
    ANGLES.forEach(function (a, i) {
      var x = 150 + 110 * a[4], y = 150 - 110 * a[5];
      var cls = 'uc-dot';
      if (st.lock && i === st.qs[st.i].a) cls += ' on';        // the right answer, revealed
      if (st.lock && i === st.wrong) cls += ' off';            // the tap that missed
      if (!st.lock && q.type === 2 && i === q.a) cls += ' on'; // the highlighted point
      s += '<g' + (q.type !== 2 ? ' data-dot="' + i + '"' : '') + '>' +
        '<circle class="uc-hit" cx="' + x + '" cy="' + y + '" r="17"/>' +
        '<circle class="' + cls + '" cx="' + x + '" cy="' + y + '" r="5"/></g>';
    });
    s += '</svg>';
    return s;
  }

  function circlePrompt(q) {
    var a = ANGLES[q.a];
    if (q.type === 0) return 'Tap ' + a[0];
    if (q.type === 1) return 'Tap the angle where cos θ = ' + a[1] + ' and sin θ = ' + a[2];
    var fn = ['cos', 'sin', 'tan'][q.a % 3];
    q.fn = fn;
    return 'What is ' + fn + ' θ at the marked point?';
  }

  function circleChoices(q) {
    if (q.type !== 2) return '';
    var a = ANGLES[q.a];
    var right = q.fn === 'cos' ? a[1] : q.fn === 'sin' ? a[2] : a[3];
    if (!q.choices) {
      var pool = { cos: ['1', '√3/2', '√2/2', '1/2', '0', '−1/2', '−√2/2', '−√3/2', '−1'],
                   sin: ['1', '√3/2', '√2/2', '1/2', '0', '−1/2', '−√2/2', '−√3/2', '−1'],
                   tan: ['0', '√3/3', '1', '√3', 'undefined', '−√3', '−1', '−√3/3'] }[q.fn];
      q.choices = shuffle([right].concat(sample(pool.filter(function (v) { return v !== right; }), 3)));
      q.right = right;
    }
    return '<div class="choices">' + q.choices.map(function (c, i) {
      var state = '';
      if (st.lock) state = c === q.right ? 'right' : (i === st.wrongChoice ? 'wrong' : 'mute');
      return '<button class="choice num" data-gc="' + i + '"' +
        (state ? ' data-state="' + state + '"' : '') + (st.lock ? ' disabled' : '') + '>' +
        q.fn + ' θ = ' + esc(c) + '</button>';
    }).join('') + '</div>';
  }

  function renderCircle() {
    if (st.i >= st.total) {
      var label = st.score + ' of ' + st.total;
      return gameDone(st.id, st.score, st.total, label);
    }
    var q = st.qs[st.i];
    var prompt = circlePrompt(q);
    ctx.mount(
      ctx.backbar(GAMES[st.id].name) +
      gameTop(st.score + ' right', (st.i + 1) + ' of ' + st.total) +
      '<div class="gcur"><div class="gname">' + esc(prompt) + '</div></div>' +
      '<div class="ucwrap">' + circleSVG(q) + '</div>' +
      circleChoices(q),
      { session: true, keepScroll: st.i > 0 }
    );
  }

  function nextCircle() {
    st.i++; st.lock = false; st.wrong = -1; st.wrongChoice = -1;
    renderCircle();
  }

  function tapDot(i) {
    if (!st || st.kind !== 'circle' || st.lock) return;
    var q = st.qs[st.i];
    if (q.type === 2) return;
    st.lock = true;
    if (i === q.a) { st.score++; }
    else { st.wrong = i; ctx.toast(ANGLES[q.a][0] + ' is here'); }
    renderCircle();
    timer = setTimeout(nextCircle, i === q.a ? 550 : 1400);
  }

  function tapChoice(i) {
    if (!st || st.kind !== 'circle' || st.lock) return;
    var q = st.qs[st.i];
    if (q.type !== 2) return;
    st.lock = true;
    if (q.choices[i] === q.right) { st.score++; }
    else { st.wrongChoice = i; }
    renderCircle();
    timer = setTimeout(nextCircle, q.choices[i] === q.right ? 550 : 1400);
  }

  /* ---------------- delegation ------------------------------------------- */
  function onClick(e) {
    var t = e.target;
    var el;
    if ((el = t.closest('[data-gagain]'))) { play(el.getAttribute('data-gagain')); return; }
    if (!st) return;
    if ((el = t.closest('[data-gap]'))) { placeAt(parseInt(el.getAttribute('data-gap'), 10)); return; }
    if ((el = t.closest('[data-ml]'))) { pickMatch('l', parseInt(el.getAttribute('data-ml'), 10)); return; }
    if ((el = t.closest('[data-mr]'))) { pickMatch('r', parseInt(el.getAttribute('data-mr'), 10)); return; }
    if ((el = t.closest('[data-dot]'))) { tapDot(parseInt(el.getAttribute('data-dot'), 10)); return; }
    if ((el = t.closest('[data-gc]'))) { tapChoice(parseInt(el.getAttribute('data-gc'), 10)); return; }
  }

  /* ---------------- public ------------------------------------------------ */
  window.Games = {
    init: function (c) {
      ctx = c; S = window.Store; T = window.Tex;
      document.addEventListener('click', onClick);
    },
    hub: hub,
    play: play,
    linksFor: function (deckId) {
      var out = [];
      Object.keys(GAMES).forEach(function (id) {
        if (GAMES[id].deck === deckId) out.push([GAMES[id].name, id]);
      });
      return out;
    }
  };
})();
