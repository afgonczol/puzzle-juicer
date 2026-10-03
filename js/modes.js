// Game modes. Each is a plain object of hooks consumed by PlayScreen (see play.js).
import { audio } from './audio.js';
import { fx } from './fx.js';
import { store } from './store.js';
import { go, toast } from './ui.js';
import { DB, pickPuzzle, getPuzzleById } from './puzzles.js';
import { levelInfo, levelPuzzle, TOTAL_LEVELS } from './levels.js';
import { resultModal } from './results.js';
import { xpFor, checkAchievements } from './progress.js';
import { sleep, fmtTime, clamp, rand, todayKey, yesterdayKey } from './util.js';
import { themeInfo } from './themes.js';

const award = (xp) => {
  const before = store.s.xp;
  const info = store.addXP(xp);
  return { before, info };
};
const playMode = (mode) => go('play', { mode });
const timeStat = (ms) => ({ l: 'Time', v: fmtTime(ms / 1000) });

// ---------------------------------------------------------------- Adventure
export function adventureMode(n) {
  const info = levelInfo(n);
  const puzzle = levelPuzzle(n);
  let served = false;
  const world = info.world;
  return {
    id: 'adventure',
    title: `Level ${n}`,
    sub: `${world.name}${info.boss ? ' · 👾 BOSS' : ''}`,
    hearts: 3, hints: true, solution: true, showRating: true,
    centerText: { label: 'Level', value: n },
    intensity: info.boss ? 0.6 : 0.35,
    exitTo: () => go('map', { focus: n }, { dir: 'back' }),
    revealTheme: (p) => (world.theme ? [world.theme] : p.themes.slice(0, 2)),
    async nextPuzzle() { if (served) return null; served = true; return puzzle; },
    onWrong(play) { return play.loseHeart() ? 'fail' : 'retry'; },
    async onDone(play, res) {
      await sleep(res.solved ? 1100 : 500);
      if (!play.alive) return;
      let stars = 0, fresh = false;
      if (res.solved) {
        stars = res.mistakes === 0 ? (res.hints === 0 ? 3 : 2) : 1;
        fresh = store.setStars(n, stars);
        store.s.adventure.current = Math.max(store.s.adventure.current, store.maxUnlockedLevel);
      }
      const xp = xpFor(res, { stars, mult: info.boss ? 1.5 : 1 });
      const { before } = award(xp);
      store.save();
      const win = res.solved;
      const buttons = [{ r: 'map', label: '🗺️ Map', cls: 'gray' }];
      if (!win || stars < 3) buttons.push({ r: 'retry', label: '↻ Retry', cls: win ? 'blue' : 'green big pulse shine' });
      if (win && n < TOTAL_LEVELS) buttons.push({ r: 'next', label: 'Next ▶', cls: 'green big pulse shine' });
      const gotNext = win && fresh && stars >= 1;
      setTimeout(() => checkAchievements({ res }), 1800);
      const act = await resultModal({
        win,
        title: win ? (stars === 3 ? 'Perfect!' : info.boss ? 'Boss defeated!' : 'Level complete!') : (res.gaveUp ? 'Not this time' : 'Out of hearts!'),
        sub: `${world.name} · Level ${n}`,
        stars: win ? stars : null,
        stats: [{ l: 'Mistakes', v: res.mistakes }, { l: 'Hints', v: res.hints }, timeStat(res.timeMs), ...(win && res.mate ? [{ l: 'Checkmate!', v: '♚' }] : [])],
        xpFrom: before, xpGain: xp,
        note: win ? (stars === 3 ? 'Flawless — no mistakes, no hints!' : stars === 2 ? 'No mistakes! Skip the hints for a third star.' : 'Solved! Go mistake-free for more stars.') : 'Study the solution, then give it another go.',
        themes: res.puzzle.themes,
        buttons,
      });
      if (!play.alive) return;
      if (act === 'next') playMode(adventureMode(n + 1));
      else if (act === 'retry') playMode(adventureMode(n));
      else go('map', { focus: win && gotNext ? Math.min(TOTAL_LEVELS, n + 1) : n }, { dir: 'back' });
    },
  };
}

// ---------------------------------------------------------------- Rush
const RUSH_BONUS = { 5: 3, 12: 5, 20: 7, 30: 10 };

