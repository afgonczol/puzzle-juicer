// Candy-Crush-style adventure map: a winding path of levels, world banners, a hopping mascot.
import { audio } from '../audio.js';
import { fx } from '../fx.js';
import { Mascot } from '../mascot.js';
import { store } from '../store.js';
import { go, openModal, toast, registerScreen } from '../ui.js';
import { h, mulberry32, sleep, clamp } from '../util.js';
import { WORLDS, LEVELS_PER_WORLD, TOTAL_LEVELS, levelInfo } from '../levels.js';
import { adventureMode } from '../modes.js';

const SPACING = 104;
const BANNER = 150;
const TOP_PAD = 160;
const BOT_PAD = 150;
const W = 520; // virtual width for geometry

function layout() {
  const pts = [];
  const worldCount = WORLDS.length;
  const H = TOP_PAD + BOT_PAD + TOTAL_LEVELS * SPACING + worldCount * BANNER;
  for (let n = 1; n <= TOTAL_LEVELS; n++) {
    const i = n - 1, wi = Math.floor(i / LEVELS_PER_WORLD);
    const y = H - BOT_PAD - i * SPACING - wi * BANNER;
    const x = 50 + 27 * Math.sin(i * 0.95 + wi * 1.3) + (i % 2 ? 4 : -4);
    pts.push({ n, x, y });
  }
  return { pts, H };
}

