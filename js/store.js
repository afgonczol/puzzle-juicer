// Persistent player state (localStorage), progression math, cosmetics unlock table.
import { Emitter, todayKey, yesterdayKey, prefersReducedMotion } from './util.js';

const KEY = 'puzzle-juicer.v1';

export const BOARDS = [
  { id: 'candy',    name: 'Candy Floss', level: 1,  l: '#ffeaf5', d: '#ff9ccd', glow: '#ff4fa3' },
  { id: 'mint',     name: 'Mint Fizz',   level: 2,  l: '#e8fff5', d: '#5fd9ab', glow: '#2fe3a0' },
  { id: 'ocean',    name: 'Blue Raspberry', level: 3, l: '#e0f6ff', d: '#4aa8e8', glow: '#3cc8ff' },
  { id: 'grape',    name: 'Grape Soda',  level: 4,  l: '#f0e5ff', d: '#8d63e6', glow: '#9b6bff' },
  { id: 'sunset',   name: 'Tangerine',   level: 6,  l: '#ffedcc', d: '#ff8f5a', glow: '#ffa62b' },
  { id: 'wood',     name: 'Toffee',      level: 8,  l: '#f0d9b5', d: '#b58863', glow: '#ffc36b' },
  { id: 'midnight', name: 'Midnight',    level: 10, l: '#52639a', d: '#27345e', glow: '#7aa2ff' },
  { id: 'neon',     name: 'Neon Arcade', level: 14, l: '#241a54', d: '#0e0a2b', glow: '#19f3ff' },
];

export const PIECE_SETS = [
  { id: 'gummy',   name: 'Gummy Bears',   level: 1 },
  { id: 'classic', name: 'Classic',       level: 1 },
  { id: 'minty',   name: 'Mint & Berry',  level: 5 },
  { id: 'gold',    name: 'Gold & Onyx',   level: 7 },
  { id: 'icefire', name: 'Ice & Fire',    level: 11 },
  { id: 'neon',    name: 'Neon Ghosts',   level: 13 },
];

const DEFAULTS = () => ({
  v: 1,
  created: Date.now(),
  xp: 0,
  rating: 1000,
  ratingGames: 0,
  peakRating: 1000,
  streak: { days: 0, last: null, best: 0 },
  best: { rush: 0, rushSolved: 0, survival: 0, combo: 0, rushCombo: 0 },
  adventure: { stars: {}, current: 1 },
  totals: { solved: 0, failed: 0, moves: 0, perfect: 0, clean: 0, bestClean: 0, timeMs: 0, fastest: null, hints: 0, captures: 0, mates: 0 },
  perTheme: {},
  missed: [],
  seen: [],
  daily: { done: {}, streak: 0, last: null },
  achievements: {},
  history: [],
  seenIntro: false,
  settings: {
    master: 0.8, sfx: 1, music: 0.55, musicOn: true, sfxOn: true,
    fx: 3, shake: true, haptics: true, reduceMotion: prefersReducedMotion(),
    idleNudge: true, coords: true, legal: true, autoNext: false,
    board: 'candy', pieces: 'gummy', online: true,
  },
});

function deepMerge(base, over) {
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base[k] && typeof base[k] === 'object') deepMerge(base[k], over[k]);
    else base[k] = over[k];
  }
  return base;
}

/** Level/progress for a raw xp total. */
export function xpState(xp) {
  let l = 1, x = xp;
  while (x >= 80 + 45 * (l - 1)) { x -= 80 + 45 * (l - 1); l++; }
  const need = 80 + 45 * (l - 1);
  return { level: l, into: x, need, pct: x / need };
}

