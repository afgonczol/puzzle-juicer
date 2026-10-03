import { store } from '../store.js';
import { go, registerScreen } from '../ui.js';
import { h, fmtTime } from '../util.js';
import { themeInfo } from '../themes.js';
import { TOTAL_LEVELS } from '../levels.js';

const tile = (v, l, extra = '') => `<div class="stat-tile card"><div class="v">${v}</div><div class="l">${l}</div>${extra}</div>`;

function graph(history) {
  if (history.length < 2) return `<div class="card empty">Solve a few Training puzzles to see your rating graph. 📈</div>`;
  const pts = history.slice(-80);
  const rs = pts.map((p) => p.r);
  const min = Math.min(...rs) - 20, max = Math.max(...rs) + 20;
  const W = 600, H = 150, pad = 14;
  const xy = pts.map((p, i) => [pad + (i / (pts.length - 1)) * (W - pad * 2), H - pad - ((p.r - min) / (max - min)) * (H - pad * 2)]);
  const line = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${xy[xy.length - 1][0]},${H} L${xy[0][0]},${H} Z`;
  const last = xy[xy.length - 1];
  return `<svg class="graph card" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4fa3" stop-opacity=".55"/><stop offset="1" stop-color="#ff4fa3" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#gg)"/><path d="${line}" fill="none" stroke="#ffe14d" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="6" fill="#fff" stroke="#ff4fa3" stroke-width="3"/>
    <text x="${pad}" y="22" fill="#fff" opacity=".7" font-size="14" font-family="Fredoka">${Math.round(max)}</text><text x="${pad}" y="${H - 4}" fill="#fff" opacity=".7" font-size="14" font-family="Fredoka">${Math.round(min)}</text>
  </svg>`;
}

export function statsScreen() {
  const s = store.s, t = s.totals;
  const total = t.solved + t.failed;
  const acc = total ? Math.round((t.solved / total) * 100) : 0;
  const themes = Object.entries(s.perTheme)
    .map(([k, v]) => ({ k, n: v.ok + v.fail, acc: v.ok / (v.ok + v.fail) }))
    .filter((x) => x.n >= 3 && themeInfo(x.k).cat !== 'meta')
    .sort((a, b) => b.n - a.n)
    .slice(0, 9);
  const el = h(`
  <div class="screen scroll">
    <header class="topbar">
      <button class="btn-round" data-act="back" aria-label="Back">‹</button>
      <div class="grow"><div class="top-title stroke thin">Stats</div><div class="top-sub">Level ${store.level} · ${s.xp.toLocaleString()} XP</div></div>
    </header>
    <div class="page">
      <div class="stat-grid">
        ${tile(s.rating, 'Puzzle rating')}${tile(s.peakRating, 'Peak rating')}${tile(t.solved, 'Solved')}${tile(acc + '%', 'Accuracy')}
        ${tile('🔥 ' + store.liveStreak, 'Day streak')}${tile(s.streak.best, 'Best streak')}
        ${tile(t.perfect, 'Flawless')}${tile('×' + s.best.combo, 'Best combo')}
        ${tile(s.best.rush, 'Best Rush')}${tile(s.best.rushSolved, 'Rush solved')}${tile(s.best.survival, 'Best Survival')}
        ${tile(store.totalStars() + '/' + TOTAL_LEVELS * 3, 'Stars')}${tile(t.mates, 'Mates')}${tile(t.captures, 'Captures')}
        ${tile(t.fastest ? (t.fastest / 1000).toFixed(1) + 's' : '—', 'Fastest clean')}${tile(fmtTime(t.timeMs / 1000), 'Solve time')}
      </div>
      <div class="section-title">Rating history</div>
      ${graph(s.history)}
      <div class="section-title">Your themes</div>
      ${themes.length ? `<div class="card theme-bars">${themes.map((x) => `<div class="tb"><span>${themeInfo(x.k).emoji} ${themeInfo(x.k).name}</span><div class="bar"><i data-w="${Math.round(x.acc * 100)}"></i></div><span>${Math.round(x.acc * 100)}% <small>(${x.n})</small></span></div>`).join('')}</div>` : '<div class="card empty">Play a few more puzzles and your strongest and weakest themes appear here. 🧩</div>'}
    </div>
  </div>`);
  el.addEventListener('click', (e) => { if (e.target.closest('[data-act=back]')) go('home', {}, { dir: 'back' }); });
  return { el, onShow() { setTimeout(() => el.querySelectorAll('.tb .bar i').forEach((i) => { i.style.width = i.dataset.w + '%'; }), 350); } };
}

registerScreen('stats', statsScreen);
