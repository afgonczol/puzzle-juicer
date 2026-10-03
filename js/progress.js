// Bookkeeping after each puzzle + the achievements list.
import { store } from './store.js';
import { toast } from './ui.js';
import { sleep } from './util.js';
import { TOTAL_LEVELS } from './levels.js';

/** Update totals/per-theme/streak/missed. Returns summary used for XP + UI. */
export function recordPuzzle(res) {
  const s = store.s, t = s.totals;
  const clean = res.solved && res.mistakes === 0;
  const perfect = clean && res.hints === 0;
  if (res.solved) t.solved++; else t.failed++;
  t.moves += res.moves || 0;
  t.captures += res.captures || 0;
  t.hints += res.hints || 0;
  t.timeMs += res.timeMs || 0;
  if (res.mate) t.mates++;
  if (perfect) { t.perfect++; t.clean = (t.clean || 0) + 1; t.bestClean = Math.max(t.bestClean || 0, t.clean); } else t.clean = 0;
  if (perfect && res.timeMs > 0 && (t.fastest == null || res.timeMs < t.fastest)) t.fastest = res.timeMs;
  store.recordTheme(res.puzzle.themes.filter((x) => !['short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM'].includes(x)), clean);
  store.markSeen(res.puzzle.id);
  if (!clean) store.addMissed(res.puzzle.id); else if (res.solved) store.clearMissed(res.puzzle.id);
  let streak = null;
  if (res.solved) streak = store.touchStreak();
  store.save();
  return { clean, perfect, streak };
}

/** Standard XP for a finished puzzle. */
export function xpFor(res, { stars = 0, mult = 1 } = {}) {
  if (!res.solved) return Math.round(3 * mult);
  let xp = 10 + Math.round(res.puzzle.rating / 130);
  if (res.mistakes === 0) xp += 5;
  if (res.mistakes === 0 && res.hints === 0) xp += 4;
  xp += stars * 4;
  return Math.round(xp * mult);
}

const T = (s) => s.totals;
const themeOk = (s, k) => (s.perTheme[k]?.ok || 0);