export function rushMode() {
  const start = clamp(store.s.rating - 450, 450, 1500);
  return {
    id: 'rush', title: 'Puzzle Rush', sub: '3 minutes. Go go go!',
    time: 180, fast: true, quietCelebrate: true, hints: false, solution: false, confirmExit: true, intensity: 0.65,
    scoreLabel: 'Score',
    async nextPuzzle(play) {
      const r = play.runStats;
      const target = start + r.solved * 48 + r.failed * 12;
      return pickPuzzle({ target, window: 80, exclude: new Set(store.s.seen.slice(-250)) });
    },
    onCorrect(play, pts) {
      play.addScore(pts);
      const c = play.combo;
      const b = RUSH_BONUS[c] || (c > 30 && c % 10 === 0 ? 10 : 0);
      if (b) setTimeout(() => play.addTime(b), 250);
    },
    onWrong(play) { play.addTime(-10); return 'skip'; },
    async onDone(play, res) {
      if (play.ended) return;
      await sleep(res.solved ? 380 : 120);
      if (play.ended || !play.alive) return;
      await play.next();
    },
    async onTimeUp(play) {
      if (play.ended) return;
      play.endRun();
      audio.gameOver();
      fx.bigWord("TIME'S UP!", { color: '#ff9ab0' });
      fx.shake(0.5);
      await sleep(1500);
      if (!play.alive) return;
      const r = play.runStats;
      const prevBest = store.s.best.rush;
      const newBest = play.score > prevBest;
      if (newBest) store.s.best.rush = play.score;
      store.s.best.rushSolved = Math.max(store.s.best.rushSolved, r.solved);
      store.s.best.rushCombo = Math.max(store.s.best.rushCombo, play.bestCombo);
      const xp = 15 + r.solved * 5 + Math.round(play.score / 40);
      const { before } = award(xp);
      store.save();
      setTimeout(() => checkAchievements({}), 1800);
      const acc = r.solved + r.failed ? Math.round((r.solved / (r.solved + r.failed)) * 100) : 0;
      const act = await resultModal({
        win: r.solved >= 3, title: newBest ? 'New best!' : "Time's up!", sub: 'Puzzle Rush',
        stats: [
          { l: 'Score', v: '0', count: play.score }, { l: 'Solved', v: '0', count: r.solved },
          { l: 'Best combo', v: '0', count: play.bestCombo, prefix: '×' }, { l: 'Accuracy', v: acc + '%' },
        ],
        xpFrom: before, xpGain: xp,
        note: newBest ? `Beat your old best of ${prevBest}!` : `Your best: ${store.s.best.rush}`,
        buttons: [{ r: 'menu', label: '🏠 Menu', cls: 'gray' }, { r: 'again', label: '↻ Again', cls: 'green big pulse shine' }],
      });
      if (!play.alive) return;
      if (act === 'again') playMode(rushMode()); else go('home', {}, { dir: 'back' });
    },
  };
}

// ---------------------------------------------------------------- Survival
export function survivalMode() {
  const start = clamp(store.s.rating - 350, 500, 1400);
  return {
    id: 'survival', title: 'Survival', sub: 'Three hearts. How far can you go?',
    hearts: 3, fast: true, quietCelebrate: true, hints: false, solution: false, confirmExit: true, intensity: 0.5,
    centerText: { label: 'Solved', value: 0 },
    async nextPuzzle(play) {
      const target = start + play.runStats.solved * 36;
      return pickPuzzle({ target, window: 80, exclude: new Set(store.s.seen.slice(-250)) });
    },
    onCorrect(play, pts) { play.addScore(pts); },
    onWrong(play) { play.loseHeart(); return 'skip'; },
    async onDone(play, res) {
      if (play.ended) return;
      if (res.solved) play.setCenter('Solved', play.runStats.solved);
      if (play.hearts <= 0) return this.finish(play);
      await sleep(res.solved ? 450 : 200);
      if (!play.alive || play.ended) return;
      await play.next();
    },
    async finish(play) {
      play.endRun();
      audio.gameOver();
      fx.bigWord('GAME OVER', { color: '#ff9ab0' });
      fx.shake(0.6);
      await sleep(1500);
      if (!play.alive) return;
      const r = play.runStats;
      const prevBest = store.s.best.survival;
      const newBest = r.solved > prevBest;
      if (newBest) store.s.best.survival = r.solved;
      const xp = 12 + r.solved * 7;
      const { before } = award(xp);
      store.save();
      setTimeout(() => checkAchievements({}), 1800);
      const act = await resultModal({
        win: r.solved >= 3, title: newBest ? 'New record!' : 'Game over', sub: 'Survival',
        stats: [{ l: 'Solved', v: '0', count: r.solved }, { l: 'Score', v: '0', count: play.score }, { l: 'Best combo', v: '0', count: play.bestCombo, prefix: '×' }],
        xpFrom: before, xpGain: xp,
        note: newBest ? `Old record: ${prevBest}` : `Your record: ${store.s.best.survival}`,
        buttons: [{ r: 'menu', label: '🏠 Menu', cls: 'gray' }, { r: 'again', label: '↻ Again', cls: 'green big pulse shine' }],
      });
      if (!play.alive) return;
      if (act === 'again') playMode(survivalMode()); else go('home', {}, { dir: 'back' });
    },
  };
}

