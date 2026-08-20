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
    degcircle:  { name: 'Degrees on the circle', deck: 'calcbc', kind: 'circle' },
    triggraphs: { name: 'Name that graph',  deck: 'calcbc', kind: 'graph'  },
    identmatch: { name: 'Identity match',   deck: 'calcbc', kind: 'match'  },
    derivmatch: { name: 'Derivative match', deck: 'calcbc', kind: 'match'  }
  };
  var ORDER_BY_DECK = ['lang', 'chem', 'french', 'calcbc', 'apush'];

  /* ==========================================================================
     Content is GENERATED, never a hardcoded question list. The only tables
     below are reference facts (a periodic table, the 16 standard angles,
     identity facts) — the questions built from them are random every round.
     ========================================================================== */

  /* elements: symbol, atomic number, atomic mass (u), Pauling EN (0 = n/a) */
  var ELEMENTS = [
    ['H', 1, 1.0, 2.20], ['He', 2, 4.0, 0], ['Li', 3, 6.9, 0.98], ['Be', 4, 9.0, 1.57],
    ['B', 5, 10.8, 2.04], ['C', 6, 12.0, 2.55], ['N', 7, 14.0, 3.04], ['O', 8, 16.0, 3.44],
    ['F', 9, 19.0, 3.98], ['Ne', 10, 20.2, 0], ['Na', 11, 23.0, 0.93], ['Mg', 12, 24.3, 1.31],
    ['Al', 13, 27.0, 1.61], ['Si', 14, 28.1, 1.90], ['P', 15, 31.0, 2.19], ['S', 16, 32.1, 2.58],
    ['Cl', 17, 35.5, 3.16], ['Ar', 18, 39.9, 0], ['K', 19, 39.1, 0.82], ['Ca', 20, 40.1, 1.00],
    ['Ti', 22, 47.9, 1.54], ['Cr', 24, 52.0, 1.66], ['Mn', 25, 54.9, 1.55], ['Fe', 26, 55.8, 1.83],
    ['Ni', 28, 58.7, 1.91], ['Cu', 29, 63.5, 1.90], ['Zn', 30, 65.4, 1.65], ['Br', 35, 79.9, 2.96],
    ['Ag', 47, 107.9, 1.93], ['Sn', 50, 118.7, 1.96], ['I', 53, 126.9, 2.66], ['Cs', 55, 132.9, 0.79],
    ['Ba', 56, 137.3, 0.89], ['Au', 79, 197.0, 2.54], ['Hg', 80, 200.6, 2.00], ['Pb', 82, 207.2, 1.87]
  ];

  /* identity facts; each round mixes a few with generated exact values */
  var IDENTS = [
    ['sin²x + cos²x', '1'],
    ['1 + tan²x', 'sec²x'],
    ['1 + cot²x', 'csc²x'],
    ['sin 2x', '2 sin x cos x'],
    ['cos 2x', 'cos²x − sin²x'],
    ['tan x', 'sin x / cos x'],
    ['cot x', 'cos x / sin x'],
    ['sec x', '1 / cos x'],
    ['csc x', '1 / sin x'],
    ['sin(−x)', '−sin x'],
    ['cos(−x)', 'cos x'],
    ['sin(π/2 − x)', 'cos x'],
    ['cos(π/2 − x)', 'sin x'],
    ['tan 2x', '2 tan x / (1 − tan²x)']
  ];

  /* graph base functions; every question is a generated A·f(Bx) with a sign */
  var GFNS = [
    ['sin', Math.sin], ['cos', Math.cos], ['tan', Math.tan],
    ['sec', function (x) { return 1 / Math.cos(x); }],
    ['csc', function (x) { return 1 / Math.sin(x); }],
    ['cot', function (x) { return Math.cos(x) / Math.sin(x); }]
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
  /* degree labels, index-parallel to ANGLES */
  var DEG = ['0°', '30°', '45°', '60°', '90°', '120°', '135°', '150°', '180°',
             '210°', '225°', '240°', '270°', '300°', '315°', '330°'];
  /* the same angles as fractions of π, for generating coterminal labels */
  var FRAC = [[0, 1], [1, 6], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4], [5, 6], [1, 1],
              [7, 6], [5, 4], [4, 3], [3, 2], [5, 3], [7, 4], [11, 6]];
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function radLabel(i, k) {
    var num = FRAC[i][0] + 2 * k * FRAC[i][1], den = FRAC[i][1];
    if (!num) return '0';
    var g = gcd(Math.abs(num), den); num /= g; den /= g;
    var sign = num < 0 ? '−' : ''; num = Math.abs(num);
    return sign + (num === 1 ? '' : num) + 'π' + (den === 1 ? '' : '/' + den);
  }
  function degLabel(i, k) {
    var d = parseInt(DEG[i], 10) + 360 * k;
    return (d < 0 ? '−' : '') + Math.abs(d) + '°';   // typographic minus, like every label
  }

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
    else if (g.kind === 'graph') startGraph(id);
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
     ORDER — the timeline mechanic: place each item into the sequence.
     Timeline rounds are extracted live from the US History deck; chemistry
     rounds are generated from the periodic-table reference.
     ========================================================================== */
  function clean(s) { return T.plain(s).replace(/\s+/g, ' ').trim(); }

  function datedCards() {
    var d = S.getDeck('apush'), out = [], seenYear = {};
    if (!d) return out;
    shuffle(d.cards.slice()).forEach(function (c) {
      var q = clean(c.q);
      if (q.length < 8 || q.length > 70) return;
      var ys = (q + ' ' + T.plain(c.a)).match(/\b(1[4-9]\d\d|20[0-2]\d)\b/g);
      if (!ys) return;
      var uniq = {}; ys.forEach(function (y) { uniq[y] = 1; });
      var keys = Object.keys(uniq);
      if (keys.length !== 1) return;                          // exactly one year → unambiguous
      if (new RegExp('\\b' + keys[0] + '\\b').test(q)) return; // never print the answer in the prompt
      var y = parseInt(keys[0], 10);
      if (seenYear[y]) return;
      seenYear[y] = 1;
      out.push({ n: q, v: y, vl: String(y) });
    });
    return out;
  }
  function topicCards() {
    var d = S.getDeck('apush'), out = [], seenT = {};
    if (!d) return out;
    shuffle(d.cards.slice()).forEach(function (c) {
      var q = clean(c.q);
      if (q.length < 8 || q.length > 70 || !c.t || !/^\d+\.\d+$/.test(c.t) || seenT[c.t]) return;
      seenT[c.t] = 1;
      var m = c.t.split('.');
      out.push({ n: q, v: parseInt(m[0], 10) * 100 + parseInt(m[1], 10), vl: 'Topic ' + c.t });
    });
    return out;
  }

  function chemRound() {
    var axes = [
      { title: 'Highest atomic number first', get: function (e) { return e[1]; }, vl: function (e) { return 'Z = ' + e[1]; } },
      { title: 'Heaviest first', get: function (e) { return e[2]; }, vl: function (e) { return e[2].toFixed(1) + ' u'; } },
      { title: 'Most electronegative first', get: function (e) { return e[3]; }, vl: function (e) { return 'EN ' + e[3].toFixed(2); }, gap: 0.25 }
    ];
    var ax = axes[Math.floor(Math.random() * axes.length)];
    var pool = shuffle(ELEMENTS.filter(function (e) { return ax.get(e) > 0; }).slice());
    var picked = [];
    pool.forEach(function (e) {
      if (picked.length >= 6) return;
      var v = ax.get(e);
      var fair = picked.every(function (p) { return Math.abs(ax.get(p) - v) >= (ax.gap || 0.001); });
      if (fair) picked.push(e);
    });
    return { title: ax.title,
      items: picked.map(function (e) { return { n: e[0], v: -ax.get(e), vl: ax.vl(e) }; }) };
  }

  function startOrder(id) {
    var axis, pool;
    if (id === 'timeline') {
      pool = datedCards();
      if (pool.length >= 8) {
        axis = { title: 'Earliest at the top' };
        pool = pool.slice(0, 8);
      } else {
        axis = { title: 'Course order, earliest first' };
        pool = topicCards().slice(0, 8);
      }
    } else {
      var ax = chemRound();
      axis = { title: ax.title };
      pool = ax.items;   // values negated so the engine always sorts ascending
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
     MATCH — two columns of text; pair them up. Boards come from the decks
     themselves or from symbolic generators — a fresh board every round.
     ========================================================================== */
  function deckPairs(deckId) {
    var d = S.getDeck(deckId);
    var tiers = [[40, 60], [60, 90], [80, 120]];
    var cands = [], seenQ = {}, seenA = {};
    if (d) {
      for (var t = 0; t < tiers.length && cands.length < 24; t++) {
        shuffle(d.cards.slice()).forEach(function (c) {
          if (cands.length >= 60) return;
          var q = clean(c.q), a = clean(c.a);
          if (q.length < 3 || a.length < 2 || q.length > tiers[t][0] || a.length > tiers[t][1]) return;
          var kq = q.toLowerCase(), ka = a.toLowerCase();
          if (seenQ[kq] || seenA[ka]) return;
          seenQ[kq] = seenA[ka] = 1;
          cands.push([q, a]);
        });
      }
    }
    return sample(cands, Math.min(6, cands.length));
  }

  function sup(n) {
    return String(n).split('').map(function (c) { return '⁰¹²³⁴⁵⁶⁷⁸⁹'.charAt(+c); }).join('');
  }
  function genDerivPairs(n) {
    var out = [], seenL = {}, seenR = {}, guard = 0;
    while (out.length < n && guard++ < 200) {
      var a = 2 + Math.floor(Math.random() * 4);           // 2..5
      var p = 2 + Math.floor(Math.random() * 4);           // 2..5
      var ax = (Math.random() < 0.4 ? '' : a) + 'x';
      var A = ax === 'x' ? 1 : a;
      var pre = A > 1 ? A + ' ' : '';
      var pair;
      switch (Math.floor(Math.random() * 8)) {
        case 0: pair = ['x' + sup(p), p + 'x' + (p - 1 > 1 ? sup(p - 1) : '')]; break;
        case 1: pair = [a + 'x' + sup(p), (a * p) + 'x' + (p - 1 > 1 ? sup(p - 1) : '')]; break;
        case 2: pair = ['sin ' + ax, pre + 'cos ' + ax]; break;
        case 3: pair = ['cos ' + ax, '−' + pre + 'sin ' + ax]; break;
        case 4: pair = ['tan ' + ax, pre + 'sec² ' + ax]; break;
        case 5: pair = [A > 1 ? 'e' + sup(A) + 'ˣ' : 'eˣ', A > 1 ? A + ' e' + sup(A) + 'ˣ' : 'eˣ']; break;
        case 6: pair = ['ln ' + ax, '1/x']; break;
        case 7: var m = 1 + Math.floor(Math.random() * 3);
          pair = ['1/x' + (m > 1 ? sup(m) : ''), '−' + m + '/x' + sup(m + 1)]; break;
      }
      if (seenL[pair[0]] || seenR[pair[1]]) continue;
      seenL[pair[0]] = seenR[pair[1]] = 1;
      out.push(pair);
    }
    return out;
  }
  function genValuePairs(n, seenR) {
    var out = [], seenL = {}, guard = 0;
    while (out.length < n && guard++ < 100) {
      var i = Math.floor(Math.random() * 16);
      var fn = ['sin', 'cos', 'tan'][Math.floor(Math.random() * 3)];
      var val = fn === 'sin' ? ANGLES[i][2] : fn === 'cos' ? ANGLES[i][1] : ANGLES[i][3];
      var left = fn + ' ' + ANGLES[i][0];
      if (seenL[left] || seenR[val]) continue;
      seenL[left] = 1; seenR[val] = 1;
      out.push([left, val]);
    }
    return out;
  }
  function genIdentPairs(n) {
    var seenR = {};
    var facts = sample(IDENTS, 3).filter(function (pr) {
      if (seenR[pr[1]]) return false;
      seenR[pr[1]] = 1; return true;
    });
    return shuffle(facts.concat(genValuePairs(n - facts.length, seenR)));
  }

  function startMatch(id) {
    var pairs =
      id === 'derivmatch' ? genDerivPairs(6) :
      id === 'identmatch' ? genIdentPairs(6) :
      deckPairs(id === 'frmatch' ? 'french' : 'lang');
    if (!pairs.length) pairs = genValuePairs(6, {});   // never render an empty board
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
      : st.id === 'identmatch' ? ['Expression', 'Equals']
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
    var deg = id === 'degcircle';
    var qs = [];
    var idxs = shuffle(ANGLES.map(function (_, i) { return i; }));
    for (var i = 0; i < 12; i++) {
      var a = idxs[i % idxs.length];
      // radians rotate tap-angle / tap-coordinates / name-a-value;
      // degrees alternate tap-a-degree / name-the-marked-angle
      var type = deg ? (i % 2 ? 3 : 0) : i % 3;
      qs.push({ type: type, a: a });
    }
    st = { id: id, kind: 'circle', deg: deg, qs: shuffle(qs), i: 0, score: 0, total: 12,
           lock: false, wrong: -1 };
    renderCircle();
  }

  function circleSVG(q) {
    var s = '<svg viewBox="0 0 300 300" class="uc" aria-label="Unit circle">';
    s += '<line class="uc-axis" x1="20" y1="150" x2="280" y2="150"/>';
    s += '<line class="uc-axis" x1="150" y1="20" x2="150" y2="280"/>';
    s += '<circle class="uc-ring" cx="150" cy="150" r="110" fill="none"/>';
    var marked = q.type === 2 || q.type === 3;   // a highlighted point, answered via choices
    ANGLES.forEach(function (a, i) {
      var x = 150 + 110 * a[4], y = 150 - 110 * a[5];
      var cls = 'uc-dot';
      if (st.lock && i === st.qs[st.i].a) cls += ' on';        // the right answer, revealed
      if (st.lock && i === st.wrong) cls += ' off';            // the tap that missed
      if (!st.lock && marked && i === q.a) cls += ' on';       // the highlighted point
      s += '<g' + (!marked ? ' data-dot="' + i + '"' : '') + '>' +
        '<circle class="uc-hit" cx="' + x + '" cy="' + y + '" r="17"/>' +
        '<circle class="' + cls + '" cx="' + x + '" cy="' + y + '" r="5"/></g>';
    });
    s += '</svg>';
    return s;
  }

  function circlePrompt(q) {
    var a = ANGLES[q.a];
    if (q.type === 0) {
      // half the time the label is a generated coterminal form (17π/6, −210°…)
      if (q.k == null) q.k = Math.random() < 0.5 ? 0 : [-1, 1, 2][Math.floor(Math.random() * 3)];
      return 'Tap ' + (st.deg ? degLabel(q.a, q.k) : radLabel(q.a, q.k));
    }
    if (q.type === 1) return 'Tap the angle where cos θ = ' + a[1] + ' and sin θ = ' + a[2];
    if (q.type === 3) return 'Which angle is marked?';
    var fn = ['cos', 'sin', 'tan'][q.a % 3];
    q.fn = fn;
    return 'What is ' + fn + ' θ at the marked point?';
  }

  function circleChoices(q) {
    if (q.type !== 2 && q.type !== 3) return '';
    if (!q.choices) {
      if (q.type === 3) {
        q.right = DEG[q.a];
        q.choices = shuffle([q.right].concat(sample(DEG.filter(function (v) { return v !== q.right; }), 3)));
      } else {
        var a = ANGLES[q.a];
        var right = q.fn === 'cos' ? a[1] : q.fn === 'sin' ? a[2] : a[3];
        var pool = { cos: ['1', '√3/2', '√2/2', '1/2', '0', '−1/2', '−√2/2', '−√3/2', '−1'],
                     sin: ['1', '√3/2', '√2/2', '1/2', '0', '−1/2', '−√2/2', '−√3/2', '−1'],
                     tan: ['0', '√3/3', '1', '√3', 'undefined', '−√3', '−1', '−√3/3'] }[q.fn];
        q.choices = shuffle([right].concat(sample(pool.filter(function (v) { return v !== right; }), 3)));
        q.right = right;
      }
    }
    return '<div class="choices">' + q.choices.map(function (c, i) {
      var state = '';
      if (st.lock) state = c === q.right ? 'right' : (i === st.wrongChoice ? 'wrong' : 'mute');
      return '<button class="choice num" data-gc="' + i + '"' +
        (state ? ' data-state="' + state + '"' : '') + (st.lock ? ' disabled' : '') + '>' +
        (q.type === 3 ? esc(c) : q.fn + ' θ = ' + esc(c)) + '</button>';
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
    // the advance timer can outlive the game — never render over another view
    if (!st || st.kind !== 'circle') return;
    if (location.hash.indexOf('#/game/' + st.id) !== 0) { st = null; return; }
    st.i++; st.lock = false; st.wrong = -1; st.wrongChoice = -1;
    renderCircle();
  }

  function tapDot(i) {
    if (!st || st.kind !== 'circle' || st.lock) return;
    var q = st.qs[st.i];
    if (q.type === 2 || q.type === 3) return;
    st.lock = true;
    if (i === q.a) { st.score++; }
    else { st.wrong = i; ctx.toast((st.deg ? DEG[q.a] : ANGLES[q.a][0]) + ' is here'); }
    renderCircle();
    timer = setTimeout(nextCircle, i === q.a ? 550 : 1400);
  }

  function tapChoice(i) {
    if (!st || st.kind !== 'circle' || st.lock) return;
    var q = st.qs[st.i];
    if (q.type !== 2 && q.type !== 3) return;
    st.lock = true;
    if (q.choices[i] === q.right) { st.score++; }
    else { st.wrongChoice = i; }
    renderCircle();
    timer = setTimeout(nextCircle, q.choices[i] === q.right ? 550 : 1400);
  }

  /* ==========================================================================
     GRAPH — which trig function is this?
     ========================================================================== */
  function graphLabel(g) {
    return (g.s < 0 ? '−' : '') + (g.A > 1 ? g.A + ' ' : '') + GFNS[g.f][0] + ' ' + (g.B > 1 ? g.B + 'x' : 'x');
  }
  function genGraph() {
    var f = Math.floor(Math.random() * 6);
    var g = { f: f, A: 1, B: 1, s: Math.random() < 0.3 ? -1 : 1 };
    if (f < 2) { g.A = [1, 1, 2, 3][Math.floor(Math.random() * 4)]; g.B = [1, 1, 2, 3][Math.floor(Math.random() * 4)]; }
    else if (f === 2) { g.B = [1, 1, 2][Math.floor(Math.random() * 3)]; }
    return g;
  }
  function graphChoicesFor(g) {
    var right = graphLabel(g), seen = {}, out = [right], guard = 0;
    seen[right] = 1;
    while (out.length < 4 && guard++ < 80) {
      var m = { f: g.f, A: g.A, B: g.B, s: g.s };
      var r = Math.floor(Math.random() * 4);
      if (r === 0) m.s = -m.s;
      else if (r === 1) m.A = m.A === 1 ? 2 : m.A === 2 ? 3 : 1;
      else if (r === 2) m.B = m.B === 1 ? 2 : 1;
      else m.f = (m.f + 1 + Math.floor(Math.random() * 5)) % 6;
      if (m.f >= 2) m.A = 1;          // only sin/cos show an amplitude
      if (m.f >= 3) m.B = 1;
      var lb = graphLabel(m);
      if (!seen[lb]) { seen[lb] = 1; out.push(lb); }
    }
    return shuffle(out);
  }

  function startGraph(id) {
    var qs = [], seen = {}, guard = 0;
    while (qs.length < 10 && guard++ < 120) {
      var g = genGraph();
      var lb = graphLabel(g);
      if (seen[lb]) continue;
      seen[lb] = 1;
      qs.push(g);
    }
    st = { id: id, kind: 'graph', qs: qs, i: 0, score: 0, total: qs.length,
           lock: false, wrongChoice: -1 };
    renderGraph();
  }

  function graphSVG(g) {
    var f = function (x) { return g.s * g.A * GFNS[g.f][1](g.B * x); };
    var s = '<svg viewBox="0 0 320 190" class="tg" aria-label="Graph of a trig function">';
    s += '<line class="tg-axis" x1="10" y1="95" x2="310" y2="95"/>';
    s += '<line class="tg-axis" x1="160" y1="10" x2="160" y2="180"/>';
    [-2, -1, 1, 2].forEach(function (k) {   // ticks at multiples of pi
      var px = 160 + k * 75;
      s += '<line class="tg-axis" x1="' + px + '" y1="91" x2="' + px + '" y2="99"/>';
    });
    var segs = [], cur = [];
    for (var px = 0; px <= 300; px++) {
      var x = (px / 300) * 4 * Math.PI - 2 * Math.PI;
      var y = f(x);
      if (!isFinite(y) || Math.abs(y) > 3.4) { if (cur.length > 1) segs.push(cur); cur = []; continue; }
      var X = 10 + px, Y = 95 - y * 28;
      if (cur.length && Math.abs(Y - cur[cur.length - 1][1]) > 80) {   // asymptote jump
        if (cur.length > 1) segs.push(cur); cur = [];
      }
      cur.push([X, Y]);
    }
    if (cur.length > 1) segs.push(cur);
    segs.forEach(function (seg) {
      s += '<polyline class="tg-curve" points="' +
        seg.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>';
    });
    return s + '</svg>';
  }

  function renderGraph() {
    if (st.i >= st.total) {
      return gameDone(st.id, st.score, st.total, st.score + ' of ' + st.total);
    }
    var g = st.qs[st.i];
    if (!g.choices) {
      g.right = graphLabel(g);
      g.choices = graphChoicesFor(g);
    }
    var ch = '<div class="choices">' + g.choices.map(function (cl, i) {
      var state = '';
      if (st.lock) state = cl === g.right ? 'right' : (i === st.wrongChoice ? 'wrong' : 'mute');
      return '<button class="choice" data-gc="' + i + '"' +
        (state ? ' data-state="' + state + '"' : '') + (st.lock ? ' disabled' : '') +
        '>y = ' + esc(cl) + '</button>';
    }).join('') + '</div>';
    ctx.mount(
      ctx.backbar(GAMES[st.id].name) +
      gameTop(st.score + ' right', (st.i + 1) + ' of ' + st.total) +
      '<div class="gcur"><div class="gname">Which function is this?</div></div>' +
      '<div class="tgwrap">' + graphSVG(g) + '</div>' + ch,
      { session: true, keepScroll: st.i > 0 }
    );
  }

  function nextGraph() {
    if (!st || st.kind !== 'graph') return;
    if (location.hash.indexOf('#/game/' + st.id) !== 0) { st = null; return; }
    st.i++; st.lock = false; st.wrongChoice = -1;
    renderGraph();
  }

  function tapGraphChoice(i) {
    if (!st || st.kind !== 'graph' || st.lock) return;
    var g = st.qs[st.i];
    st.lock = true;
    var right = g.choices[i] === g.right;
    if (right) { st.score++; } else { st.wrongChoice = i; }
    renderGraph();
    timer = setTimeout(nextGraph, right ? 550 : 1400);
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
    if ((el = t.closest('[data-gc]'))) {
      var ci = parseInt(el.getAttribute('data-gc'), 10);
      if (st.kind === 'graph') tapGraphChoice(ci); else tapChoice(ci);
      return;
    }
  }

  /* ---------------- public ------------------------------------------------ */
  window.Games = {
    init: function (c) {
      ctx = c; S = window.Store; T = window.Tex;
      document.addEventListener('click', onClick);
    },
    hub: hub,
    play: play,
    onRoute: function (root) {
      // leaving the games clears live state and any pending advance timer
      if (root !== 'game') { clearTimeout(timer); st = null; }
    },
    linksFor: function (deckId) {
      var out = [];
      Object.keys(GAMES).forEach(function (id) {
        if (GAMES[id].deck === deckId) out.push([GAMES[id].name, id]);
      });
      return out;
    }
  };
})();
