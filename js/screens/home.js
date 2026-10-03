import { audio } from '../audio.js';
import { fx } from '../fx.js';
import { Mascot } from '../mascot.js';
import { store, settings } from '../store.js';
import { go, openModal, toast, registerScreen } from '../ui.js';
import { h, choice, sleep } from '../util.js';
import { TOTAL_LEVELS, levelInfo } from '../levels.js';
import { dailyMode, adventureMode, rushMode, survivalMode, trainingMode, reviewMode } from '../modes.js';
import { fetchDaily, localDaily } from '../puzzles.js';
import { TRAINING_THEMES, themeInfo } from '../themes.js';
import { openSettings } from './settings.js';
import { todayKey } from '../util.js';

const GREETINGS = [
  'Ready to squeeze some tactics?', 'Welcome back! 🍊', 'Forks, pins, mates — let\'s go!', 'Fresh puzzles, freshly squeezed!',
  'Your brain called. It wants a workout.', 'Pick a mode and let\'s get juicy!',
];
const POKES = ['Hehe, that tickles!', 'Boop!', 'Did you know? Queens are just fancy rooks.', 'Watch out for forks! 🍴', 'Pins win games!', 'Squeeze the day!', 'Look for checks, captures, threats!'];

export function homeScreen() {
  const s = store.s;
  const lp = store.levelProgress;
  const cur = store.maxUnlockedLevel;
  const dailyDone = !!s.daily.done[todayKey()];
  const missed = s.missed.length;
  const el = h(`
  <div class="home scroll">
    <div class="top-stats">
      <div class="lvl-badge" data-go="collection" title="Your level"><div class="n">${lp.level}</div><div><div style="font-size:12px;font-weight:700;opacity:.75;line-height:1">LEVEL</div><div class="xp-track"><div class="xp-fill" style="width:${lp.pct * 100}%"></div></div></div></div>
      <div class="chip" title="Puzzle rating">🎯 ${s.rating}</div>
      <div class="chip" title="Day streak">🔥 ${store.liveStreak}</div>
      <div class="spacer"></div>
      <button class="btn-round" data-act="music" aria-label="Music">${s.settings.musicOn ? '🎵' : '🔇'}</button>
      <button class="btn-round" data-act="settings" aria-label="Settings">⚙️</button>
    </div>
    <div class="page">
      <div class="hero">
        <h1 class="logo stroke" aria-label="Puzzle Juicer">
          <span class="row1">${[...'Puzzle'].map((c, i) => `<span class="l" style="--i:${i}">${c}</span>`).join('')}</span>
          <span class="row2">${[...'Juicer'].map((c, i) => `<span class="l" style="--i:${i + 6}">${c}</span>`).join('')}</span>
        </h1>
        <p class="tagline">Squeeze every tactic. Powered by Lichess puzzles.</p>
        <div class="hero-mascot"></div>
      </div>
      <div class="mode-grid">
        <button class="mode-card wide c-green" data-mode="adventure">
          <span class="ic">🗺️</span>
          <span class="txt"><h3>Adventure</h3><p>${cur > TOTAL_LEVELS ? 'Map complete! 🏆' : `Level ${cur} · ${levelInfo(Math.min(cur, TOTAL_LEVELS)).world.name}`} · ⭐ ${store.totalStars()}</p></span>
          <span class="tag">Lv ${Math.min(cur, TOTAL_LEVELS)}</span>
        </button>
        <button class="mode-card c-orange" data-mode="rush"><span class="ic">⚡</span><h3>Rush</h3><p>3 minutes. Beat the clock!</p><span class="tag">🏆 ${s.best.rush}</span></button>
        <button class="mode-card c-red" data-mode="survival"><span class="ic">❤️</span><h3>Survival</h3><p>Three hearts. Go deep.</p><span class="tag">🏆 ${s.best.survival}</span></button>
        <button class="mode-card c-pink ${dailyDone ? '' : 'new'}" data-mode="daily"><span class="ic">☀️</span><h3>Daily</h3><p>${dailyDone ? 'Done! Replay for fun.' : 'One puzzle a day.'}</p><span class="tag">${dailyDone ? '✔' : '🔥 ' + s.daily.streak}</span></button>
        <button class="mode-card c-blue" data-mode="training"><span class="ic">🎯</span><h3>Training</h3><p>Rated · pick your themes.</p><span class="tag">${s.rating}</span></button>
        <button class="mode-card wide c-purple" data-mode="review" style="min-height:96px"><span class="ic">🧠</span><span class="txt"><h3>Review</h3><p>Retry puzzles you missed until they stick.</p></span><span class="tag">${missed}</span></button>
      </div>
      <div class="home-foot">
        <button class="btn purple" data-go="stats">📊 Stats</button>
        <button class="btn pink" data-go="collection">🎨 Collection</button>
      </div>
      <p class="credit">Puzzles from the <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noopener">Lichess puzzle database</a> (CC0) · Pieces: cburnett · Not affiliated with Lichess.</p>
    </div>
  </div>`);

  const mascot = new Mascot(el.querySelector('.hero-mascot'), { size: 96 });
  const mEl = el.querySelector('.hero-mascot');
  setTimeout(() => mascot.say(choice(GREETINGS), 3800), 700);
  mEl.style.cursor = 'pointer';
  mEl.addEventListener('click', () => {
    mascot.set(choice(['wow', 'happy', 'wink']));
    mascot.say(choice(POKES), 2600);
    audio.pop();
    const r = mEl.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 18, speed: 260, life: 0.7, size: 6 });
  });

  el.addEventListener('click', async (e) => {
    const go_ = e.target.closest('[data-go]');
    if (go_) return go(go_.dataset.go);
    const act = e.target.closest('[data-act]');
    if (act) {
      if (act.dataset.act === 'settings') return openSettings();
      if (act.dataset.act === 'music') {
        const st = settings();
        st.musicOn = !st.musicOn; store.save();
        st.musicOn ? audio.startMusic() : audio.stopMusic();
        act.textContent = st.musicOn ? '🎵' : '🔇';
      }
      return;
    }
    const card = e.target.closest('[data-mode]');
    if (!card) return;
    const m = card.dataset.mode;
    if (m === 'adventure') return go('map', { focus: Math.min(cur, TOTAL_LEVELS) });
    if (m === 'rush') return go('play', { mode: rushMode() });
    if (m === 'survival') return go('play', { mode: survivalMode() });
    if (m === 'review') {
      if (!store.s.missed.length) {
        audio.pop();
        return toast({ icon: '🧠', title: 'Nothing to review!', sub: 'Puzzles you miss will show up here.', sound: false });
      }
      return go('play', { mode: reviewMode() });
    }
    if (m === 'training') return trainingSetup();
    if (m === 'daily') {
      card.querySelector('p').textContent = 'Fetching today\'s puzzle…';
      let p;
      try {
        if (!settings().online) throw new Error('offline mode');
        p = await Promise.race([fetchDaily(), sleep(3500).then(() => { throw new Error('timeout'); })]);
      } catch { p = localDaily(); }
      go('play', { mode: dailyMode(p) });
    }
  });
  return { el };
}