// ---------------------------------------------------------------- Daily
export function dailyMode(puzzle) {
  const date = puzzle.daily || todayKey();
  let served = false;
  return {
    id: 'daily', title: 'Daily Puzzle', sub: new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }),
    hints: true, solution: true, showRating: false, noScore: false, centerText: { label: 'Streak', value: `🔥 ${store.s.daily.streak}` },
    intensity: 0.35,
    async nextPuzzle() { if (served) return null; served = true; return puzzle; },
    onWrong() { return 'retry'; },
    async onDone(play, res) {
      await sleep(res.solved ? 1100 : 400);
      if (!play.alive) return;
      const d = store.s.daily;
      const already = !!d.done[date];
      let streakUp = false;
      if (res.solved && !already) {
        d.done[date] = { t: Date.now(), clean: res.mistakes === 0 && res.hints === 0 };
        d.streak = d.last === yesterdayKey() ? d.streak + 1 : 1;
        d.last = date;
        streakUp = true;
      }
      const clean = res.solved && res.mistakes === 0 && res.hints === 0;
      const xp = already ? 3 : Math.round(xpFor(res, { stars: clean ? 3 : 1 }) * 2.2);
      const { before } = award(xp);
      store.save();
      setTimeout(() => checkAchievements({ res }), 1800);
      const act = await resultModal({
        win: res.solved, title: res.solved ? 'Daily complete!' : 'Not today…', sub: already ? 'Already counted today — bonus practice!' : 'Daily Puzzle',
        stars: res.solved ? (clean ? 3 : res.mistakes === 0 ? 2 : 1) : null,
        stats: [
          { l: 'Daily streak', v: `🔥 ${d.streak}`, cls: streakUp ? 'up' : '' },
          { l: 'Mistakes', v: res.mistakes }, timeStat(res.timeMs),
        ],
        xpFrom: before, xpGain: xp,
        note: res.solved ? 'Come back tomorrow for a fresh one!' : 'Study the solution and try again — the daily stays open all day.',
        themes: res.puzzle.themes,
        buttons: [{ r: 'menu', label: '🏠 Menu', cls: 'gray' }, ...(res.solved ? [] : [{ r: 'retry', label: '↻ Retry', cls: 'green big pulse shine' }]), ...(res.solved ? [{ r: 'train', label: 'Keep training ▶', cls: 'green big pulse shine' }] : [])],
      });
      if (!play.alive) return;
      if (act === 'retry') playMode(dailyMode(puzzle));
      else if (act === 'train') playMode(trainingMode({}));
      else go('home', {}, { dir: 'back' });
    },
  };
}

// ---------------------------------------------------------------- Training (rated, adaptive)
export function trainingMode({ themes = null, offset = 0, label = null } = {}) {
  const tlabel = label || (themes?.length === 1 ? themeInfo(themes[0]).name : themes?.length ? `${themes.length} themes` : 'All themes');
  return {
    id: 'training', title: 'Training', sub: `${tlabel}${offset ? (offset > 0 ? ' · harder' : ' · easier') : ''}`,
    hints: true, solution: true, showRating: false, intensity: 0.3,
    centerText: { label: 'Rating', value: store.s.rating },
    async nextPuzzle() {
      const target = store.s.rating + offset + rand(-60, 110);
      return pickPuzzle({ themes, target, window: 70, exclude: new Set(store.s.seen.slice(-300)) });
    },
    onWrong() { return 'retry'; },
    async onDone(play, res) {
      await sleep(res.solved ? 1000 : 300);
      if (!play.alive) return;
      const score = res.solved ? (res.mistakes === 0 && res.hints === 0 ? 1 : 0.3) : 0;
      const before0 = store.s.rating;
      const { delta, rating } = store.updateRating(res.puzzle.rating, score);
      const clean = res.solved && res.mistakes === 0 && res.hints === 0;
      const xp = xpFor(res, { stars: clean ? 3 : 0 });
      const { before } = award(xp);
      store.save();
      play.setCenter('Rating', rating);
      setTimeout(() => checkAchievements({ res }), 1800);
      const act = await resultModal({
        win: res.solved, title: clean ? 'Sweet!' : res.solved ? 'Solved' : 'Missed it',
        sub: `Puzzle rated ${res.puzzle.rating}`,
        stats: [
          { l: 'Rating', v: '0', count: rating, cls: delta >= 0 ? 'up' : 'down' },
          { l: 'Change', v: '0', count: Math.abs(delta), prefix: delta >= 0 ? '+' : '−', cls: delta >= 0 ? 'up' : 'down' },
          { l: 'Mistakes', v: res.mistakes }, timeStat(res.timeMs),
        ],
        xpFrom: before, xpGain: xp,
        note: clean ? 'Clean solve — no mistakes, no hints.' : res.solved ? 'Solved with a few bumps. Clean solves earn more!' : 'It happens. The puzzle is saved to Review.',
        themes: res.puzzle.themes,
        buttons: [{ r: 'menu', label: '🏠 Menu', cls: 'gray' }, { r: 'next', label: 'Next ▶', cls: 'green big pulse shine' }],
      });
      if (!play.alive) return;
      if (act === 'next') await play.next(); else go('home', {}, { dir: 'back' });
    },
  };
}

