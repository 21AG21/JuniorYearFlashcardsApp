/* ==========================================================================
   Liquid Glass v2 — motion engine (springs, press "energize", gel drag,
   fluid tab pill, stretchy toggle, rubber-band sliders). No refraction.
   ~7 KB. No dependencies. Works everywhere Pointer Events do.

   Motion model follows Apple's fluid-interface rules: respond on pointer-
   down, track 1:1, springs (response / damping) instead of durations,
   velocity hand-off on release, rubber-band at edges, everything
   interruptible.
   ========================================================================== */
(function () {
  'use strict';
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------- */
  /* Spring engine: one rAF loop, semi-implicit Euler with sub-steps.        */
  /* response = seconds to reach target-ish; damping 1 = no overshoot.       */
  /* ---------------------------------------------------------------------- */
  var active = new Set(), rafId = 0, lastT = 0, afterFrame = [];
  function loop(t) {
    rafId = 0;
    var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 1 / 60; lastT = t;
    active.forEach(function (s) { s._step(dt); });
    for (var i = 0; i < afterFrame.length; i++) afterFrame[i](t);
    if (active.size) rafId = requestAnimationFrame(loop); else lastT = 0;
  }
  function wake() { if (!rafId) rafId = requestAnimationFrame(loop); }

  function Spring(value, onUpdate, response, damping) {
    this.v = value; this.t = value; this.vel = 0;
    this.response = response || 0.35; this.damping = damping == null ? 1 : damping;
    this.onUpdate = onUpdate; this.eps = 0.001;
  }
  Spring.prototype.set = function (target, o) {
    o = o || {};
    if (o.response) this.response = o.response;
    if (o.damping != null) this.damping = o.damping;
    if (o.velocity != null) this.vel = o.velocity;
    this.t = target;
    if (reduceMotion || o.immediate) { this.v = target; this.vel = 0; this.onUpdate(this.v); active.delete(this); return this; }
    active.add(this); wake(); return this;
  };
  Spring.prototype._step = function (dt) {
    var w = 2 * Math.PI / this.response, k = w * w, c = 2 * this.damping * w;
    var n = Math.ceil(dt / 0.004), h = dt / n;
    for (var i = 0; i < n; i++) {
      var a = -k * (this.v - this.t) - c * this.vel;
      this.vel += a * h; this.v += this.vel * h;
    }
    if (Math.abs(this.v - this.t) < this.eps && Math.abs(this.vel) < this.eps * 20) { this.v = this.t; this.vel = 0; active.delete(this); }
    this.onUpdate(this.v);
  };

  /* Apple's rubber-band: the further past the bound, the less it follows */
  function rubber(over, dim, c) { c = c || 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }
  /* Apple's momentum projection (UIScrollView deceleration) */
  function project(v, rate) { rate = rate || 0.998; return (v / 1000) * rate / (1 - rate); }

  /* pointer velocity tracker (px/s) */
  function Tracker() { this.h = []; }
  Tracker.prototype.push = function (x, y, t) { this.h.push([x, y, t]); if (this.h.length > 6) this.h.shift(); };
  Tracker.prototype.velocity = function () {
    var h = this.h; if (h.length < 2) return [0, 0];
    var a = h[0], b = h[h.length - 1], dt = (b[2] - a[2]) / 1000;
    if (dt < 0.004) return [0, 0];
    var vx = (b[0] - a[0]) / dt, vy = (b[1] - a[1]) / dt, m = 6000;
    return [clamp(vx, -m, m), clamp(vy, -m, m)];
  };

  /* observers (v3/v4 add-ons hook here to sync refraction / shader shapes) */
  var observers = [];
  function notify(el, state) { for (var i = 0; i < observers.length; i++) observers[i](el, state); }
  var setVar = function (el, k, v) { el.style.setProperty(k, v); };

  /* ---------------------------------------------------------------------- */
  /* Pressable glass: scale up, energize, gel-pull toward the finger.        */
  /* ---------------------------------------------------------------------- */
  function pressable(el, opts) {
    opts = opts || {};
    var big = el.offsetWidth > 120 || el.offsetHeight > 120;
    var upScale = opts.scale || (big ? 1.03 : 1.09);
    var st = { sx: 1, sy: 1, tx: 0, ty: 0, press: 0 };
    var apply = function () {
      setVar(el, '--lg-sx', st.sx.toFixed(4)); setVar(el, '--lg-sy', st.sy.toFixed(4));
      setVar(el, '--lg-tx', st.tx.toFixed(2) + 'px'); setVar(el, '--lg-ty', st.ty.toFixed(2) + 'px');
      setVar(el, '--lg-press', st.press.toFixed(3));
      notify(el, st);
    };
    var sSx = new Spring(1, function (v) { st.sx = v; apply(); }, 0.28, 1);
    var sSy = new Spring(1, function (v) { st.sy = v; apply(); }, 0.28, 1);
    var sTx = new Spring(0, function (v) { st.tx = v; apply(); }, 0.22, 1);
    var sTy = new Spring(0, function (v) { st.ty = v; apply(); }, 0.22, 1);
    var sP  = new Spring(0, function (v) { st.press = v; apply(); }, 0.18, 1);
    var down = null, rect = null;
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      down = { x: e.clientX, y: e.clientY, id: e.pointerId }; rect = el.getBoundingClientRect();
      el.classList.add('is-pressed');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      sSx.set(upScale, { response: 0.26, damping: 1 }); sSy.set(upScale, { response: 0.26, damping: 1 });
      sP.set(1, { response: 0.16 });
    });
    el.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== down.id) return;
      // gel: the glass leans toward the finger, and stretches a little along the pull
      var dx = e.clientX - down.x, dy = e.clientY - down.y;
      var px = rubber(dx, 60, 0.4), py = rubber(dy, 60, 0.4);
      sTx.set(px * 0.35); sTy.set(py * 0.35);
      var stretch = clamp(Math.hypot(px, py) / 300, 0, 0.06);
      var ax = Math.abs(px) / (Math.abs(px) + Math.abs(py) + 1e-6);
      sSx.set(upScale + stretch * ax); sSy.set(upScale + stretch * (1 - ax));
      // moved far away → cancel highlight (like UIKit)
      var out = e.clientX < rect.left - 44 || e.clientX > rect.right + 44 || e.clientY < rect.top - 44 || e.clientY > rect.bottom + 44;
      sP.set(out ? 0 : 1, { response: 0.2 });
    });
    var up = function (e) {
      if (!down || (e && e.pointerId !== down.id)) return;
      down = null; el.classList.remove('is-pressed');
      // release "pops" back with a touch of bounce — the finger's release is momentum
      sSx.set(1, { response: 0.42, damping: 0.62 }); sSy.set(1, { response: 0.42, damping: 0.62 });
      sTx.set(0, { response: 0.4, damping: 0.7 }); sTy.set(0, { response: 0.4, damping: 0.7 });
      sP.set(0, { response: 0.45 });
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    apply();
    el._lgState = st;
  }

  /* ---------------------------------------------------------------------- */
  /* Tab bar / segmented control: fluid selection pill                       */
  /* ---------------------------------------------------------------------- */
  function pillGroup(el, itemSel) {
    var pill = el.querySelector('.lg-pill');
    if (!pill) { pill = document.createElement('div'); pill.className = 'lg-pill'; el.insertBefore(pill, el.firstChild); }
    var items = Array.prototype.slice.call(el.querySelectorAll(itemSel));
    var index = Math.max(0, items.findIndex(function (i) { return i.classList.contains('is-active'); }));
    var st = { x: 0, w: 0, sx: 1, sy: 1, press: 0 };
    var apply = function () {
      pill.style.left = '0px'; pill.style.width = st.w.toFixed(2) + 'px';
      setVar(pill, '--lg-tx', st.x.toFixed(2) + 'px'); setVar(pill, '--lg-sx', st.sx.toFixed(4)); setVar(pill, '--lg-sy', st.sy.toFixed(4));
      notify(pill, st);
    };
    var sX = new Spring(0, function (v) { st.x = v; apply(); }, 0.35, 0.85);
    var sW = new Spring(0, function (v) { st.w = v; apply(); }, 0.35, 0.9);
    var sS = new Spring(1, function (v) { st.sx = st.sy = v; apply(); }, 0.25, 1);
    var isTabbar = el.classList.contains('lg-tabbar');
    // iOS 26 tab pill = item content + 20pt each side — but that spec assumes
    // content-sized icon+label items. A glyph-only bar with fixed-width tabs is
    // already padded, so the pill hugs the tab instead of eating its neighbors.
    var hasLabel = isTabbar && !!el.querySelector(itemSel + ' span');
    var EXTRA = isTabbar ? (hasLabel ? 20 : -8) : 0;
    var geo = function (i) { var it = items[i]; return { x: it.offsetLeft - EXTRA, w: it.offsetWidth + 2 * EXTRA }; };
    var bounds = function () { var first = items[0], last = items[items.length - 1]; return { min: first.offsetLeft - EXTRA, max: last.offsetLeft + last.offsetWidth + EXTRA }; };
    var nearest = function (cx) { var best = 0, bd = 1e9; items.forEach(function (it, k) { var d = Math.abs(it.offsetLeft + it.offsetWidth / 2 - cx); if (d < bd) { bd = d; best = k; } }); return best; };
    var mark = function (i) { items.forEach(function (it, k) { it.classList.toggle('is-active', k === i); it.setAttribute('aria-selected', k === i); }); };
    var select = function (i, opt) {
      opt = opt || {};
      index = clamp(i, 0, items.length - 1);
      var g = geo(index);
      sX.set(g.x, { response: opt.response || 0.38, damping: opt.damping == null ? 0.82 : opt.damping, velocity: opt.velocity, immediate: opt.immediate });
      sW.set(g.w, { immediate: opt.immediate });
      mark(index);
      if (opt.fire) el.dispatchEvent(new CustomEvent('lg-change', { detail: index, bubbles: true }));
    };
    var down = null, tracker = null, minX = 0, maxX = 0;
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      var r = el.getBoundingClientRect(), b = bounds();
      down = { id: e.pointerId, x0: e.clientX, left: r.left, moved: false, i0: index };
      tracker = new Tracker(); tracker.push(e.clientX, e.clientY, e.timeStamp);
      minX = b.min; maxX = b.max - st.w;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.classList.add('is-pressed');
      // the pill lifts under the finger
      sS.set(1.08, { response: 0.22 });
      // grab offset: if the finger is on the pill keep the offset, else jump under finger
      var localX = e.clientX - r.left;
      down.grab = (localX >= st.x && localX <= st.x + st.w) ? localX - st.x : st.w / 2;
      if (down.grab === st.w / 2) sX.set(clamp(localX - st.w / 2, minX, maxX), { response: 0.3, damping: 0.85 });
    });
    el.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== down.id) return;
      tracker.push(e.clientX, e.clientY, e.timeStamp);
      if (Math.abs(e.clientX - down.x0) > 4) down.moved = true;
      var localX = e.clientX - down.left;
      var x = localX - down.grab;
      // rubber-band past the ends
      if (x < minX) x = minX + rubber(x - minX, 80, 0.5); else if (x > maxX) x = maxX + rubber(x - maxX, 80, 0.5);
      sX.set(x, { response: 0.16, damping: 1 });
      // live-highlight the item under the pill centre; the pill morphs to that item's width
      var best = nearest(x + st.w / 2);
      if (best !== index) {
        index = best; mark(index);
        var gw = geo(best).w; if (Math.abs(gw - sW.t) > 0.5) { down.grab += (gw - sW.t) / 2; sW.set(gw, { response: 0.28, damping: 0.9 }); maxX = bounds().max - gw; }
      }
    });
    var up = function (e) {
      if (!down || (e && e.pointerId !== down.id)) return;
      var v = tracker.velocity()[0];
      // land on the item under the pill; a real flick can nudge it one item further, never more
      var nudge = down.moved && Math.abs(v) > 350 ? clamp(project(v, 0.985), -st.w * 0.6, st.w * 0.6) : 0;
      var best = nearest(sX.t + sW.t / 2 + nudge);   // sX.t = where the finger left it (the pill itself lags)
      if (!down.moved) best = nearest((e ? e.clientX : down.x0) - down.left);   // plain tap: nearest item, gaps included
      down = null; el.classList.remove('is-pressed');
      sS.set(1, { response: 0.4, damping: 0.7 });
      select(best, { fire: true, velocity: v, response: 0.42, damping: 0.78 });
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    items.forEach(function (it) { it.setAttribute('role', 'tab'); });
    select(index, { immediate: true });
    window.addEventListener('resize', function () { select(index, { immediate: true }); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { select(index, { immediate: true }); });
    el.lgSelect = function (i) { select(i, {}); };
  }

  /* ---------------------------------------------------------------------- */
  /* Toggle: stretchy glass knob, tap or drag                                */
  /* ---------------------------------------------------------------------- */
  function toggle(el) {
    var knob = el.querySelector('.lg-knob');
    var on = el.classList.contains('is-on');
    var W = 27, TRAVEL = 20, STRETCH = 7;
    var st = { x: on ? TRAVEL : 0, w: W };
    var apply = function () { setVar(knob, '--kx', st.x.toFixed(2) + 'px'); setVar(knob, '--kw', st.w.toFixed(2) + 'px'); notify(el, st); };
    var sX = new Spring(st.x, function (v) { st.x = v; apply(); }, 0.32, 0.8);
    var sW = new Spring(W, function (v) { st.w = v; apply(); }, 0.28, 1);
    var set = function (v, fire) {
      on = !!v; el.classList.toggle('is-on', on); el.setAttribute('aria-checked', on);
      sX.set(on ? TRAVEL : 0, { response: 0.32, damping: 0.78 });
      if (fire) el.dispatchEvent(new CustomEvent('lg-change', { detail: on, bubbles: true }));
    };
    el.setAttribute('role', 'switch'); el.tabIndex = 0; el.setAttribute('aria-checked', on);
    var down = null, tracker;
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      down = { id: e.pointerId, x0: e.clientX, moved: false, start: on }; tracker = new Tracker(); tracker.push(e.clientX, 0, e.timeStamp);
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      // knob stretches toward the other side while pressed
      sW.set(W + STRETCH, { response: 0.22 });
      if (on) sX.set(TRAVEL - STRETCH, { response: 0.22, damping: 1 });
    });
    el.addEventListener('pointermove', function (e) {
      if (!down || e.pointerId !== down.id) return;
      tracker.push(e.clientX, 0, e.timeStamp);
      var dx = e.clientX - down.x0;
      if (Math.abs(dx) > 3) down.moved = true;
      var base = down.start ? TRAVEL - STRETCH : 0;
      var x = base + dx, lo = 0, hi = TRAVEL - STRETCH;
      if (x < lo) x = lo + rubber(x - lo, 30, 0.5); else if (x > hi) x = hi + rubber(x - hi, 30, 0.5);
      sX.set(x, { response: 0.14, damping: 1 });
    });
    var up = function (e) {
      if (!down || (e && e.pointerId !== down.id)) return;
      var v = tracker.velocity()[0], next;
      if (!down.moved) next = !on; else next = Math.abs(v) > 120 ? v > 0 : (sX.t + STRETCH / 2) > TRAVEL / 2;
      down = null;
      sW.set(W, { response: 0.32, damping: 0.75 });
      set(next, true);
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set(!on, true); } });
    apply();
    el.lgSet = function (v) { set(v, false); };
  }

  /* ---------------------------------------------------------------------- */
  /* Sliders: 1:1 tracking, thumb grows, rubber-band stretch past the ends   */
  /* ---------------------------------------------------------------------- */
  function slider(el) {
    var vertical = el.classList.contains('lg-tall');
    var capsule = el.classList.contains('lg-capsule');
    var track = el.querySelector('.lg-slider-track') || el;
    var thumb = el.querySelector('.lg-slider-thumb');
    var v = parseFloat(el.dataset.value || 0.5);
    var st = { v: v, ts: 1, sx: 1, sy: 1, over: 0, tx: 0, ty: 0, press: 0 };
    var apply = function () {
      setVar(el, '--v', st.v.toFixed(4));
      if (thumb) { setVar(thumb, '--ts', st.ts.toFixed(4)); setVar(thumb, '--tx', st.tx.toFixed(2) + 'px'); }
      setVar(el, '--lg-sx', st.sx.toFixed(4)); setVar(el, '--lg-sy', st.sy.toFixed(4));
      setVar(el, '--lg-press', st.press.toFixed(3));
      notify(el, st);
    };
    var setV = function (nv, fire) { st.v = clamp(nv, 0, 1); el.dataset.value = st.v.toFixed(4); apply(); if (fire) el.dispatchEvent(new CustomEvent('lg-input', { detail: st.v, bubbles: true })); };
    var sTs = new Spring(1, function (x) { st.ts = x; apply(); }, 0.25, 1);
    var sSx = new Spring(1, function (x) { st.sx = x; apply(); }, 0.25, 1);
    var sSy = new Spring(1, function (x) { st.sy = x; apply(); }, 0.25, 1);
    var sTx = new Spring(0, function (x) { st.tx = x; apply(); }, 0.2, 1);
    var sP  = new Spring(0, function (x) { st.press = x; apply(); }, 0.2, 1);
    var down = null;
    var thumbW = function () { return (thumb && !capsule) ? thumb.offsetWidth : 0; };
    var raw = function (e) { // unclamped 0..1 position along the track
      var r = track.getBoundingClientRect(), t = thumbW();
      if (vertical) return 1 - (e.clientY - r.top - (down ? down.grab : 0)) / r.height;
      return (e.clientX - r.left - t / 2 - (down ? down.grab : 0)) / (r.width - t);
    };
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      down = { id: e.pointerId, grab: 0 };
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      if (thumb && !capsule) { // respect the grab offset when the thumb itself is grabbed
        var tr = thumb.getBoundingClientRect();
        if (e.clientX >= tr.left - 10 && e.clientX <= tr.right + 10) down.grab = e.clientX - (tr.left + tr.width / 2);
      } else if (vertical) {
        // capsule sliders: keep the grab offset too (no jump on touch)
        down.grab = 0; down.rel = raw(e) - st.v;
      } else { down.grab = 0; down.rel = raw(e) - st.v; }
      el.classList.add('is-pressed');
      sTs.set(1.35, { response: 0.22 });
      sP.set(1, { response: 0.16 });
      if (capsule) { sSx.set(vertical ? 1.06 : 1.02, { response: 0.22 }); sSy.set(vertical ? 1.02 : 1.06, { response: 0.22 }); }
      move(e, true);
      e.preventDefault();
    });
    var move = function (e, first) {
      var p = raw(e) - (down.rel || 0);
      // if it was a tap away from the thumb, the value jumps under the finger (thin slider)
      if (first && !capsule && down.rel == null && down.grab === 0) { down.rel = 0; }
      setV(p, true);
      // past the ends: the whole slider stretches like it's elastic
      var over = p < 0 ? p : p > 1 ? p - 1 : 0;
      var len = vertical ? track.offsetHeight : track.offsetWidth;
      var px = rubber(over * len, 50, 0.55);             // px of visual overshoot (soft, capped ~27px)
      var s = 1 + Math.abs(px) / len * 0.4;
      var origin = vertical ? (over < 0 ? '50% 0%' : '50% 100%') : (over < 0 ? '100% 50%' : '0% 50%');
      setVar(el, '--lg-origin', origin);
      if (vertical) sSy.set(capsule ? s * 1.0 : s, { response: 0.14 }); else sSx.set(s, { response: 0.14 });
      if (thumb && !capsule) sTx.set(px * 0.25, { response: 0.14 });
    };
    el.addEventListener('pointermove', function (e) { if (down && e.pointerId === down.id) move(e); });
    var up = function (e) {
      if (!down || (e && e.pointerId !== down.id)) return;
      down = null; el.classList.remove('is-pressed');
      sTs.set(1, { response: 0.4, damping: 0.65 });
      sSx.set(1, { response: 0.42, damping: 0.6 }); sSy.set(1, { response: 0.42, damping: 0.6 });
      sTx.set(0, { response: 0.42, damping: 0.6 });
      sP.set(0, { response: 0.45 });
      el.dispatchEvent(new CustomEvent('lg-change', { detail: st.v, bubbles: true }));
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    apply();
    el.lgSet = function (nv) { setV(nv, false); };
  }

  /* ---------------------------------------------------------------------- */
  function init(root) {
    root = root || document;
    root.querySelectorAll('.lg-slider').forEach(function (el) { if (!el.lgSet) slider(el); });
    root.querySelectorAll('.lg-toggle').forEach(function (el) { if (!el.lgSet) toggle(el); });
    root.querySelectorAll('.lg-tabbar').forEach(function (el) { if (!el.lgSelect) pillGroup(el, '.lg-tab'); });
    root.querySelectorAll('.lg-seg').forEach(function (el) { if (!el.lgSelect) pillGroup(el, '.lg-seg-item'); });
    root.querySelectorAll('.lg-btn, .lg-card[data-press], .lg[data-press]').forEach(function (el) { if (!el._lgState) pressable(el); });
  }
  window.LG = { init: init, Spring: Spring, observe: function (fn) { observers.push(fn); }, afterFrame: function (fn) { afterFrame.push(fn); }, rubber: rubber, project: project };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();
