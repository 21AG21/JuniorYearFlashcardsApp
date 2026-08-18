/* ==========================================================================
   tex.js — a very small math renderer for the restricted markup used by the
   decks. No webfonts, no CDN, ~4 KB: the app has to work on a plane.
   Supported: \frac \sqrt ^ _ \int \sum \prod \lim \left \right, function
   names, thin spaces, and a symbol table. Anything unknown renders literally.
   ========================================================================== */
(function (global) {
  'use strict';

  var SYM = {
    pi:'π', theta:'θ', phi:'φ', varphi:'φ', alpha:'α', beta:'β',
    gamma:'γ', delta:'δ', Delta:'Δ', epsilon:'ε', varepsilon:'ε',
    lambda:'λ', Lambda:'Λ', mu:'μ', nu:'ν', rho:'ρ', sigma:'σ',
    Sigma:'Σ', tau:'τ', omega:'ω', Omega:'Ω', psi:'ψ', chi:'χ',
    eta:'η', zeta:'ζ', kappa:'κ', xi:'ξ', Gamma:'Γ', Phi:'Φ',
    Theta:'Θ', Pi:'Π',
    infty:'∞', to:'→', rightarrow:'→', Rightarrow:'⇒', leftarrow:'←',
    leftrightarrow:'↔', mapsto:'↦', implies:'⇒', iff:'⇔',
    pm:'±', mp:'∓', times:'×', cdot:'·', div:'÷', ast:'∗',
    le:'≤', leq:'≤', ge:'≥', geq:'≥', ne:'≠', neq:'≠',
    approx:'≈', equiv:'≡', sim:'∼', propto:'∝', ll:'≪', gg:'≫',
    partial:'∂', nabla:'∇', circ:'°', degree:'°', deg:'°',
    ldots:'…', dots:'…', cdots:'⋯', vdots:'⋮',
    in:'∈', notin:'∉', subset:'⊂', subseteq:'⊆', cup:'∪', cap:'∩',
    forall:'∀', exists:'∃', emptyset:'∅', therefore:'∴',
    rightleftharpoons:'⇌', longrightarrow:'⟶', prime:'′', ell:'ℓ'
  };
  var FUNCS = ('sin cos tan sec csc cot sinh cosh tanh arcsin arccos arctan arcsec arccsc arccot ' +
               'ln log exp lim sup inf max min det dim gcd deg arg').split(' ');
  var BIGOPS = { int:'∫', iint:'∬', oint:'∮', sum:'∑', prod:'∏' };
  var THIN = { ',':' ', ';':' ', ':':' ', '!':'', ' ':' ' };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function Parser(src) { this.s = src; this.i = 0; }

  Parser.prototype.peek = function () { return this.s.charAt(this.i); };

  /* Read a {...} group (or a single token if no brace) and return its HTML. */
  Parser.prototype.group = function () {
    this.skipSpace();
    if (this.peek() === '{') {
      var depth = 0, start = ++this.i;
      while (this.i < this.s.length) {
        var ch = this.s.charAt(this.i);
        if (ch === '\\') { this.i += 2; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') { if (!depth) break; depth--; }
        this.i++;
      }
      var inner = this.s.slice(start, this.i);
      this.i++; // consume }
      return render(inner);
    }
    if (this.peek() === '\\') {
      var m = /^\\([a-zA-Z]+|.)/.exec(this.s.slice(this.i));
      if (m) { this.i += m[0].length; var h = this.command(m[1]);
        if (m[1].length > 1) { while (this.s.charAt(this.i) === ' ') this.i++; }
        return h; }
    }
    var c = this.s.charAt(this.i++);
    return esc(c);
  };

  Parser.prototype.skipSpace = function () {
    while (' \t\n'.indexOf(this.peek()) > -1 && this.i < this.s.length) this.i++;
  };

  /* Optional _{..} / ^{..} attached to a big operator, in either order. */
  Parser.prototype.limits = function () {
    var lo = null, hi = null;
    for (var k = 0; k < 2; k++) {
      this.skipSpace();
      var c = this.peek();
      if (c === '_' && lo === null) { this.i++; lo = this.group(); }
      else if (c === '^' && hi === null) { this.i++; hi = this.group(); }
      else break;
    }
    return { lo: lo, hi: hi };
  };

  Parser.prototype.command = function (name) {
    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      var n = this.group(), d = this.group();
      return '<span class="mfrac"><span>' + n + '</span><span>' + d + '</span></span>';
    }
    if (name === 'sqrt') {
      var r = this.group();
      return '<span class="msqrt">√<u>' + r + '</u></span>';
    }
    if (BIGOPS[name]) {
      var L = this.limits(), out = '<span class="mop"><b>' + BIGOPS[name] + '</b>';
      if (L.lo !== null || L.hi !== null) {
        out += '<span class="lim"><span>' + (L.hi || '') + '</span><span>' + (L.lo || '') + '</span></span>';
      }
      return out + '</span>';
    }
    if (name === 'lim' || name === 'sup' || name === 'inf' || name === 'max' || name === 'min') {
      var M = this.limits();
      if (M.lo !== null) {
        return '<span class="munder"><span>' + name + '</span><span>' + M.lo + '</span></span>';
      }
      return '<span class="mfn">' + name + '</span>';
    }
    if (name === 'left' || name === 'right' || name === 'bigl' || name === 'bigr' ||
        name === 'Bigl' || name === 'Bigr' || name === 'displaystyle' || name === 'limits') {
      return ''; // the delimiter itself is emitted by the next literal char
    }
    if (name === 'text' || name === 'mathrm' || name === 'mathit' || name === 'operatorname') {
      return '<span class="mfn">' + this.group() + '</span>';
    }
    if (FUNCS.indexOf(name) > -1) return '<span class="mfn">' + name + '</span>';
    if (Object.prototype.hasOwnProperty.call(SYM, name)) return SYM[name];
    if (Object.prototype.hasOwnProperty.call(THIN, name)) return THIN[name];
    if (name === '\\') return '<br>';
    return esc(name.length > 1 ? '\\' + name : name);
  };

  /* Render one math expression to HTML. */
  function render(src) {
    var p = new Parser(src), out = [];
    function last() { return out.length ? out[out.length - 1] : ''; }
    while (p.i < p.s.length) {
      var ch = p.s.charAt(p.i);
      if (ch === '\\') {
        var m = /^\\([a-zA-Z]+|.)/.exec(p.s.slice(p.i));
        if (!m) { p.i++; continue; }
        p.i += m[0].length;
        var html = p.command(m[1]);
        if (m[1].length > 1) { while (p.s.charAt(p.i) === ' ') p.i++; }
        out.push(html);
        continue;
      }
      if (ch === '^' || ch === '_') {
        p.i++;
        var body = p.group();
        var tag = ch === '^' ? 'sup' : 'sub';
        // attach to the previous atom rather than floating on its own
        if (out.length) out[out.length - 1] = last() + '<' + tag + '>' + body + '</' + tag + '>';
        else out.push('<' + tag + '>' + body + '</' + tag + '>');
        continue;
      }
      if (ch === '{' || ch === '}') { p.i++; continue; }
      if (ch === '~') { p.i++; out.push(' '); continue; }
      p.i++;
      out.push(esc(ch));
    }
    return out.join('');
  }

  /* Render a mixed string. A $...$ island counts as math only when it really
     looks like math — otherwise "$15 million" would vanish into the parser. */
  var MATHY = /[\\^_]/;
  function renderText(str) {
    if (str === null || str === undefined) return '';
    str = String(str);
    if (str.indexOf('$') === -1) return esc(str).replace(/\n/g, '<br>');
    var out = '', last = 0, re = /\$([^$]+)\$/g, m;
    while ((m = re.exec(str)) !== null) {
      if (!MATHY.test(m[1])) continue;
      out += esc(str.slice(last, m.index)).replace(/\n/g, '<br>');
      out += '<span class="math">' + render(m[1]) + '</span>';
      last = re.lastIndex;
    }
    out += esc(str.slice(last)).replace(/\n/g, '<br>');
    return out;
  }

  function plain(str) {
    if (str === null || str === undefined) return '';
    var t = String(str).replace(/\$([^$]+)\$/g, function (whole, inner) {
      return MATHY.test(inner) ? inner : whole;
    });
    t = t.replace(/\\(?:,|;|:|!)/g, ' ');
    t = t.replace(/\\([a-zA-Z]+)/g, function (_, n) {
      if (Object.prototype.hasOwnProperty.call(SYM, n)) return SYM[n];
      if (Object.prototype.hasOwnProperty.call(BIGOPS, n)) return BIGOPS[n];
      if (FUNCS.indexOf(n) > -1) return ' ' + n + ' ';
      if (n === 'frac' || n === 'dfrac' || n === 'tfrac') return ' ';
      if (n === 'sqrt') return '√';
      return ' ';
    });
    return t.replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  global.Tex = { render: render, html: renderText, plain: plain };
})(window);
