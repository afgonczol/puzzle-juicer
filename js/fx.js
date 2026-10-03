// Particle engine + screen-level juice: shake, hit-stop, slow-mo, flashes, floating text.
import { settings } from './store.js';
import { rand, clamp, choice } from './util.js';

const TAU = Math.PI * 2;
export const CANDY = ['#ff4fa3', '#ffa62b', '#ffe14d', '#3ee6a8', '#3cc8ff', '#9b6bff', '#ff5d6c'];
const MAX_PARTICLES = 2200;

class FX {
  constructor() {
    this.parts = [];
    this.trauma = 0;
    this.timeScale = 1;
    this.frozenUntil = 0;
    this.last = 0;
    this.running = false;
    this.flashA = 0;
    this.flashC = '#fff';
    this.glow = new Map();
    this.dpr = 1;
  }

  init(canvas, shakeEl, textLayer) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.shakeEl = shakeEl;
    this.textLayer = textLayer;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
  }

  /** 0 (off) … 3 (juicy!). Reduced-motion forces 0. */
  get lvl() { const s = settings(); return s.reduceMotion ? 0 : s.fx; }
  get mult() { return [0, 0.35, 0.7, 1.15][this.lvl]; }

  // --- sprite cache for soft additive glows --------------------------------
  glowSprite(color) {
    let c = this.glow.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.glow.set(color, c);
    return c;
  }

  _add(p) {
    if (this.parts.length >= MAX_PARTICLES) return;
    p.age = 0;
    this.parts.push(p);
    this._start();
  }

  _start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }

  // --- emitters ------------------------------------------------------------
  /** Radial burst of glowing dots/stars/sparks. */
  burst(x, y, o = {}) {
    if (!this.lvl) return;
    const { n = 18, colors = CANDY, speed = 320, spread = TAU, angle = 0, life = 0.7, size = 6, g = 500, shape = 'glow', drag = 1.8, add = true } = o;
    const count = Math.round(n * this.mult);
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * rand(0.35, 1);
      this._add({
        t: shape, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g, drag,
        life: life * rand(0.7, 1.2), s: size * rand(0.6, 1.3), c: choice(colors), add,
        rot: Math.random() * TAU, vr: rand(-8, 8),
      });
    }
  }

  sparks(x, y, o = {}) {
    this.burst(x, y, { n: 14, speed: 520, life: 0.45, size: 2.4, g: 700, shape: 'spark', drag: 2.4, ...o });
  }

  ring(x, y, o = {}) {
    if (!this.lvl) return;
    const { r0 = 6, r1 = 120, life = 0.5, color = '#fff', w = 6, add = true } = o;
    this._add({ t: 'ring', x, y, r0, r1, life, c: color, s: w, add });
  }

  /** Soft glow flash at a point. */
  pulse(x, y, o = {}) {
    if (!this.lvl) return;
    const { r = 90, life = 0.35, color = '#fff' } = o;
    this._add({ t: 'pulse', x, y, r, life, c: color, add: true });
  }

  /** Confetti cannon. angle in radians (−π/2 = up). */
  confetti(x, y, o = {}) {
    if (!this.lvl) return;
    const { n = 60, angle = -Math.PI / 2, spread = 1.1, power = 900, colors = CANDY } = o;
    const count = Math.round(n * this.mult);
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = power * rand(0.35, 1);
      this._add({
        t: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 900, drag: 1.7,
        life: rand(1.8, 3.2), w: rand(6, 12), hh: rand(8, 16), c: choice(colors),
        rot: Math.random() * TAU, vr: rand(-10, 10), ph: Math.random() * TAU, fl: rand(6, 14),
      });
    }
  }

  cannons(o = {}) {
    this.confetti(0, this.h, { angle: -Math.PI / 2 + 0.55, ...o });
    this.confetti(this.w, this.h, { angle: -Math.PI / 2 - 0.55, ...o });
  }

  rain(n = 70) {
    if (!this.lvl) return;
    const count = Math.round(n * this.mult);
    for (let i = 0; i < count; i++) {
      this._add({
        t: 'conf', x: rand(0, this.w), y: rand(-80, -10), vx: rand(-40, 40), vy: rand(60, 200), g: 120, drag: 0.6,
        life: rand(2.5, 4), w: rand(6, 11), hh: rand(8, 15), c: choice(CANDY),
        rot: Math.random() * TAU, vr: rand(-6, 6), ph: Math.random() * TAU, fl: rand(5, 10),
      });
    }
  }

  fireworks(x, y, colors = CANDY) {
    if (!this.lvl) return;
    const c = choice(colors);
    this.burst(x, y, { n: 46, speed: 420, life: 1.1, size: 7, g: 260, colors: [c, '#fff', choice(colors)], drag: 2.2 });
    this.sparks(x, y, { n: 24, speed: 560, colors: [c, '#fff'], life: 0.8 });
    this.ring(x, y, { r1: 150, life: 0.55, color: c, w: 5 });
    this.pulse(x, y, { r: 160, color: c, life: 0.45 });
  }

  /** Shatter an image (a captured piece) into rotating shards of itself. */
  shatter(img, cx, cy, size, o = {}) {
    if (!this.lvl || !img || !img.complete || !img.naturalWidth) return;
    const { power = 1 } = o;
    const k = Math.min(2, this.dpr);
    const S = Math.round(size * k);
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = S;
    const tg = tmp.getContext('2d', { willReadFrequently: true });
    tg.drawImage(img, 0, 0, S, S);
    const data = tg.getImageData(0, 0, S, S).data;
    const alphaAt = (px, py) => data[((Math.min(S - 1, Math.max(0, Math.round(py))) * S) + Math.min(S - 1, Math.max(0, Math.round(px)))) * 4 + 3];
    const N = this.lvl >= 3 ? 5 : 3;
    const pts = [];
    for (let j = 0; j <= N; j++) {
      pts.push([]);
      for (let i = 0; i <= N; i++) {
        const jx = i === 0 || i === N ? 0 : rand(-0.35, 0.35) * (S / N);
        const jy = j === 0 || j === N ? 0 : rand(-0.35, 0.35) * (S / N);
        pts[j].push([(i / N) * S + jx, (j / N) * S + jy]);
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i + 1], d = pts[j + 1][i];
        const tris = Math.random() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
        for (const tri of tris) {
          const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
          if (alphaAt(mx, my) < 30) continue;
          const minX = Math.min(tri[0][0], tri[1][0], tri[2][0]), maxX = Math.max(tri[0][0], tri[1][0], tri[2][0]);
          const minY = Math.min(tri[0][1], tri[1][1], tri[2][1]), maxY = Math.max(tri[0][1], tri[1][1], tri[2][1]);
          const bw = Math.ceil(maxX - minX) + 2, bh = Math.ceil(maxY - minY) + 2;
          const sc = document.createElement('canvas');
          sc.width = bw; sc.height = bh;
          const sg = sc.getContext('2d');
          sg.beginPath();
          tri.forEach(([x, y], idx) => (idx ? sg.lineTo(x - minX + 1, y - minY + 1) : sg.moveTo(x - minX + 1, y - minY + 1)));
          sg.closePath();
          sg.clip();
          sg.drawImage(tmp, -minX + 1, -minY + 1);
          const dx = (mx - S / 2) / S, dy = (my - S / 2) / S;
          const dist = Math.hypot(dx, dy) || 0.1;
          const sp = rand(260, 560) * power;
          this._add({
            t: 'shard', bmp: sc, bw: bw / k, bh: bh / k,
            x: cx + dx * size, y: cy + dy * size,
            vx: (dx / dist) * sp + rand(-90, 90), vy: (dy / dist) * sp - rand(160, 380) * power,
            g: 1500, drag: 0.9, life: rand(0.8, 1.3), rot: 0, vr: rand(-12, 12),
          });
        }
      }
    }
  }

  trail(x, y, color) {
    if (this.lvl < 2) return;
    this._add({ t: 'glow', x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-20, 20), vy: rand(-30, 10), g: 60, drag: 2, life: rand(0.3, 0.5), s: rand(3, 6), c: color, add: true, rot: 0, vr: 0 });
  }

  // --- screen-level juice ----------------------------------------------------
  shake(amount = 0.5) {
    if (!settings().shake || settings().reduceMotion) return;
    this.trauma = clamp(this.trauma + amount, 0, 1);
    this._start();
  }

  /** Freeze particles + CSS/WAAPI animations for a few ms (impact "weight"). */
  hitstop(ms = 60) {
    if (!this.lvl) return;
    const anims = document.getAnimations().filter((a) => a.playState === 'running');
    anims.forEach((a) => a.pause());
    this.frozenUntil = performance.now() + ms;
    setTimeout(() => anims.forEach((a) => { try { a.play(); } catch { /* finished */ } }), ms);
  }

  slowmo(rate = 0.3, ms = 600) {
    if (!this.lvl) return;
    const anims = document.getAnimations().filter((a) => a.playState === 'running');
    anims.forEach((a) => a.updatePlaybackRate(rate));
    this.timeScale = rate;
    setTimeout(() => { this.timeScale = 1; anims.forEach((a) => { try { a.updatePlaybackRate(1); } catch { /* gone */ } }); }, ms);
  }

  flash(color = '#fff', a = 0.5) {
    if (!this.lvl) return;
    this.flashC = color;
    this.flashA = Math.max(this.flashA, a * (this.lvl / 3));
    this._start();
  }

  vignette(color = '#ff2d55', ms = 650) {
    const v = document.getElementById('vignette');
    if (!v || !this.lvl) return;
    v.style.setProperty('--vc', color);
    v.animate([{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' });
  }

  popText(x, y, text, o = {}) {
    const { color = '#fff', size = 26, dur = 1000, dy = -70, cls = '' } = o;
    const e = document.createElement('div');
    e.className = 'pop-text ' + cls;
    e.textContent = text;
    e.style.left = x + 'px';
    e.style.top = y + 'px';
    e.style.fontSize = size + 'px';
    e.style.color = color;
    this.textLayer.appendChild(e);
    const a = e.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.3)', opacity: 0 },
        { transform: 'translate(-50%,-60%) scale(1.25)', opacity: 1, offset: 0.18 },
        { transform: 'translate(-50%,-62%) scale(1)', opacity: 1, offset: 0.35 },
        { transform: `translate(-50%,calc(-50% + ${dy}px)) scale(.95)`, opacity: 0 },
      ],
      { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)' }
    );
    a.onfinish = () => e.remove();
  }

  /** Giant centered word ("SWEET!"). */
  bigWord(text, o = {}) {
    const { color = '#ffe14d', dur = 1250, size = 'clamp(44px, 12vw, 120px)', tilt = -5 } = o;
    const e = document.createElement('div');
    e.className = 'big-word';
    e.textContent = text;
    e.style.color = color;
    e.style.fontSize = size;
    this.textLayer.appendChild(e);
    const a = e.animate(
      [
        { transform: `translate(-50%,-50%) scale(.1) rotate(${tilt * 3}deg)`, opacity: 0 },
        { transform: `translate(-50%,-50%) scale(1.25) rotate(${tilt}deg)`, opacity: 1, offset: 0.22 },
        { transform: `translate(-50%,-50%) scale(1) rotate(${tilt}deg)`, opacity: 1, offset: 0.34 },
        { transform: `translate(-50%,-50%) scale(1.04) rotate(${tilt}deg)`, opacity: 1, offset: 0.78 },
        { transform: `translate(-50%,-80%) scale(1.2) rotate(${tilt}deg)`, opacity: 0 },
      ],
      { duration: dur, easing: 'cubic-bezier(.2,.9,.3,1)' }
    );
    a.onfinish = () => e.remove();
  }

  // --- main loop -------------------------------------------------------------
  _frame(now) {
    const ctx = this.ctx;
    let dt = Math.min(0.05, (now - this.last) / 1000);
    const rawDt = dt;
    this.last = now;
    const frozen = now < this.frozenUntil;
    if (frozen) dt = 0;
    dt *= this.timeScale;
    const dpr = this.dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const keep = [];
    for (const p of this.parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const k = p.age / p.life, a = 1 - k;
      if (p.vx !== undefined) {
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp; p.vy = p.vy * damp + p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += (p.vr || 0) * dt;
      }
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      switch (p.t) {
        case 'glow': {
          ctx.globalAlpha = Math.min(1, a * 1.6);
          const s = p.s * (0.4 + a * 0.9) * 2.4;
          ctx.drawImage(this.glowSprite(p.c), p.x - s, p.y - s, s * 2, s * 2);
          break;
        }
        case 'dot': {
          ctx.globalAlpha = a;
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.3 + a * 0.7), 0, TAU); ctx.fill();
          break;
        }
        case 'star': {
          ctx.globalAlpha = Math.min(1, a * 1.8);
          ctx.fillStyle = p.c;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          const R = p.s * (0.5 + a * 0.8) * 1.8, r = R * 0.45;
          ctx.beginPath();
          for (let i = 0; i < 10; i++) { const rr = i % 2 ? r : R, ang = (i / 10) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
          ctx.closePath(); ctx.fill(); ctx.restore();
          break;
        }
        case 'spark': {
          ctx.globalAlpha = a;
          ctx.strokeStyle = p.c;
          ctx.lineWidth = p.s * (0.4 + a);
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045); ctx.stroke();
          break;
        }
        case 'conf': {
          ctx.globalAlpha = Math.min(1, a * 2.5);
          ctx.fillStyle = p.c;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.age * p.fl + p.ph));
          ctx.fillRect(-p.w / 2, -p.hh / 2, p.w, p.hh);
          ctx.restore();
          break;
        }
        case 'ring': {
          const e = 1 - Math.pow(1 - k, 3);
          ctx.globalAlpha = a * 0.9;
          ctx.strokeStyle = p.c;
          ctx.lineWidth = Math.max(0.5, p.s * a);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * e, 0, TAU); ctx.stroke();
          break;
        }
        case 'pulse': {
          ctx.globalAlpha = a * 0.5;
          const s = p.r * (0.5 + k * 0.8);
          ctx.drawImage(this.glowSprite(p.c), p.x - s, p.y - s, s * 2, s * 2);
          break;
        }
        case 'shard': {
          ctx.globalAlpha = Math.min(1, a * 2.2);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.drawImage(p.bmp, -p.bw / 2, -p.bh / 2, p.bw, p.bh);
          ctx.restore();
          break;
        }
      }
      keep.push(p);
    }
    this.parts = keep;

    // full-screen flash
    if (this.flashA > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashC;
      ctx.fillRect(0, 0, this.w, this.h);
      this.flashA *= Math.exp(-9 * rawDt);
    } else this.flashA = 0;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // screen shake (trauma model)
    if (this.trauma > 0.002 && this.shakeEl) {
      this.trauma = Math.max(0, this.trauma - dt * 1.7);
      const t = now / 1000, m = this.trauma * this.trauma;
      const dx = (Math.sin(t * 61) + Math.sin(t * 97 + 1.3)) * 0.5 * 16 * m;
      const dy = (Math.sin(t * 73 + 2) + Math.sin(t * 111 + 0.4)) * 0.5 * 16 * m;
      const r = Math.sin(t * 53 + 0.7) * 1.6 * m;
      this.shakeEl.style.transform = `translate(${dx.toFixed(2)}px,${dy.toFixed(2)}px) rotate(${r.toFixed(3)}deg)`;
    } else if (this.shakeEl && this.shakeEl.style.transform) {
      this.shakeEl.style.transform = '';
      this.trauma = 0;
    }

    if (this.parts.length || this.flashA > 0 || this.trauma > 0) requestAnimationFrame((t) => this._frame(t));
    else { this.running = false; ctx.clearRect(0, 0, this.w, this.h); }
  }
}

export const fx = new FX();
