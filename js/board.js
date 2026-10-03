// The chess board: rendering, drag & click input, and all the move animation juice.
import { audio } from './audio.js';
import { fx, CANDY } from './fx.js';
import { COLORWAYS, pieceImage, currentSet } from './pieces.js';
import { settings } from './store.js';
import { clamp, sleep, vibrate, rand } from './util.js';

const FILES = 'abcdefgh';
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const ROOK_MOVES = {
  e1g1: ['h1', 'f1'], e1c1: ['a1', 'd1'], e8g8: ['h8', 'f8'], e8c8: ['a8', 'd8'],
};

const sqFile = (sq) => FILES.indexOf(sq[0]);
const sqRank = (sq) => +sq[1] - 1;
const sqName = (f, r) => FILES[f] + (r + 1);

export class Board {
  constructor(root) {
    this.root = root;
    this.orient = 'white';
    this.pieces = new Map();
    this.input = null;
    this.sel = null;
    this.drag = null;
    this.busy = 0;
    this._build();
    this._bind();
  }

  _build() {
    this.root.innerHTML = `
      <div class="board">
        <div class="b-squares"></div>
        <div class="b-hl"></div>
        <svg class="b-arrows" viewBox="0 0 8 8" preserveAspectRatio="none"><defs>
          <marker id="ah" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--hint)"/></marker></defs></svg>
        <div class="b-pieces"></div>
        <div class="b-promo"></div>
      </div>`;
    this.el = this.root.querySelector('.board');
    this.sqEl = this.el.querySelector('.b-squares');
    this.hlEl = this.el.querySelector('.b-hl');
    this.arrowEl = this.el.querySelector('.b-arrows');
    this.pcEl = this.el.querySelector('.b-pieces');
    this.promoEl = this.el.querySelector('.b-promo');
    for (let i = 0; i < 64; i++) {
      const d = document.createElement('div');
      const row = Math.floor(i / 8), col = i % 8;
      d.className = 'sq ' + ((row + col) % 2 ? 'dk' : 'lt');
      this.sqEl.appendChild(d);
    }
    this._labels();
  }

  _labels() {
    const white = this.orient === 'white';
    [...this.sqEl.children].forEach((d, i) => {
      const row = Math.floor(i / 8), col = i % 8;
      if (row === 7) d.dataset.file = white ? FILES[col] : FILES[7 - col]; else delete d.dataset.file;
      if (col === 0) d.dataset.rank = white ? 8 - row : row + 1; else delete d.dataset.rank;
    });
  }

  get sqSize() { return this.el.clientWidth / 8; }
  get setId() { return currentSet(); }

  // --- geometry -------------------------------------------------------------
  _cell(sq) {
    const f = sqFile(sq), r = sqRank(sq);
    return this.orient === 'white' ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
  }
  _t(sq, extra = '') {
    const { col, row } = this._cell(sq);
    return `translate(${col * 100}%, ${row * 100}%)${extra}`;
  }
  centerOf(sq) {
    const rect = this.el.getBoundingClientRect(), { col, row } = this._cell(sq), s = rect.width / 8;
    return { x: rect.left + (col + 0.5) * s, y: rect.top + (row + 0.5) * s };
  }
  _sqAt(clientX, clientY) {
    const rect = this.el.getBoundingClientRect(), s = rect.width / 8;
    const col = Math.floor((clientX - rect.left) / s), row = Math.floor((clientY - rect.top) / s);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return this.orient === 'white' ? sqName(col, 7 - row) : sqName(7 - col, row);
  }

  // --- pieces ---------------------------------------------------------------
  _mk(key, sq) {
    const el = document.createElement('div');
    el.className = `piece ${key}`;
    el.innerHTML = '<div class="pi"></div>';
    el.style.transform = this._t(sq);
    this.pcEl.appendChild(el);
    return { key, sq, el, pi: el.firstChild };
  }

