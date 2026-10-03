// Puzzle database: load the bundled Lichess sample, index it, and pick puzzles by theme + rating.
import { Chess } from './vendor/chess.js';
import { mulberry32, hashStr, todayKey } from './util.js';

export const DB = { list: [], byId: new Map(), themes: [], byTheme: new Map(), ready: false };

export async function loadPuzzles() {
  const res = await fetch('data/puzzles.json');
  if (!res.ok) throw new Error('Could not load puzzles');
  const j = await res.json();
  DB.themes = j.themes;
  DB.list = j.p.map(([id, fen, moves, rating, ts, game, op]) => ({
    id,
    fen: fen + ' 0 1',
    moves: moves.split(' '),
    rating,
    themes: ts.map((i) => j.themes[i]),
    game,
    opening: op >= 0 ? j.openings[op] : null,
    source: 'bundle',
  }));
  DB.byId = new Map(DB.list.map((p) => [p.id, p]));
  DB.byTheme = new Map();
  for (const p of DB.list) for (const t of p.themes) {
    if (!DB.byTheme.has(t)) DB.byTheme.set(t, []);
    DB.byTheme.get(t).push(p);
  }
  DB.ready = true;
  return DB;
}

const lowerBound = (arr, r) => {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].rating < r) lo = mid + 1; else hi = mid; }
  return lo;
};

export function poolFor(themes) {
  if (!themes || !themes.length) return DB.list;
  if (themes.length === 1) return DB.byTheme.get(themes[0]) || DB.list;
  const set = new Set(themes);
  return DB.list.filter((p) => p.themes.some((t) => set.has(t)));
}

/**
 * Pick a puzzle near `target` rating. Expands the window until it finds enough candidates.
 * opts: { themes, target, window, exclude:Set, rng, mate:'any' }
 */
export function pickPuzzle({ themes = null, target = 1200, window = 70, exclude = new Set(), rng = Math.random } = {}) {
  const pool = poolFor(themes);
  if (!pool.length) return null;
  let w = window;
  for (let i = 0; i < 12; i++) {
    const a = lowerBound(pool, target - w), b = lowerBound(pool, target + w + 1);
    const cands = [];
    for (let k = a; k < b; k++) if (!exclude.has(pool[k].id)) cands.push(pool[k]);
    if (cands.length >= 3 || (i > 6 && cands.length)) return cands[Math.floor(rng() * cands.length)];
    w = Math.ceil(w * 1.6);
  }
  // fall back to nearest overall
  const idx = Math.min(pool.length - 1, lowerBound(pool, target));
  return pool[idx];
}

/** Deterministic pick (adventure levels, daily fallback). */
export function pickSeeded(seedStr, opts) {
  return pickPuzzle({ ...opts, rng: mulberry32(hashStr(seedStr)) });
}

export function localDaily() {
  const key = todayKey();
  const p = pickSeeded('daily-' + key, { target: 1350 + (hashStr(key) % 7) * 80, window: 90 });
  return { ...p, daily: key };
}

// --- Lichess API ---------------------------------------------------------------
function fromApi(j) {
  const pz = j.puzzle;
  const chess = new Chess();
  const toks = (j.game.pgn || '').trim().split(/\s+/).filter(Boolean);
  for (const t of toks) chess.move(t);
  const last = chess.undo();
  const lastUci = last ? last.from + last.to + (last.promotion || '') : null;
  const fen = chess.fen();
  const moves = lastUci ? [lastUci, ...pz.solution] : pz.solution;
  return {
    id: pz.id, fen, moves, rating: pz.rating, themes: pz.themes || [],
    game: j.game.id ? `${j.game.id}` : null, opening: null, source: 'lichess', plays: pz.plays,
  };
}

async function api(path) {
  const res = await fetch('https://lichess.org/api/puzzle/' + path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Lichess says ' + res.status);
  return fromApi(await res.json());
}

export async function fetchDaily() {
  const key = 'pj.daily.' + todayKey();
  try {
    const cached = JSON.parse(localStorage.getItem(key));
    if (cached) return cached;
  } catch { /* none */ }
  const p = await api('daily');
  p.daily = todayKey();
  try { localStorage.setItem(key, JSON.stringify(p)); } catch { /* full */ }
  return p;
}

export async function getPuzzleById(id) {
  if (DB.byId.has(id)) return DB.byId.get(id);
  return api(encodeURIComponent(id));
}
