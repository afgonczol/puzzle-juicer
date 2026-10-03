// Adventure map: worlds, levels, and deterministic puzzle assignment per level.
import { pickSeeded } from './puzzles.js';

export const LEVELS_PER_WORLD = 15;

// r0→r1 is the rating ramp across the world's levels. Bosses (every 5th) get a boost.
export const WORLDS = [
  { id: 'mate1',   name: 'Mate Meadow',       sub: 'Checkmate in one!',            theme: 'mateIn1',          r: [450, 900],   c: ['#7dffa8', '#1fa65a'], decor: ['🌼', '🌷', '🐝', '🌳', '🦋'], tint: 'rgba(60,230,120,.18)' },
  { id: 'fork',    name: 'Fork Forest',       sub: 'Attack two things at once.',   theme: 'fork',             r: [600, 1100],  c: ['#a9e86b', '#3a8f2a'], decor: ['🌲', '🍄', '🦊', '🌰', '🍴'], tint: 'rgba(120,230,60,.18)' },
  { id: 'pin',     name: 'Pin Peaks',         sub: 'Nothing can move!',            theme: 'pin',              r: [750, 1250],  c: ['#9ee3ff', '#3b78d8'], decor: ['🏔️', '❄️', '⛄', '🧊', '📌'], tint: 'rgba(80,170,255,.2)' },
  { id: 'hang',    name: 'Hanging Hills',     sub: 'Free pieces everywhere.',      theme: 'hangingPiece',     r: [800, 1300],  c: ['#ffd27a', '#e9892a'], decor: ['🎈', '🍯', '🐻', '🌻', '🪁'], tint: 'rgba(255,190,60,.18)' },
  { id: 'mate2',   name: 'Mate-in-2 Mesa',    sub: 'Plan two moves ahead.',        theme: 'mateIn2',          r: [850, 1500],  c: ['#ffab8a', '#d6482f'], decor: ['🌵', '🦎', '🏜️', '🦂', '☀️'], tint: 'rgba(255,100,60,.18)' },
  { id: 'skewer',  name: 'Skewer Sands',      sub: 'Big piece first, then boom.',  theme: 'skewer',           r: [1000, 1550], c: ['#ffe6a1', '#d79d2d'], decor: ['🏝️', '🍢', '🦀', '🌴', '🐚'], tint: 'rgba(255,220,100,.2)' },
  { id: 'disc',    name: 'Discovery Dunes',   sub: 'Reveal the hidden attack.',    theme: 'discoveredAttack', r: [1100, 1650], c: ['#e5a2ff', '#8b3fd1'], decor: ['🔮', '🎭', '🪄', '🦄', '✨'], tint: 'rgba(200,100,255,.2)' },
  { id: 'back',    name: 'Back-Rank Bay',     sub: 'Trapped behind their pawns.',  theme: 'backRankMate',     r: [1100, 1700], c: ['#7de3e8', '#1f8fa8'], decor: ['🌊', '⚓', '🐙', '🐠', '🧱'], tint: 'rgba(40,200,220,.2)' },
  { id: 'sac',     name: 'Sacrifice Springs', sub: 'Give a little, win a lot.',    theme: 'sacrifice',        r: [1250, 1850], c: ['#ff9ac4', '#c92a74'], decor: ['💎', '🌸', '♨️', '🍓', '💝'], tint: 'rgba(255,90,160,.2)' },
  { id: 'deflect', name: 'Deflection Depths', sub: 'Lure the defender away.',      theme: 'deflection',       r: [1400, 2000], c: ['#8f9bff', '#3a3fb8'], decor: ['🐋', '🪸', '🫧', '🦑', '↪️'], tint: 'rgba(90,100,255,.22)' },
  { id: 'end',     name: 'Endgame Isles',     sub: 'Squeeze the last drop.',       theme: 'endgame',          r: [1300, 2000], c: ['#b6f0a0', '#3fa86a'], decor: ['🏝️', '🥥', '🦜', '🐢', '🏁'], tint: 'rgba(120,230,160,.2)' },
  { id: 'mate3',   name: 'Mate-in-3 Mountain', sub: 'Deep calculation time.',      theme: 'mateIn3',          r: [1500, 2200], c: ['#d0a0ff', '#5a2aa8'], decor: ['🌋', '🔥', '🐉', '💀', '👑'], tint: 'rgba(160,60,255,.22)' },
  { id: 'galaxy',  name: 'Grandmaster Galaxy', sub: 'Anything goes. Good luck!',   theme: null,               r: [1800, 2700], c: ['#ff8ae3', '#4b1fa8'], decor: ['🪐', '⭐', '🌙', '🛸', '☄️'], tint: 'rgba(255,100,230,.22)' },
];

export const TOTAL_LEVELS = WORLDS.length * LEVELS_PER_WORLD;

export function levelInfo(n) {
  const wi = Math.floor((n - 1) / LEVELS_PER_WORLD);
  const world = WORLDS[Math.min(wi, WORLDS.length - 1)];
  const i = (n - 1) % LEVELS_PER_WORLD;
  const boss = i % 5 === 4;
  const t = i / (LEVELS_PER_WORLD - 1);
  const target = Math.round(world.r[0] + (world.r[1] - world.r[0]) * t + (boss ? 110 : 0));
  return { n, world, worldIndex: wi, index: i, boss, target };
}

const cache = new Map();
export function levelPuzzle(n) {
  if (cache.has(n)) return cache.get(n);
  const info = levelInfo(n);
  const p = pickSeeded(`level-${n}`, { themes: info.world.theme ? [info.world.theme] : null, target: info.target, window: 55 });
  cache.set(n, p);
  return p;
}