function smoothPath(pts, W) {
  const P = pts.map((p) => [(p.x / 100) * W, p.y]);
  if (P.length < 2) return '';
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function mapScreen({ focus } = {}) {
  const cur = store.maxUnlockedLevel;
  const { pts, H } = layout();
  const focusN = clamp(focus || Math.min(cur, TOTAL_LEVELS), 1, TOTAL_LEVELS);
  const el = h(`
  <div class="map">
    <header class="topbar">
      <button class="btn-round" data-act="back" aria-label="Back">‹</button>
      <div class="grow"><div class="top-title stroke thin">Adventure</div><div class="top-sub">⭐ ${store.totalStars()} / ${TOTAL_LEVELS * 3} stars</div></div>
      <button class="btn small green" data-act="current">📍 Current</button>
    </header>
    <div class="map-scroll"><div class="map-inner" style="height:${H}px"></div></div>
  </div>`);
  el.style.cssText = 'display:flex;flex-direction:column;position:absolute;inset:0';
  const scroll = el.querySelector('.map-scroll');
  const inner = el.querySelector('.map-inner');

  // path (full + completed)
  const done = pts.slice(0, Math.min(cur, TOTAL_LEVELS));
  inner.insertAdjacentHTML('beforeend', `
    <svg class="map-path" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${smoothPath(pts, W)}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="30" stroke-linecap="round" transform="translate(0,6)"/>
      <path d="${smoothPath(pts, W)}" fill="none" stroke="rgba(255,255,255,.32)" stroke-width="26" stroke-linecap="round"/>
      <path d="${smoothPath(pts, W)}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 14"/>
      <path d="${smoothPath(done, W)}" fill="none" stroke="#ffe14d" stroke-width="12" stroke-linecap="round" opacity=".85"/>
    </svg>`);

  // banners + decor
  const rng = mulberry32(777);
  WORLDS.forEach((w, wi) => {
    const first = pts[wi * LEVELS_PER_WORLD];
    const y = first.y + SPACING * 0.55 + BANNER * 0.5;
    const locked = cur < wi * LEVELS_PER_WORLD + 1;
    inner.insertAdjacentHTML('beforeend', `
      <div class="world-banner" style="top:${y}px;--w1:${w.c[0]};--w2:${w.c[1]};${locked ? 'filter:saturate(.5) brightness(.85)' : ''}">
        <div class="wb-in"><span class="wb-n">World ${wi + 1}</span><span class="wb-t stroke thin" style="-webkit-text-stroke:5px rgba(0,0,0,.35)">${w.name}</span><span class="wb-s">${w.sub}</span></div>
      </div>`);
    for (let k = 0; k < LEVELS_PER_WORLD; k++) {
      const p = pts[wi * LEVELS_PER_WORLD + k];
      if (rng() < 0.75) {
        const side = p.x > 50 ? -1 : 1;
        const dx = (side * (22 + rng() * 14));
        const e = document.createElement('div');
        e.className = 'decor';
        e.textContent = w.decor[Math.floor(rng() * w.decor.length)];
        e.style.cssText = `left:${clamp(p.x + dx, 3, 90)}%;top:${p.y + (rng() - 0.5) * 50}px;font-size:${30 + rng() * 26}px;animation-delay:${-rng() * 5}s`;
        inner.appendChild(e);
      }
    }
  });

  // nodes
  for (const p of pts) {
    const info = levelInfo(p.n);
    const stars = store.stars(p.n);
    const state = p.n < cur ? 'done' : p.n === cur ? 'todo' : 'locked';
    const b = document.createElement('button');
    b.className = `node ${state} ${info.boss ? 'boss' : ''}`;
    b.style.cssText = `left:${p.x}%;top:${p.y}px`;
    b.dataset.n = p.n;
    b.setAttribute('aria-label', `Level ${p.n}${state === 'locked' ? ' (locked)' : ''}`);
    b.innerHTML = `${info.boss ? '<span class="crown">👑</span>' : ''}${state === 'locked' ? '🔒' : p.n}${state !== 'locked' ? `<span class="stars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? '' : 'off'}">⭐</span>`).join('')}</span>` : ''}`;
    inner.appendChild(b);
  }

  // avatar
  const prevAvatar = store.s.adventure.avatar || Math.min(cur, TOTAL_LEVELS);
  const startPt = pts[clamp(prevAvatar, 1, TOTAL_LEVELS) - 1], curPt = pts[Math.min(cur, TOTAL_LEVELS) - 1];
  const avatar = h('<div class="avatar"><div class="mascot-host"></div></div>');
  avatar.style.cssText = `left:${startPt.x}%;top:${startPt.y}px`;
  inner.appendChild(avatar);
  const mascot = new Mascot(avatar.querySelector('.mascot-host'), { size: 66, bubble: false });
  mascot.set('happy', { bounce: false });

  // world tint follows the scroll
  let lastWorld = -1;
  const updateTint = () => {
    const mid = scroll.scrollTop + scroll.clientHeight * 0.5;
    const n = clamp(Math.round((H - BOT_PAD - mid) / (SPACING + BANNER / LEVELS_PER_WORLD)) + 1, 1, TOTAL_LEVELS);
    const wi = Math.floor((n - 1) / LEVELS_PER_WORLD);
    if (wi !== lastWorld) {
      lastWorld = wi;
      document.getElementById('bg')?.style.setProperty('--tint', WORLDS[wi].tint);
    }
  };
  scroll.addEventListener('scroll', updateTint, { passive: true });

  const scrollToN = (n, smooth) => {
    const p = pts[n - 1];
    scroll.style.scrollBehavior = smooth ? 'smooth' : 'auto';
    scroll.scrollTop = p.y - scroll.clientHeight * 0.55;
  };

  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a?.dataset.act === 'back') return go('home', {}, { dir: 'back' });
    if (a?.dataset.act === 'current') return scrollToN(Math.min(cur, TOTAL_LEVELS), true);
    const node = e.target.closest('.node');
    if (!node) return;
    const n = +node.dataset.n;
    if (n > cur) {
      audio.illegal();
      fx.shake(0.15);
      node.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px) rotate(-6deg)' }, { transform: 'translateX(8px) rotate(6deg)' }, { transform: 'translateX(0)' }], { duration: 320 });
      toast({ icon: '🔒', title: `Finish level ${cur} first!`, sub: 'Earn at least one star to unlock the next.', sound: false, ms: 2200 });
      return;
    }
    openLevel(n);
  });

  function openLevel(n) {
    const info = levelInfo(n), stars = store.stars(n);
    const w = info.world;
    const m = openModal(`
      <button class="btn-round close-x" data-r="x" aria-label="Close">✕</button>
      <div class="lvl-hero">${info.boss ? '👾' : w.decor[n % w.decor.length]}</div>
      <h2 class="stroke thin">Level ${n}</h2>
      <p class="sub">${w.name}${info.boss ? ' · <b>BOSS PUZZLE</b>' : ''}<br>Puzzle rating about ${info.target}${w.theme ? '' : ' · mixed themes'}</p>
      <div class="goal"><span class="gs">⭐</span>Solve the puzzle</div>
      <div class="goal"><span class="gs">⭐⭐</span>No mistakes</div>
      <div class="goal"><span class="gs">⭐⭐⭐</span>No mistakes, no hints</div>
      <p class="res-note">${stars ? `Your best: ${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}` : 'Not played yet'} · You get 3 ❤️</p>
      <div class="modal-actions"><button class="btn green big pulse shine" data-r="go">▶ Play</button></div>`);
    m.closed.then((r) => { if (r === 'go') go('play', { mode: adventureMode(n) }); });
  }

  return {
    el,
    onShow() {
      scrollToN(focusN, false);
      updateTint();
      // hop the mascot to the newest level
      if (prevAvatar !== Math.min(cur, TOTAL_LEVELS)) {
        setTimeout(async () => {
          audio.whoosh(true);
          avatar.style.left = curPt.x + '%';
          avatar.style.top = curPt.y + 'px';
          scrollToN(Math.min(cur, TOTAL_LEVELS), true);
          await sleep(1100);
          audio.pop();
          const r = avatar.getBoundingClientRect();
          fx.burst(r.left, r.bottom, { n: 24, speed: 300, life: 0.8, size: 6, shape: 'star' });
          fx.ring(r.left, r.bottom, { r1: 100, color: '#ffe14d' });
          store.s.adventure.avatar = Math.min(cur, TOTAL_LEVELS);
          store.save();
        }, 700);
      } else store.s.adventure.avatar = Math.min(cur, TOTAL_LEVELS);
    },
    destroy() {
      scroll.removeEventListener('scroll', updateTint);
      document.getElementById('bg')?.style.setProperty('--tint', 'transparent');
    },
  };
}

registerScreen('map', mapScreen);