  clear() {
    this.pieces.forEach((p) => p.el.remove());
    this.pieces.clear();
    this.clearTargets(); this.clearHints(); this.clearLast(); this.setCheck(null);
    this.sel = null;
  }

  /** boardArray = chess.js board() output. */
  async setPosition(boardArray, { animate = false } = {}) {
    this.clear();
    const jobs = [];
    for (const row of boardArray) for (const c of row) {
      if (!c) continue;
      const p = this._mk(c.color + c.type.toUpperCase(), c.square);
      this.pieces.set(c.square, p);
      if (animate) {
        const { col, row: rr } = this._cell(c.square);
        const delay = (col + rr) * 24 + rand(0, 60);
        p.el.style.opacity = '0';
        const a = p.pi.animate(
          [
            { transform: 'translateY(-60%) scale(.2)', opacity: 0 },
            { transform: 'translateY(6%) scale(1.14,.88)', opacity: 1, offset: 0.62 },
            { transform: 'translateY(0) scale(1)', opacity: 1 },
          ],
          { duration: 460, delay, easing: 'cubic-bezier(.3,.9,.4,1)', fill: 'backwards' }
        );
        p.el.style.opacity = '1';
        jobs.push(a.finished.catch(() => {}));
      }
    }
    if (animate) { audio.whoosh(true); await Promise.all(jobs); }
  }

  /** Pop every piece away (used between puzzles). */
  async sweepOut() {
    const jobs = [];
    let i = 0;
    for (const p of this.pieces.values()) {
      const a = p.pi.animate(
        [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.3 }, { transform: 'scale(0) rotate(30deg)', opacity: 0 }],
        { duration: 260, delay: (i++ % 8) * 14, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' }
      );
      jobs.push(a.finished.catch(() => {}));
    }
    await Promise.all(jobs);
    this.clear();
  }

  pieceAt(sq) { return this.pieces.get(sq); }
  kingSquare(color) {
    for (const [sq, p] of this.pieces) if (p.key === color + 'K') return sq;
    return null;
  }

  async setOrientation(color, animate = true) {
    if (color === this.orient) return;
    this.orient = color;
    this._labels();
    this.clearTargets();
    const jobs = [];
    let i = 0;
    for (const [sq, p] of this.pieces) {
      const to = this._t(sq);
      if (animate) {
        const from = p.el.style.transform;
        p.el.style.transform = to;
        jobs.push(p.el.animate([{ transform: from }, { transform: to }], { duration: 520, delay: (i++ % 8) * 18, easing: 'cubic-bezier(.3,1.25,.4,1)' }).finished.catch(() => {}));
      } else p.el.style.transform = to;
    }
    this._redrawHl();
    if (animate) { audio.whoosh(false); await Promise.all(jobs); }
  }
  flip() { return this.setOrientation(this.orient === 'white' ? 'black' : 'white'); }

  // --- highlights -------------------------------------------------------------
  _hlEl(cls, sq, content = '') {
    const e = document.createElement('div');
    e.className = cls;
    e.dataset.sq = sq;
    const { col, row } = this._cell(sq);
    e.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
    e.innerHTML = content;
    this.hlEl.appendChild(e);
    return e;
  }
  _redrawHl() {
    this.hlEl.querySelectorAll('[data-sq]').forEach((e) => {
      const { col, row } = this._cell(e.dataset.sq);
      e.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
    });
    if (this._arrow) this.showArrow(this._arrow[0], this._arrow[1]);
  }

  setLast(from, to) {
    this.clearLast();
    this._last = [this._hlEl('lm', from), this._hlEl('lm', to)];
  }
  clearLast() { (this._last || []).forEach((e) => e.remove()); this._last = []; }

  setCheck(sq) {
    this._check?.remove();
    this._check = sq ? this._hlEl('chk', sq) : null;
  }