export const ACHIEVEMENTS = [
  { id: 'first', icon: '🍊', name: 'First Squeeze', desc: 'Solve your first puzzle.', xp: 20, test: (s) => T(s).solved >= 1 },
  { id: 's10', icon: '🍋', name: 'Getting Juicy', desc: 'Solve 10 puzzles.', xp: 30, test: (s) => T(s).solved >= 10 },
  { id: 's50', icon: '🍇', name: 'Fruit Basket', desc: 'Solve 50 puzzles.', xp: 60, test: (s) => T(s).solved >= 50 },
  { id: 's150', icon: '🍹', name: 'Juice Bar', desc: 'Solve 150 puzzles.', xp: 100, test: (s) => T(s).solved >= 150 },
  { id: 's500', icon: '🏭', name: 'Juice Factory', desc: 'Solve 500 puzzles.', xp: 250, test: (s) => T(s).solved >= 500 },
  { id: 'clean5', icon: '✨', name: 'Flawless Five', desc: 'Solve 5 puzzles in a row with no mistakes or hints.', xp: 50, test: (s) => (T(s).bestClean || 0) >= 5 },
  { id: 'clean15', icon: '💫', name: 'Flawless Fifteen', desc: 'Solve 15 clean puzzles in a row.', xp: 150, test: (s) => (T(s).bestClean || 0) >= 15 },
  { id: 'combo10', icon: '🔥', name: 'Combo Cadet', desc: 'Reach a 10-move combo.', xp: 40, test: (s) => s.best.combo >= 10 },
  { id: 'combo25', icon: '🌋', name: 'Combo King', desc: 'Reach a 25-move combo.', xp: 100, test: (s) => s.best.combo >= 25 },
  { id: 'combo50', icon: '☄️', name: 'Unstoppable', desc: 'Reach a 50-move combo.', xp: 250, test: (s) => s.best.combo >= 50 },
  { id: 'rush10', icon: '⏱️', name: 'Rush Hour', desc: 'Solve 10 puzzles in one Rush.', xp: 50, test: (s) => s.best.rushSolved >= 10 },
  { id: 'rush20', icon: '⚡', name: 'Lightning Rod', desc: 'Solve 20 puzzles in one Rush.', xp: 120, test: (s) => s.best.rushSolved >= 20 },
  { id: 'rush30', icon: '🌪️', name: 'Storm Chaser', desc: 'Solve 30 puzzles in one Rush.', xp: 250, test: (s) => s.best.rushSolved >= 30 },
  { id: 'surv10', icon: '❤️‍🔥', name: 'Survivor', desc: 'Solve 10 puzzles in Survival.', xp: 80, test: (s) => s.best.survival >= 10 },
  { id: 'surv25', icon: '🛡️', name: 'Unbreakable', desc: 'Solve 25 puzzles in Survival.', xp: 200, test: (s) => s.best.survival >= 25 },
  { id: 'streak3', icon: '📅', name: 'Three-Peat', desc: 'Play 3 days in a row.', xp: 40, test: (s) => s.streak.best >= 3 },
  { id: 'streak7', icon: '🗓️', name: 'Week of Wins', desc: 'Play 7 days in a row.', xp: 120, test: (s) => s.streak.best >= 7 },
  { id: 'streak30', icon: '🏆', name: 'Monthly Master', desc: 'Play 30 days in a row.', xp: 400, test: (s) => s.streak.best >= 30 },
  { id: 'r1200', icon: '📈', name: 'Rising Star', desc: 'Reach a 1200 puzzle rating.', xp: 60, test: (s) => s.peakRating >= 1200 },
  { id: 'r1500', icon: '🚀', name: 'Tactician', desc: 'Reach a 1500 puzzle rating.', xp: 120, test: (s) => s.peakRating >= 1500 },
  { id: 'r1800', icon: '🌟', name: 'Sharp Shooter', desc: 'Reach a 1800 puzzle rating.', xp: 200, test: (s) => s.peakRating >= 1800 },
  { id: 'r2100', icon: '👑', name: 'Puzzle Royalty', desc: 'Reach a 2100 puzzle rating.', xp: 350, test: (s) => s.peakRating >= 2100 },
  { id: 'fast', icon: '💨', name: 'Blink!', desc: 'Solve a puzzle perfectly in under 6 seconds.', xp: 60, test: (s) => T(s).fastest != null && T(s).fastest < 6000 },
  { id: 'mates25', icon: '♚', name: 'Checkmate Collector', desc: 'Deliver checkmate 25 times.', xp: 80, test: (s) => T(s).mates >= 25 },
  { id: 'caps100', icon: '💥', name: 'Piece Crusher', desc: 'Capture 100 pieces in puzzles.', xp: 70, test: (s) => T(s).captures >= 100 },
  { id: 'giant', icon: '🗡️', name: 'Giant Slayer', desc: 'Solve a puzzle rated 2000+ cleanly.', xp: 150, test: (s, c) => !!c.res && c.res.solved && c.res.mistakes === 0 && c.res.puzzle.rating >= 2000 },
  { id: 'fork10', icon: '🍴', name: 'Fork Lord', desc: 'Solve 10 fork puzzles.', xp: 50, test: (s) => themeOk(s, 'fork') >= 10 },
  { id: 'pin10', icon: '📌', name: 'Pin Cushion', desc: 'Solve 10 pin puzzles.', xp: 50, test: (s) => themeOk(s, 'pin') >= 10 },
  { id: 'sac10', icon: '💎', name: 'Gem Thrower', desc: 'Solve 10 sacrifice puzzles.', xp: 70, test: (s) => themeOk(s, 'sacrifice') >= 10 },
  { id: 'mate2_10', icon: '2️⃣', name: 'Two-Step Terminator', desc: 'Solve 10 mate-in-2 puzzles.', xp: 60, test: (s) => themeOk(s, 'mateIn2') >= 10 },
  { id: 'stars15', icon: '⭐', name: 'Star Collector', desc: 'Earn 15 adventure stars.', xp: 40, test: (s) => store.totalStars() >= 15 },
  { id: 'stars60', icon: '🌠', name: 'Constellation', desc: 'Earn 60 adventure stars.', xp: 120, test: (s) => store.totalStars() >= 60 },
  { id: 'stars200', icon: '🌌', name: 'Galaxy Brain', desc: 'Earn 200 adventure stars.', xp: 300, test: (s) => store.totalStars() >= 200 },
  { id: 'world1', icon: '🗺️', name: 'World Traveler', desc: 'Finish the first world.', xp: 80, test: (s) => store.maxUnlockedLevel > 15 },
  { id: 'boss1', icon: '👾', name: 'Boss Squasher', desc: 'Beat your first boss puzzle.', xp: 50, test: (s) => !!s.adventure.stars[5] },
  { id: 'daily1', icon: '☀️', name: 'Daily Dose', desc: 'Complete a Daily Puzzle.', xp: 40, test: (s) => Object.keys(s.daily.done).length >= 1 },
  { id: 'daily7', icon: '🌈', name: 'Daily Devotee', desc: 'Complete 7 Daily Puzzles.', xp: 150, test: (s) => Object.keys(s.daily.done).length >= 7 },
  { id: 'allclear', icon: '🏁', name: 'Map Complete', desc: 'Finish every adventure level.', xp: 1000, test: () => store.maxUnlockedLevel > TOTAL_LEVELS },
];

/** Unlocks anything newly earned; shows toasts; returns unlocked list. */
export async function checkAchievements(ctx = {}) {
  const s = store.s, fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements[a.id]) continue;
    let ok = false;
    try { ok = a.test(s, ctx); } catch { ok = false; }
    if (ok) { s.achievements[a.id] = Date.now(); fresh.push(a); }
  }
  if (!fresh.length) return fresh;
  const xp = fresh.reduce((n, a) => n + a.xp, 0);
  const info = store.addXP(xp);
  (async () => {
    for (const a of fresh) { toast({ icon: a.icon, title: a.name, sub: `${a.desc}  +${a.xp} XP` }); await sleep(900); }
    if (info.leveledUp) toast({ icon: '🎉', title: `Level ${info.after}!`, sub: info.unlocked.map((u) => u.name).join(', ') || 'Keep going!' });
  })();
  store.save();
  return fresh;
}
