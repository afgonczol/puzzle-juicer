// Bootstrap: background, FX canvas, data load, title screen → home.
import { audio } from './audio.js';
import { fx } from './fx.js';
import { store, settings } from './store.js';
import { loadPuzzles, getPuzzleById } from './puzzles.js';
import { go, registerScreen, toast } from './ui.js';
import { playScreen } from './play.js';
import { Mascot } from './mascot.js';
import './screens/home.js';
import './screens/map.js';
import './screens/stats.js';
import './screens/collection.js';
import { applyAppearance } from './screens/settings.js';
import { sharedMode } from './modes.js';
import { checkAchievements } from './progress.js';

registerScreen('play', ({ mode }) => playScreen(mode));

function makeBubbles() {
  const bg = document.getElementById('bg');
  for (let i = 0; i < 16; i++) {
    const b = document.createElement('i');
    b.className = 'bubble';
    const s = 14 + Math.random() * 60;
    b.style.cssText = `width:${s}px;height:${s}px;left:${Math.random() * 100}%;animation-duration:${14 + Math.random() * 22}s;animation-delay:${-Math.random() * 30}s;--dx:${(Math.random() - 0.5) * 120}px`;
    bg.appendChild(b);
  }
}

async function boot() {
  const app = document.getElementById('app');
  fx.init(document.getElementById('fx'), app, document.getElementById('fx-text'));
  applyAppearance();
  makeBubbles();
  const sm = new Mascot(document.getElementById('splash-mascot'), { size: 110, bubble: false });
  sm.set('think', { bounce: false });

  try {
    await loadPuzzles();
  } catch (err) {
    const e = document.getElementById('loaderr');
    e.hidden = false;
    e.textContent = 'Could not load the puzzle bundle. If you opened index.html directly, serve the folder over http(s) instead.';
    document.getElementById('loadbar').hidden = true;
    sm.set('sad');
    console.error(err);
    return;
  }

  document.getElementById('loadbar').hidden = true;
  const btn = document.getElementById('startbtn');
  btn.hidden = false;
  sm.set('happy');

  btn.addEventListener('click', async () => {
    audio.unlock();
    if (settings().musicOn) audio.startMusic();
    audio.levelUp();
    const r = btn.getBoundingClientRect();
    fx.fireworks(r.left + r.width / 2, r.top);
    fx.cannons({ n: 60 });
    document.getElementById('splash').classList.add('gone');
    const m = location.hash.match(/p=([A-Za-z0-9]{3,8})/);
    if (m) {
      try {
        const p = await getPuzzleById(m[1]);
        history.replaceState(null, '', location.pathname);
        return go('play', { mode: sharedMode(p) });
      } catch { toast({ icon: '🤷', title: 'Puzzle not found', sub: 'That shared link did not work.', sound: false }); }
    }
    go('home');
    checkAchievements({});
  }, { once: true });

  // Offline support only on real https deployments (keeps local dev free of stale caches; add ?sw to test locally).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.search.includes('sw'))) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