class Store extends Emitter {
  constructor() {
    super();
    this.s = DEFAULTS();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) deepMerge(this.s, JSON.parse(raw));
    } catch { /* corrupted or blocked; start fresh */ }
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch { /* quota/private mode */ }
    this.emit('change', this.s);
  }
  reset() { this.s = DEFAULTS(); this.save(); }
  exportJSON() { return JSON.stringify(this.s); }
  importJSON(txt) {
    const obj = JSON.parse(txt);
    if (!obj || obj.v !== 1) throw new Error('Not a Puzzle Juicer save');
    this.s = deepMerge(DEFAULTS(), obj);
    this.save();
  }

  // --- progression -------------------------------------------------------
  /** XP needed to climb from `level` to `level + 1`. */
  static need(level) { return 80 + 45 * (level - 1); }
  static cumulative(level) { let t = 0; for (let l = 1; l < level; l++) t += Store.need(l); return t; }
  get level() { let l = 1, x = this.s.xp; while (x >= Store.need(l)) { x -= Store.need(l); l++; } return l; }
  get levelProgress() {
    let l = 1, x = this.s.xp;
    while (x >= Store.need(l)) { x -= Store.need(l); l++; }
    return { level: l, into: x, need: Store.need(l), pct: x / Store.need(l) };
  }
  /** Adds xp, returns { before, after, leveledUp, unlocked[] } */
  addXP(n) {
    const before = this.level;
    this.s.xp += Math.round(n);
    const after = this.level;
    const unlocked = [];
    if (after > before) {
      for (const b of BOARDS) if (b.level > before && b.level <= after) unlocked.push({ kind: 'board', ...b });
      for (const p of PIECE_SETS) if (p.level > before && p.level <= after) unlocked.push({ kind: 'pieces', ...p });
    }
    this.save();
    return { before, after, leveledUp: after > before, unlocked };
  }
  isUnlocked(item) { return this.level >= item.level; }

  /** Glicko-lite Elo update against a puzzle rating. score: 1 clean, ~0.35 messy solve, 0 fail. */
  updateRating(puzzleRating, score) {
    const r = this.s.rating;
    const exp = 1 / (1 + Math.pow(10, (puzzleRating - r) / 400));
    const k = this.s.ratingGames < 25 ? 44 : this.s.ratingGames < 100 ? 30 : 20;
    const delta = Math.round(k * (score - exp));
    this.s.rating = Math.max(100, r + delta);
    this.s.ratingGames++;
    this.s.peakRating = Math.max(this.s.peakRating, this.s.rating);
    this.s.history.push({ t: Date.now(), r: this.s.rating });
    if (this.s.history.length > 300) this.s.history.splice(0, this.s.history.length - 300);
    return { delta, rating: this.s.rating };
  }

  touchStreak() {
    const st = this.s.streak, t = todayKey();
    if (st.last === t) return { days: st.days, extended: false };
    st.days = st.last === yesterdayKey() ? st.days + 1 : 1;
    st.last = t;
    st.best = Math.max(st.best, st.days);
    return { days: st.days, extended: true };
  }
  /** Streak as the UI should show it: broken streaks read 0 until you play again. */
  get liveStreak() {
    const st = this.s.streak;
    return st.last === todayKey() || st.last === yesterdayKey() ? st.days : 0;
  }

  markSeen(id) {
    this.s.seen.push(id);
    if (this.s.seen.length > 600) this.s.seen.splice(0, this.s.seen.length - 600);
  }
  addMissed(id) { if (!this.s.missed.includes(id)) { this.s.missed.push(id); if (this.s.missed.length > 300) this.s.missed.shift(); } }
  clearMissed(id) { this.s.missed = this.s.missed.filter((m) => m !== id); }

  recordTheme(themes, ok) {
    for (const t of themes) {
      const e = (this.s.perTheme[t] ||= { ok: 0, fail: 0 });
      ok ? e.ok++ : e.fail++;
    }
  }

  stars(levelId) { return this.s.adventure.stars[levelId] || 0; }
  setStars(levelId, n) {
    const prev = this.stars(levelId);
    if (n > prev) this.s.adventure.stars[levelId] = n;
    return n > prev;
  }
  totalStars() { return Object.values(this.s.adventure.stars).reduce((a, b) => a + b, 0); }
  /** highest level the player may start (1-based). */
  get maxUnlockedLevel() {
    let n = 1;
    while (this.s.adventure.stars[n]) n++;
    return n;
  }
}

export const store = new Store();
export const settings = () => store.s.settings;