function trainingSetup() {
  const picked = new Set();
  let offset = 0;
  const m = openModal(`
    <h2 class="stroke thin">Training</h2>
    <p class="sub">Rated puzzles tuned to your rating (<b>${store.s.rating}</b>). Pick themes or leave blank for a mix.</p>
    <div class="picker">${TRAINING_THEMES.map((t) => `<button class="pick" data-t="${t}" title="${themeInfo(t).desc}">${themeInfo(t).emoji} ${themeInfo(t).name}</button>`).join('')}</div>
    <div class="seg" id="offs"><button data-o="-200">Easier</button><button data-o="0" class="on">Adaptive</button><button data-o="200">Harder</button></div>
    <div class="modal-actions"><button class="btn gray" data-r="x">Cancel</button><button class="btn green big pulse shine" data-r="go">Start ▶</button></div>`, { wide: true });
  m.el.querySelectorAll('.pick').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.t;
    picked.has(t) ? picked.delete(t) : picked.add(t);
    b.classList.toggle('on', picked.has(t));
  }));
  m.el.querySelectorAll('#offs button').forEach((b) => b.addEventListener('click', () => {
    offset = +b.dataset.o;
    m.el.querySelectorAll('#offs button').forEach((x) => x.classList.toggle('on', x === b));
  }));
  m.closed.then((r) => { if (r === 'go') go('play', { mode: trainingMode({ themes: picked.size ? [...picked] : null, offset }) }); });
}

registerScreen('home', homeScreen);
