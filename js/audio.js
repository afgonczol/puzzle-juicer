// Fully synthesized audio: SFX + generative music. No samples, no downloads.
import { store, settings } from './store.js';

const PENT = [0, 2, 4, 7, 9]; // major pentatonic: every note sounds good together
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
/** nth note of a C-major pentatonic ladder starting at C4 (n may exceed 4 to climb octaves). */
const ladder = (n, base = 60) => { n = Math.floor(n); return midiHz(base + PENT[((n % 5) + 5) % 5] + 12 * Math.floor(n / 5)); };
const jit = (f, c = 0.03) => f * (1 + (Math.random() * 2 - 1) * c);

const CHORDS = [
  [60, 64, 67, 71], // Cmaj7
  [57, 60, 64, 67], // Am7
  [53, 57, 60, 64], // Fmaj7
  [55, 59, 62, 67], // G
];
const BASS = [36, 33, 41, 31 + 12];

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.intensity = 0.2;
    this._targetIntensity = 0.2;
    this.bpm = 98;
    this.ducked = false;
  }

  /** Create the graph (must run from a user gesture). */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 18; this.comp.ratio.value = 5;
    this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.musicDuck = ctx.createGain();
    this.music.connect(this.musicDuck).connect(this.master);
    this.sfx.connect(this.master);
    this.master.connect(this.comp).connect(ctx.destination);

    // Reverb: generated impulse response
    const len = Math.floor(ctx.sampleRate * 1.9);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    this.revIn = ctx.createGain();
    this.revOut = ctx.createGain();
    this.revOut.gain.value = 0.55;
    this.revIn.connect(this.reverb).connect(this.revOut).connect(this.master);

    // White noise buffer for percussive stuff
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;

    this.apply();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else this.ctx.resume();
    });
  }

  unlock() {
    this.init();
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume();
  }

  /** Push settings into gain nodes. */
  apply() {
    if (!this.ctx) return;
    const s = settings(), t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    this.sfx.gain.setTargetAtTime(s.sfxOn ? s.sfx : 0, t, 0.05);
    this.music.gain.setTargetAtTime(s.musicOn ? s.music * 0.55 : 0, t, 0.2);
  }

  get ok() { return !!this.ctx && this.ctx.state === 'running' && settings().sfxOn; }

  // --- primitives --------------------------------------------------------
  tone(f, o = {}) {
    if (!this.ctx) return;
    const { type = 'sine', dur = 0.25, vol = 0.25, a = 0.004, when = 0, slide = null, lp = null, hp = null, rev = 0.12, out = this.sfx, q = 0.8 } = o;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q; node.connect(fl); node = fl; }
    if (hp) { const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = hp; node.connect(fl); node = fl; }
    node.connect(g);
    g.connect(out);
    if (rev > 0) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r).connect(this.revIn); }
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(o = {}) {
    if (!this.ctx) return;
    const { dur = 0.1, vol = 0.3, type = 'bandpass', freq = 1000, to = null, q = 1, when = 0, a = 0.002, rev = 0.05, out = this.sfx } = o;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(freq, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g).connect(out);
    if (rev > 0) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r).connect(this.revIn); }
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** Glassy bell: fundamental + inharmonic partials. */
  bell(f, o = {}) {
    const { dur = 0.9, vol = 0.22, when = 0, rev = 0.35 } = o;
    this.tone(f, { type: 'sine', dur, vol, when, rev, a: 0.003 });
    this.tone(f * 2.76, { type: 'sine', dur: dur * 0.55, vol: vol * 0.32, when, rev, a: 0.002 });
    this.tone(f * 5.4, { type: 'sine', dur: dur * 0.25, vol: vol * 0.12, when, rev, a: 0.002 });
  }

  /** Marimba-ish pluck for music. */
  pluck(f, t0, vol = 0.07, out = this.music) {
    const when = Math.max(0, t0 - this.ctx.currentTime);
    this.tone(f, { type: 'triangle', dur: 0.5, vol, when, out, rev: 0.4, a: 0.003 });
    this.tone(f * 4, { type: 'sine', dur: 0.08, vol: vol * 0.5, when, out, rev: 0.2, a: 0.001 });
  }

  // --- sound effects -----------------------------------------------------
  move() {
    if (!this.ok) return;
    this.noise({ dur: 0.06, vol: 0.28, freq: jit(1400, 0.15), q: 1.4 });
    this.tone(jit(210), { dur: 0.1, vol: 0.38, slide: 100, rev: 0.05 });
    this.tone(jit(520), { type: 'triangle', dur: 0.05, vol: 0.07, rev: 0.02 });
  }
  pickup() {
    if (!this.ok) return;
    this.tone(jit(640), { dur: 0.06, vol: 0.1, slide: 900, rev: 0.08 });
  }
  drop() { this.move(); }
  capture(power = 1) {
    if (!this.ok) return;
    const p = Math.min(1.6, 0.7 + power * 0.25);
    this.noise({ dur: 0.2, vol: 0.5 * p, type: 'lowpass', freq: 1400, to: 200, q: 0.7, rev: 0.12 });
    this.noise({ dur: 0.05, vol: 0.35, type: 'highpass', freq: 3500, rev: 0.1 });
    this.tone(jit(130), { dur: 0.3, vol: 0.6 * p, slide: 48, rev: 0.08 });
    // glass shards tinkle
    for (let i = 0; i < 4; i++) this.tone(ladder(Math.floor(Math.random() * 8) + 10), { dur: 0.25 + Math.random() * 0.2, vol: 0.05, when: 0.03 + i * 0.045 + Math.random() * 0.03, rev: 0.5 });
  }
  castle() {
    if (!this.ok) return;
    this.move();
    setTimeout(() => this.move(), 90);
  }
  check() {
    if (!this.ok) return;
    this.bell(midiHz(88), { dur: 0.5, vol: 0.2 });
    this.bell(midiHz(95), { dur: 0.6, vol: 0.16, when: 0.09 });
    this.tone(midiHz(52), { type: 'sawtooth', dur: 0.4, vol: 0.08, lp: 600, slide: midiHz(46) });
  }
  illegal() {
    if (!this.ok) return;
    this.tone(150, { type: 'square', dur: 0.09, vol: 0.09, slide: 110, lp: 700 });
  }
  select() { if (this.ok) this.tone(jit(760), { dur: 0.05, vol: 0.08, rev: 0.1 }); }
  /** Correct move: climbs the pentatonic ladder with the combo. */
  correct(step = 0) {
    if (!this.ok) return;
    const n = 5 + Math.min(step, 16);
    this.bell(ladder(n), { dur: 0.9, vol: 0.2 });
    this.tone(ladder(n - 5), { type: 'triangle', dur: 0.25, vol: 0.1, when: 0.01 });
    if (step >= 4) this.bell(ladder(n + 2), { dur: 0.7, vol: 0.12, when: 0.07 });
    if (step >= 8) this.bell(ladder(n + 4), { dur: 0.7, vol: 0.1, when: 0.14 });
  }
  wrong() {
    if (!this.ok) return;
    this.tone(260, { type: 'sawtooth', dur: 0.42, vol: 0.2, slide: 90, lp: 900, rev: 0.1 });
    this.tone(246, { type: 'square', dur: 0.4, vol: 0.1, slide: 82, lp: 700, rev: 0.1 });
    this.noise({ dur: 0.18, vol: 0.25, type: 'lowpass', freq: 500, to: 120 });
  }
  heartBreak() {
    if (!this.ok) return;
    this.noise({ dur: 0.12, vol: 0.35, type: 'highpass', freq: 4500 });
    this.tone(720, { type: 'triangle', dur: 0.45, vol: 0.2, slide: 160, rev: 0.3 });
    for (let i = 0; i < 5; i++) this.tone(ladder(18 - i * 2), { dur: 0.3, vol: 0.06, when: 0.05 + i * 0.05, rev: 0.5 });
  }
  hint() {
    if (!this.ok) return;
    this.tone(784, { dur: 0.22, vol: 0.12, slide: 1568, rev: 0.4 });
    this.bell(midiHz(91), { dur: 0.6, vol: 0.12, when: 0.1 });
  }
  solved() {
    if (!this.ok) return;
    [0, 2, 4, 7, 9, 11].forEach((n, i) => this.bell(ladder(n + 5), { dur: 1.1, vol: 0.18, when: i * 0.075 }));
    [60, 64, 67, 72].forEach((m) => this.tone(midiHz(m), { type: 'triangle', dur: 1.4, vol: 0.07, when: 0.15, a: 0.03, rev: 0.5, lp: 2200 }));
    this.noise({ dur: 0.7, vol: 0.12, type: 'highpass', freq: 5000, to: 9000, a: 0.1, rev: 0.4 });
  }
  star(i = 0) {
    if (!this.ok) return;
    const f = ladder([9, 11, 14][Math.min(i, 2)] + 5 - 5);
    this.bell(f, { dur: 1, vol: 0.26 });
    this.bell(f * 2, { dur: 0.8, vol: 0.1, when: 0.05 });
    this.noise({ dur: 0.25, vol: 0.1, type: 'highpass', freq: 6000, a: 0.02, rev: 0.4 });
    if (i === 2) [60, 64, 67, 72, 76].forEach((m, k) => this.bell(midiHz(m + 12), { dur: 1.2, vol: 0.12, when: 0.12 + k * 0.05 }));
  }
  mate() {
    if (!this.ok) return;
    this.tone(95, { dur: 1.0, vol: 0.7, slide: 32, rev: 0.2 });
    this.noise({ dur: 0.9, vol: 0.4, type: 'lowpass', freq: 3000, to: 150, rev: 0.3 });
    this.noise({ dur: 0.6, vol: 0.18, type: 'highpass', freq: 2500, to: 9000, a: 0.05, rev: 0.4 });
    [0, 4, 7, 11, 14].forEach((n, i) => this.bell(ladder(n + 10), { dur: 1.4, vol: 0.14, when: 0.06 + i * 0.06 }));
  }
  combo(n) {
    if (!this.ok) return;
    const notes = Math.min(7, 3 + Math.floor(n / 4));
    for (let i = 0; i < notes; i++) this.tone(ladder(10 + i * 2), { type: 'triangle', dur: 0.18, vol: 0.09, when: i * 0.045, rev: 0.4 });
    this.bell(ladder(10 + notes * 2), { dur: 1, vol: 0.14, when: notes * 0.045 });
  }
  levelUp() {
    if (!this.ok) return;
    this.whoosh(true);
    for (let i = 0; i < 10; i++) this.bell(ladder(i * 1.5 + 5), { dur: 1.2, vol: 0.14, when: i * 0.07 });
    [60, 64, 67, 72, 76].forEach((m) => this.tone(midiHz(m), { type: 'triangle', dur: 1.8, vol: 0.07, when: 0.7, a: 0.05, rev: 0.5, lp: 2000 }));
    this.bell(midiHz(96), { dur: 2, vol: 0.2, when: 0.75 });
  }
  achievement() {
    if (!this.ok) return;
    [67, 72, 76, 79, 84].forEach((m, i) => this.bell(midiHz(m), { dur: 1, vol: 0.15, when: i * 0.08 }));
    this.noise({ dur: 0.4, vol: 0.1, type: 'highpass', freq: 6000, when: 0.3, rev: 0.4 });
  }
  pop() { if (this.ok) this.tone(jit(480), { dur: 0.09, vol: 0.16, slide: 980, rev: 0.15 }); }
  click() {
    if (!this.ok) return;
    this.tone(jit(880), { dur: 0.04, vol: 0.1, slide: 520, rev: 0.05 });
    this.tone(160, { dur: 0.05, vol: 0.12, slide: 90, rev: 0 });
  }
  hover() { if (this.ok) this.tone(jit(1500), { dur: 0.03, vol: 0.035, rev: 0.1 }); }
  whoosh(up = true) {
    if (!this.ok) return;
    this.noise({ dur: 0.38, vol: 0.2, type: 'bandpass', freq: up ? 300 : 3000, to: up ? 3500 : 250, q: 0.9, a: 0.06, rev: 0.25 });
  }
  tick(urgent = false) {
    if (!this.ok) return;
    urgent
      ? this.tone(1320, { type: 'square', dur: 0.07, vol: 0.07, lp: 3000, rev: 0.1 })
      : this.tone(990, { dur: 0.05, vol: 0.08, rev: 0.1 });
  }
  timeBonus() {
    if (!this.ok) return;
    [0, 2, 4, 7].forEach((n, i) => this.tone(ladder(n + 10), { type: 'square', dur: 0.12, vol: 0.06, when: i * 0.05, lp: 3200, rev: 0.3 }));
  }
  timePenalty() {
    if (!this.ok) return;
    this.tone(330, { type: 'sawtooth', dur: 0.4, vol: 0.14, slide: 110, lp: 800 });
    this.tone(247, { type: 'sawtooth', dur: 0.4, vol: 0.1, slide: 82, lp: 700, when: 0.08 });
  }
  gameOver() {
    if (!this.ok) return;
    [72, 68, 65, 60].forEach((m, i) => this.tone(midiHz(m), { type: 'triangle', dur: 0.6, vol: 0.14, when: i * 0.16, rev: 0.5, lp: 1800 }));
    this.tone(70, { dur: 0.9, vol: 0.3, slide: 35, when: 0.55 });
  }
  coin() {
    if (!this.ok) return;
    this.tone(988, { type: 'square', dur: 0.07, vol: 0.05, lp: 3500 });
    this.tone(1319, { type: 'square', dur: 0.22, vol: 0.05, when: 0.06, lp: 3500 });
  }
  promote() {
    if (!this.ok) return;
    for (let i = 0; i < 8; i++) this.tone(ladder(8 + i * 1.5), { type: 'triangle', dur: 0.18, vol: 0.1, when: i * 0.04, rev: 0.4 });
    this.bell(midiHz(96), { dur: 1.2, vol: 0.18, when: 0.34 });
  }

  // --- generative music --------------------------------------------------
  startMusic() {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.15;
    this._timer = setInterval(() => this._sched(), 40);
  }
  stopMusic() {
    this.playing = false;
    clearInterval(this._timer);
  }
  setIntensity(x) { this._targetIntensity = Math.max(0, Math.min(1, x)); }
  duck(on) {
    if (!this.ctx) return;
    this.ducked = on;
    this.musicDuck.gain.setTargetAtTime(on ? 0.35 : 1, this.ctx.currentTime, 0.15);
  }

  _sched() {
    if (!this.ctx || !this.playing) return;
    this.intensity += (this._targetIntensity - this.intensity) * 0.05;
    const spb = 60 / this.bpm / 4; // seconds per 16th
    while (this.nextT < this.ctx.currentTime + 0.2) {
      this._step(this.step, this.nextT);
      this.nextT += spb * (this.step % 2 ? 1.06 : 0.94); // gentle swing
      this.step++;
    }
  }

  _step(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16;
    const chord = CHORDS[bar];
    const when = Math.max(0, t - this.ctx.currentTime);
    const inten = this.intensity;
    if (s === 0) {
      chord.forEach((m) => this.tone(midiHz(m - 12), { type: 'triangle', dur: 3.2, vol: 0.045, a: 0.5, when, out: this.music, rev: 0.6, lp: 900 }));
    }
    if (s === 0 || s === 10) this.tone(midiHz(BASS[bar]), { dur: 0.7, vol: 0.14, when, out: this.music, rev: 0.1, lp: 400 });
    if (s % 2 === 0 && Math.random() < 0.5 + inten * 0.35) {
      const pool = Math.random() < 0.65 ? chord.map((m) => m + 12) : PENT.map((p) => 72 + p);
      const m = pool[Math.floor(Math.random() * pool.length)] + (Math.random() < 0.25 ? 12 : 0);
      this.pluck(midiHz(m), t, 0.045 + inten * 0.03);
    }
    if (inten > 0.45) {
      if (s % 4 === 0) this.tone(120, { dur: 0.18, vol: 0.2 * inten, slide: 45, when, out: this.music, rev: 0 });
      if (s % 4 === 2) this.noise({ dur: 0.05, vol: 0.05 * inten, type: 'highpass', freq: 7000, when, out: this.music, rev: 0.05 });
    }
    if (inten > 0.75 && s % 2 === 1) this.noise({ dur: 0.03, vol: 0.03, type: 'highpass', freq: 9000, when, out: this.music, rev: 0.05 });
  }
}

// Audio must never take the game down: wrap every method.
for (const name of Object.getOwnPropertyNames(AudioEngine.prototype)) {
  const fn = AudioEngine.prototype[name];
  if (name === 'constructor' || typeof fn !== 'function') continue;
  AudioEngine.prototype[name] = function (...a) { try { return fn.apply(this, a); } catch (e) { console.warn('audio.' + name, e); } };
}
export const audio = new AudioEngine();

// Unlock on first gesture (browser autoplay policy).
const unlockEvents = ['pointerdown', 'keydown', 'touchstart'];
const unlock = () => {
  audio.unlock();
  if (settings().musicOn) audio.startMusic();
  unlockEvents.forEach((e) => window.removeEventListener(e, unlock, true));
};
unlockEvents.forEach((e) => window.addEventListener(e, unlock, true));
store.on('change', () => audio.apply());