  flashSquare(sq, kind = 'good') {
    const e = this._hlEl('flash ' + kind, sq);
    e.addEventListener('animationend', () => e.remove());
  }

  showTargets(list) {
    this.clearTargets();
    if (!settings().legal) return;
    const sel = this.sel;
    this._selEl = this._hlEl('selsq', sel);
    const [sf, sr] = [sqFile(sel), sqRank(sel)];
    this._tgts = list.filter((t) => !t.alias).map((t) => {
      const e = this._hlEl('tgt' + (t.capture ? ' cap' : ''), t.to, '<i></i>');
      const dist = Math.hypot(sqFile(t.to) - sf, sqRank(t.to) - sr);
      e.style.setProperty('--d', `${Math.round(dist * 28)}ms`);
      return e;
    });
  }
  clearTargets() {
    this._selEl?.remove(); this._selEl = null;
    (this._tgts || []).forEach((e) => e.remove());
    this._tgts = [];
    this._hover?.remove(); this._hover = null;
  }

  // --- hints ---------------------------------------------------------------
  showHint(from, to = null) {
    this.clearHints();
    const p = this.pieces.get(from);
    if (p) p.el.classList.add('hinted');
    this._hintSq = this._hlEl('hintsq', from);
    if (to) this.showArrow(from, to);
  }
  showArrow(from, to) {
    this._arrow = [from, to];
    this.arrowEl.querySelectorAll('line').forEach((l) => l.remove());
    const a = this._cell(from), b = this._cell(to);
    const x1 = a.col + 0.5, y1 = a.row + 0.5;
    let x2 = b.col + 0.5, y2 = b.row + 0.5;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    x2 -= (dx / len) * 0.3; y2 -= (dy / len) * 0.3;
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    l.setAttribute('class', 'arrow-line');
    l.setAttribute('marker-end', 'url(#ah)');
    this.arrowEl.appendChild(l);
  }
  clearHints() {
    this.pcEl.querySelectorAll('.hinted').forEach((e) => e.classList.remove('hinted'));
    this._hintSq?.remove(); this._hintSq = null;
    this.arrowEl.querySelectorAll('line').forEach((l) => l.remove());
    this._arrow = null;
  }

  /** Attention-grabbing wiggle (idle nudge). */
  nudge(sq) {
    const p = this.pieces.get(sq);
    if (!p) return;
    p.pi.animate(
      [
        { transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-12deg) scale(1.15)' }, { transform: 'rotate(10deg) scale(1.2)' },
        { transform: 'rotate(-7deg) scale(1.1)' }, { transform: 'rotate(4deg) scale(1.05)' }, { transform: 'rotate(0) scale(1)' },
      ],
      { duration: 700, easing: 'ease-in-out' }
    );
    const c = this.centerOf(sq);
    fx.burst(c.x, c.y, { n: 8, speed: 120, life: 0.6, size: 4, colors: ['#ffe14d', '#fff'], g: -40, shape: 'star' });
  }