// ---------------------------------------------------------------- Review mistakes
export function reviewMode() {
  return {
    id: 'review', title: 'Review', sub: 'Revisit puzzles you missed',
    hints: true, solution: true, showRating: false, intensity: 0.25, noScore: false,
    centerText: { label: 'To go', value: store.s.missed.length },
    async nextPuzzle(play) {
      const ids = store.s.missed.filter((id) => DB.byId.has(id));
      if (!ids.length) {
        toast({ icon: '🏆', title: 'All clear!', sub: 'No missed puzzles left to review.' });
        fx.cannons({ n: 80 });
        play.ended = true;
        setTimeout(() => go('home', {}, { dir: 'back' }), 1400);
        return null;
      }
      return DB.byId.get(ids[Math.floor(Math.random() * ids.length)]);
    },
    onWrong() { return 'retry'; },
    async onDone(play, res) {
      await sleep(res.solved ? 1000 : 300);
      if (!play.alive) return;
      const clean = res.solved && res.mistakes === 0 && res.hints === 0;
      const xp = Math.round(xpFor(res, { stars: clean ? 3 : 0 }) * 0.7);
      const { before } = award(xp);
      store.save();
      play.setCenter('To go', store.s.missed.length);
      setTimeout(() => checkAchievements({ res }), 1800);
      const act = await resultModal({
        win: res.solved, title: clean ? 'Learned it!' : res.solved ? 'Getting there' : 'Still tricky',
        sub: `Puzzle rated ${res.puzzle.rating}`,
        stats: [{ l: 'Left to review', v: store.s.missed.length }, { l: 'Mistakes', v: res.mistakes }, timeStat(res.timeMs)],
        xpFrom: before, xpGain: xp,
        note: clean ? 'Removed from your review list. 🎉' : 'It stays in your review list until you solve it cleanly.',
        themes: res.puzzle.themes,
        buttons: [{ r: 'menu', label: '🏠 Menu', cls: 'gray' }, { r: 'next', label: 'Next ▶', cls: 'green big pulse shine' }],
      });
      if (!play.alive) return;
      if (act === 'next') await play.next(); else go('home', {}, { dir: 'back' });
    },
  };
}

/** Shared puzzle (link / lichess id). Unrated, just for fun. */
export function sharedMode(puzzle) {
  return {
    ...trainingMode({}),
    id: 'shared', title: 'Shared Puzzle', sub: `#${puzzle.id}`,
    async nextPuzzle() { return this._used ? null : ((this._used = true), puzzle); },
    async onDone(play, res) {
      await sleep(res.solved ? 1000 : 300);
      if (!play.alive) return;
      const act = await resultModal({
        win: res.solved, title: res.solved ? 'Solved!' : 'Not quite', sub: `Puzzle rated ${res.puzzle.rating}`,
        stats: [{ l: 'Mistakes', v: res.mistakes }, timeStat(res.timeMs)],
        themes: res.puzzle.themes,
        buttons: [{ r: 'menu', label: '🏠 Menu', cls: 'gray' }, { r: 'train', label: 'Train ▶', cls: 'green big pulse shine' }],
      });
      if (!play.alive) return;
      if (act === 'train') playMode(trainingMode({})); else go('home', {}, { dir: 'back' });
    },
  };
}
