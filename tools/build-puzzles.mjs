#!/usr/bin/env node
// Builds data/puzzles.json from the Lichess puzzle database (CC0).
//
//   curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
//   zstd -d lichess_db_puzzle.csv.zst            (or stream a prefix of it)
//   node tools/build-puzzles.mjs lichess_db_puzzle.csv [out.json]
//
// The sampler is deterministic (seeded) and stratified: for every popular tactical
// theme it keeps a few of the best-liked puzzles per 100-point rating bin, so the
// game always has something good to serve at any (theme, rating) combo.
import fs from 'node:fs';
import readline from 'node:readline';

const src = process.argv[2];
const out = process.argv[3] || new URL('../data/puzzles.json', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
if (!src) { console.error('usage: build-puzzles.mjs <lichess_db_puzzle.csv> [out.json]'); process.exit(1); }

const MIN_POP = 88, MIN_PLAYS = 250, MAX_RD = 105;
const QUOTA_MULT = 2.6; // bump for a bigger bundle
const BIN = 100, MIN_R = 400, MAX_R = 3000;

// theme -> puzzles to keep per rating bin
const QUOTA = {
  mateIn1: 14, mateIn2: 14, mateIn3: 10, mateIn4: 6, mateIn5: 4,
  fork: 10, pin: 10, skewer: 8, discoveredAttack: 9, hangingPiece: 9,
  sacrifice: 9, deflection: 8, attraction: 7, backRankMate: 8, smotheredMate: 5,
  trappedPiece: 7, capturingDefender: 6, clearance: 5, interference: 4, intermezzo: 5,
  quietMove: 6, xRayAttack: 5, zugzwang: 4, defensiveMove: 6, promotion: 6, underPromotion: 3,
  enPassant: 3, doubleCheck: 4, exposedKing: 6, advancedPawn: 6, castling: 2,
  anastasiaMate: 3, arabianMate: 3, bodenMate: 3, dovetailMate: 3, hookMate: 3, doubleBishopMate: 3,
  pawnEndgame: 6, rookEndgame: 6, bishopEndgame: 4, knightEndgame: 4, queenEndgame: 4, queenRookEndgame: 3,
  opening: 5, middlegame: 4, endgame: 5, crushing: 3, advantage: 3, equality: 4, veryLong: 4, oneMove: 4,
  __any: 14,
};

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(20261002);

const buckets = new Map(); // `${theme}|${bin}` -> [{score, row}]
let total = 0, kept = 0;
const rl = readline.createInterface({ input: fs.createReadStream(src), crlfDelay: Infinity });
let header = true;
for await (const line of rl) {
  if (header) { header = false; continue; }
  const c = line.split(',');
  if (c.length < 9) continue;
  total++;
  const [id, fen, moves, rating, rd, pop, plays, themes, gameUrl, opening] = c;
  const r = +rating, p = +pop, n = +plays;
  if (p < MIN_POP || n < MIN_PLAYS || +rd > MAX_RD || r < MIN_R || r >= MAX_R) continue;
  const bin = Math.floor((r - MIN_R) / BIN);
  // popularity matters most; log(plays) breaks ties; random jitter keeps variety
  const score = p + Math.log10(n) * 2 + rand() * 6;
  const row = { id, fen, moves, r, themes: themes.split(' '), gameUrl, opening };
  const keys = [...row.themes, '__any'];
  for (const t of keys) {
    const q = QUOTA[t] && Math.ceil(QUOTA[t] * QUOTA_MULT);
    if (!q) continue;
    const key = t + '|' + bin;
    let arr = buckets.get(key);
    if (!arr) buckets.set(key, arr = []);
    if (arr.length < q) arr.push({ score, row });
    else {
      let mi = 0;
      for (let i = 1; i < arr.length; i++) if (arr[i].score < arr[mi].score) mi = i;
      if (score > arr[mi].score) arr[mi] = { score, row };
    }
  }
}

const picked = new Map();
for (const arr of buckets.values()) for (const { row } of arr) picked.set(row.id, row);
kept = picked.size;

const rows = [...picked.values()].sort((a, b) => a.r - b.r || (a.id < b.id ? -1 : 1));
const themeList = [...new Set(rows.flatMap(r => r.themes))].sort();
const themeIdx = Object.fromEntries(themeList.map((t, i) => [t, i]));
const openings = [];
const openIdx = new Map();
const oi = (o) => {
  if (!o) return -1;
  const name = o.split(' ')[0].replace(/_/g, ' ');
  if (!openIdx.has(name)) { openIdx.set(name, openings.length); openings.push(name); }
  return openIdx.get(name);
};

const data = {
  v: 1,
  src: 'https://database.lichess.org/#puzzles (CC0)',
  themes: themeList,
  openings,
  // [id, fen(4 fields), uci moves, rating, [theme idx], game "id/color#ply", opening idx]
  p: rows.map(r => [
    r.id,
    r.fen.split(' ').slice(0, 4).join(' '),
    r.moves,
    r.r,
    r.themes.map(t => themeIdx[t]),
    r.gameUrl.replace('https://lichess.org/', ''),
    oi(r.opening),
  ]),
};
fs.writeFileSync(out, JSON.stringify(data));
const hist = {};
for (const r of rows) hist[Math.floor(r.r / 200) * 200] = (hist[Math.floor(r.r / 200) * 200] || 0) + 1;
console.log(`scanned ${total.toLocaleString()} puzzles, kept ${kept.toLocaleString()} -> ${out}`);
console.log('size', (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
console.log('by rating', hist);
const tc = {};
for (const r of rows) for (const t of r.themes) tc[t] = (tc[t] || 0) + 1;
console.log('themes', Object.entries(tc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