  // --- moves ---------------------------------------------------------------
  /** Animate a chess.js verbose move. Resolves when the piece has landed. */
  async playMove(m, { speed = 1, instant = false, fromDrag = false } = {}) {
    const p = this.pieces.get(m.from);
    if (!p) return;
    this.busy++;
    this.clearHints(); this.clearTargets();
    const isEp = m.flags.includes('e');
    const capSq = isEp ? m.to[0] + m.from[1] : m.to;
    const cap = m.captured ? this.pieces.get(capSq) : null;

    // logical update first
    this.pieces.delete(m.from);
    if (cap) this.pieces.delete(capSq);
    p.sq = m.to;
    this.pieces.set(m.to, p);

    let rookP = null, rookTo = null;
    const rm = ROOK_MOVES[m.from + m.to];
    if (p.key[1] === 'K' && rm && m.flags.match(/[kq]/)) {
      rookP = this.pieces.get(rm[0]);
      rookTo = rm[1];
      if (rookP) { this.pieces.delete(rm[0]); rookP.sq = rookTo; this.pieces.set(rookTo, rookP); }
    }

    this.setLast(m.from, m.to);
    this.setCheck(null);
    const knight = p.key[1] === 'N';
    const dist = Math.hypot(sqFile(m.to) - sqFile(m.from), sqRank(m.to) - sqRank(m.from));
    const dur = instant ? 0 : clamp(150 + dist * 55, 190, 430) / speed;

    p.el.classList.add('moving');
    const slides = [this._slide(p, m.to, dur, { knight, fromDrag })];
    if (rookP) slides.push(this._slide(rookP, rookTo, dur, { knight: false }));
    if (!instant) audio.pickup();
    await Promise.all(slides);
    p.el.classList.remove('moving');

    // ---- landing ----
    const c = this.centerOf(m.to);
    const size = this.sqSize;
    const set = this.setId;
    if (!instant) {
      p.pi.animate(
        [{ transform: 'scale(1.28,.68)' }, { transform: 'scale(.9,1.14)', offset: 0.42 }, { transform: 'scale(1.04,.97)', offset: 0.7 }, { transform: 'scale(1,1)' }],
        { duration: 320, easing: 'ease-out' }
      );
    }
    if (cap) {
      const v = VALUE[m.captured] || 1;
      cap.el.remove();
      if (!instant) {
        fx.shatter(pieceImage(set, cap.key), c.x, c.y, size * 0.95, { power: 0.8 + v * 0.07 });
        const cw = COLORWAYS[set][cap.key[0]];
        fx.burst(c.x, c.y, { n: 12 + v * 2, colors: [cw.mid, cw.top, '#fff'], speed: 380, life: 0.55, size: 5 });
        fx.ring(c.x, c.y, { r1: size * (1.2 + v * 0.12), life: 0.45, color: cw.mid, w: 6 });
        fx.pulse(c.x, c.y, { r: size * 1.2, color: cw.top, life: 0.3 });
        fx.shake(0.16 + v * 0.045);
        fx.hitstop(36 + v * 7);
        audio.capture(v);
        vibrate(12 + v * 3);
        this.flashSquare(m.to, 'cap');
      }
    } else if (!instant) {
      if (rookP) audio.castle(); else audio.move();
      fx.burst(c.x, c.y + size * 0.3, { n: 7, colors: ['#ffffff', '#ffe9f5'], speed: 90, spread: Math.PI * 0.9, angle: -Math.PI / 2, life: 0.4, size: 3.5, g: 160, shape: 'glow', add: false });
    }
    if (m.promotion && !instant) await this._promoteFx(p, m);
    else if (m.promotion) this._setKey(p, m.color + m.promotion.toUpperCase());

    // check / mate
    const san = m.san || '';
    if (san.endsWith('#') || san.endsWith('+')) {
      const king = this.kingSquare(m.color === 'w' ? 'b' : 'w');
      if (king) {
        this.setCheck(king);
        if (!instant) this._checkFx(king, san.endsWith('#'));
      }
    }
    this.busy--;
  }

  _setKey(p, key) {
    p.el.classList.remove(p.key);
    p.key = key;
    p.el.classList.add(key);
  }

  async _promoteFx(p, m) {
    const c = this.centerOf(m.to);
    this._setKey(p, m.color + m.promotion.toUpperCase());
    audio.promote();
    fx.burst(c.x, c.y, { n: 26, speed: 340, life: 0.9, size: 7, shape: 'star', colors: ['#ffe14d', '#fff', '#ffa62b'], g: 120 });
    fx.ring(c.x, c.y, { r1: this.sqSize * 2.2, life: 0.6, color: '#ffe14d', w: 7 });
    fx.shake(0.3);
    await p.pi.animate(
      [{ transform: 'scale(.4) rotate(-40deg)', filter: 'brightness(3)' }, { transform: 'scale(1.5) rotate(8deg)', offset: 0.5, filter: 'brightness(1.6)' }, { transform: 'scale(1)', filter: 'brightness(1)' }],
      { duration: 520, easing: 'cubic-bezier(.3,1.3,.5,1)' }
    ).finished.catch(() => {});
  }

  _checkFx(kingSq, mate) {
    const c = this.centerOf(kingSq), size = this.sqSize;
    const k = this.pieces.get(kingSq);
    if (mate) {
      setTimeout(() => {
        audio.mate();
        fx.shake(0.95);
        fx.flash('#ffffff', 0.7);
        fx.ring(c.x, c.y, { r1: size * 6, life: 0.9, color: '#ffffff', w: 14 });
        fx.ring(c.x, c.y, { r1: size * 4, life: 0.7, color: '#ff4fa3', w: 10 });
        fx.ring(c.x, c.y, { r1: size * 8, life: 1.1, color: '#ffe14d', w: 5 });
        fx.burst(c.x, c.y, { n: 60, speed: 640, life: 1, size: 8, g: 300 });
        fx.sparks(c.x, c.y, { n: 40, speed: 800 });
        fx.slowmo(0.35, 650);
        vibrate([30, 40, 60]);
      }, 30);
      k?.pi.animate(
        [{ transform: 'rotate(0)' }, { transform: 'rotate(-22deg) scale(1.1)' }, { transform: 'rotate(16deg) scale(1.05)' }, { transform: 'rotate(-10deg)' }, { transform: 'rotate(0)' }],
        { duration: 700 }
      );
    } else {
      setTimeout(() => {
        audio.check();
        fx.shake(0.25);
        fx.ring(c.x, c.y, { r1: size * 2.4, life: 0.5, color: '#ff4d6d', w: 8 });
        fx.pulse(c.x, c.y, { r: size * 1.6, color: '#ff4d6d' });
        fx.vignette('#ff2d55', 500);
      }, 60);
      k?.pi.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-9%)' }, { transform: 'translateX(9%)' }, { transform: 'translateX(-6%)' }, { transform: 'translateX(4%)' }, { transform: 'translateX(0)' }],
        { duration: 380 }
      );
    }
  }

  /** Slide a piece element to a square with arc + overshoot. */
  _slide(p, sq, dur, { knight = false, fromDrag = false } = {}) {
    const to = this._t(sq);
    const from = fromDrag && p.el.style.transform ? p.el.style.transform : p.el.style.transform;
    p.el.style.transform = to;
    if (!dur) return Promise.resolve();
    const a = p.el.animate([{ transform: from }, { transform: to }], { duration: dur, easing: 'cubic-bezier(.25,.9,.3,1.08)' });
    p.pi.animate(
      knight
        ? [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-34%) scale(1.3)', offset: 0.5 }, { transform: 'translateY(0) scale(1)' }]
        : [{ transform: 'scale(1)' }, { transform: 'scale(1.2)', offset: 0.45 }, { transform: 'scale(1)' }],
      { duration: dur, easing: 'ease-in-out' }
    );
    return a.finished.catch(() => {});
  }

  /** Return a lifted piece to its square with a springy settle. */
  async _settle(p, wobble = false) {
    const to = this._t(p.sq);
    const from = p.el.style.transform;
    p.el.style.transform = to;
    p.el.classList.remove('dragging');
    p.pi.style.transform = '';
    const a = p.el.animate([{ transform: from }, { transform: to }], { duration: 380, easing: 'cubic-bezier(.25,1.4,.4,1)' });
    if (wobble) p.pi.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(0)' }], { duration: 360 });
    await a.finished.catch(() => {});
  }

  // --- input -----------------------------------------------------------------
  /**
   * cfg: {
   *   canGrab(sq) -> bool,
   *   targets(sq) -> [{to, capture}],
   *   needsPromo(from,to) -> color|null,
   *   attempt(from,to,promo) -> Promise<{status:'ok'|'wrong'|'illegal', move?}>
   * }
   */
  enableInput(cfg) { this.input = cfg; this.el.classList.add('live'); }
  disableInput() {
    this.input = null;
    this.el.classList.remove('live');
    this.clearTargets();
    this.sel = null;
    if (this.drag) { const p = this.drag.p; this.drag = null; this._settle(p); }
  }

  _bind() {
    const el = this.el;
    el.addEventListener('pointerdown', (e) => this._down(e));
    el.addEventListener('pointermove', (e) => this._move(e));
    el.addEventListener('pointerup', (e) => this._up(e));
    el.addEventListener('pointercancel', (e) => this._up(e, true));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _down(e) {
    if (!this.input || this.busy || e.button > 0) return;
    const sq = this._sqAt(e.clientX, e.clientY);
    if (!sq) return;
    // click-to-move onto a legal target
    if (this.sel && this.sel !== sq) {
      const t = this.input.targets(this.sel);
      if (t.some((x) => x.to === sq)) { this._commit(this.sel, sq, null); e.preventDefault(); return; }
    }
    const p = this.pieces.get(sq);
    if (p && this.input.canGrab(sq)) {
      e.preventDefault();
      const rect = this.el.getBoundingClientRect();
      const touch = e.pointerType === 'touch';
      this.sel = sq;
      this.showTargets(this.input.targets(sq));
      audio.pickup();
      vibrate(6);
      const half = rect.width / 16;
      this.drag = {
        p, from: sq, id: e.pointerId, touch, moved: false, startX: e.clientX, startY: e.clientY,
        x: e.clientX - rect.left, y: e.clientY - rect.top, tx: e.clientX - rect.left, ty: e.clientY - rect.top, half, last: performance.now(), wasSel: false,
      };
      this.el.setPointerCapture(e.pointerId);
      p.el.classList.add('dragging');
      p.pi.style.transform = 'scale(1.25)';
      this._dragLoop();
    } else {
      this.sel = null;
      this.clearTargets();
    }
  }

  _move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const rect = this.el.getBoundingClientRect();
    d.tx = e.clientX - rect.left;
    d.ty = e.clientY - rect.top - (d.touch ? d.half * 2.4 : 0);
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) d.moved = true;
    // hover magnet
    const sq = this._sqAt(e.clientX, e.clientY - (d.touch ? d.half * 2.4 : 0) + 0);
    const tgts = this.input ? this.input.targets(d.from) : [];
    const ok = sq && tgts.some((t) => t.to === sq);
    if (ok) {
      if (!this._hover || this._hover.dataset.sq !== sq) { this._hover?.remove(); this._hover = this._hlEl('hoversq', sq); audio.select(); vibrate(3); }
    } else if (this._hover) { this._hover.remove(); this._hover = null; }
    const c = { x: e.clientX, y: e.clientY - (d.touch ? d.half * 2.4 : 0) };
    fx.trail(c.x, c.y, '#ffffff');
  }

  _dragLoop() {
    const d = this.drag;
    if (!d) return;
    const now = performance.now(), dt = Math.min(0.05, (now - d.last) / 1000);
    d.last = now;
    const k = 1 - Math.exp(-dt * 32);
    const vx = (d.tx - d.x);
    d.x += (d.tx - d.x) * k;
    d.y += (d.ty - d.y) * k;
    const tilt = clamp(vx * 0.5, -18, 18);
    d.p.el.style.transform = `translate(${d.x - d.half}px, ${d.y - d.half}px)`;
    d.p.pi.style.transform = `scale(1.25) rotate(${tilt}deg)`;
    requestAnimationFrame(() => this._dragLoop());
  }

  async _up(e, cancelled = false) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    const { p, from } = d;
    try { this.el.releasePointerCapture(d.id); } catch { /* released */ }
    this._hover?.remove(); this._hover = null;
    const sq = cancelled ? null : this._sqAt(e.clientX, e.clientY - (d.touch ? d.half * 2.4 : 0));
    if (!d.moved || sq === from || !sq) {
      // tap (stays selected) or released off-board
      p.pi.style.transform = '';
      if (d.moved && !sq) { this.sel = null; this.clearTargets(); }
      await this._settle(p, false);
      return;
    }
    const tgts = this.input ? this.input.targets(from) : [];
    if (tgts.some((t) => t.to === sq)) {
      await this._commit(from, sq, p, true);
    } else {
      audio.illegal();
      fx.shake(0.1);
      this.sel = null; this.clearTargets();
      p.pi.style.transform = '';
      await this._settle(p, true);
    }
  }

  async _commit(from, to, p = null, fromDrag = false) {
    if (!this.input) return;
    const cfg = this.input;
    let promo = null;
    const pc = cfg.needsPromo(from, to);
    if (pc) {
      promo = await this._askPromo(pc, to);
      if (!promo) { this.sel = null; this.clearTargets(); const pp = this.pieces.get(from); if (pp) { pp.pi.style.transform = ''; await this._settle(pp); } return; }
    }
    const piece = p || this.pieces.get(from);
    this.sel = null;
    this.busy++;
    this.clearTargets();
    piece.pi.style.transform = '';
    piece.el.classList.remove('dragging');
    let res;
    try { res = await cfg.attempt(from, to, promo); } finally { this.busy--; }
    if (res.status === 'ok') {
      await this.playMove(res.move, { fromDrag });
      await cfg.afterMove?.(res);
    } else if (res.status === 'wrong') {
      // glide onto the square, show the "nope", slide back
      await this._slide(piece, to, 150, {});
      piece.sq = from; // logical square unchanged
      this.flashSquare(to, 'bad');
      const c = this.centerOf(to);
      fx.burst(c.x, c.y, { n: 12, colors: ['#ff4d6d', '#ff8fa3', '#fff'], speed: 260, life: 0.5, size: 5 });
      fx.popText(c.x, c.y - 10, '✕', { color: '#ff4d6d', size: 44, dur: 700, dy: -30 });
      await piece.pi.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-14%) rotate(-8deg)' }, { transform: 'translateX(14%) rotate(8deg)' }, { transform: 'translateX(-10%) rotate(-5deg)' }, { transform: 'translateX(6%)' }, { transform: 'translateX(0)' }],
        { duration: 420 }
      ).finished.catch(() => {});
      await this._settle(piece, false);
      await cfg.afterWrong?.(res);
    } else {
      audio.illegal();
      await this._settle(piece, true);
    }
  }

  _askPromo(color, toSq) {
    return new Promise((resolve) => {
      const { col, row } = this._cell(toSq);
      const down = row < 4;
      const order = ['q', 'n', 'r', 'b'];
      const panel = this.promoEl;
      panel.innerHTML = '';
      panel.classList.add('open');
      const shade = document.createElement('div');
      shade.className = 'promo-shade';
      panel.appendChild(shade);
      order.forEach((t, i) => {
        const b = document.createElement('button');
        b.className = `promo-opt piece ${color}${t.toUpperCase()}`;
        b.style.left = `${col * 12.5}%`;
        b.style.top = `${(down ? i : 7 - i) * 12.5}%`;
        b.style.animationDelay = `${i * 50}ms`;
        b.innerHTML = '<div class="pi"></div>';
        b.addEventListener('click', (ev) => { ev.stopPropagation(); audio.pop(); close(t); });
        b.addEventListener('pointerenter', () => audio.hover());
        panel.appendChild(b);
      });
      audio.whoosh(true);
      const close = (v) => { panel.classList.remove('open'); panel.innerHTML = ''; resolve(v); };
      shade.addEventListener('click', () => close(null));
    });
  }
}
