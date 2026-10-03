// The big juicy results modal: slamming stars, rolling numbers, XP bar, level-ups.
import { audio } from './audio.js';
import { fx } from './fx.js';
import { openModal } from './ui.js';
import { xpState, BOARDS, PIECE_SETS } from './store.js';
import { Mascot } from './mascot.js';
import { displayThemes, themeInfo } from './themes.js';
import { sleep, tween, lerp, ease, tweenNumber, vibrate } from './util.js';

const STAR_PATH = 'M50 4 L62 36 L96 38 L70 60 L79 94 L50 75 L21 94 L30 60 L4 38 L38 36 Z';
const starSvg = (i) => `
  <div class="star-slot" data-i="${i}">
    <svg viewBox="0 0 100 100"><defs><linearGradient id="gs${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6a8"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff9f1c"/></linearGradient></defs>
    <path class="off" d="${STAR_PATH}" stroke-linejoin="round"/>
    <path class="on" d="${STAR_PATH}" fill="url(#gs${i})" stroke="#b86a00" stroke-width="5" stroke-linejoin="round"/>
    <path class="on" d="M40 30 L50 14 L53 26" fill="#fff" opacity=".6"/></svg>
  </div>`;

export const chip = (t, i = 0) => {
  const m = themeInfo(t);
  return `<span class="theme-chip" style="--i:${i}" title="${m.desc.replace(/"/g, '&quot;')}">${m.emoji} ${m.name}</span>`;
};
export const chipsFor = (themes) => displayThemes(themes).map(chip).join('');

/**
 * o: {
 *   win, title, sub, note, stars (null|0..3), stats:[{l,v,cls,count?}],
 *   xpFrom, xpGain, themes, buttons:[{r,label,cls}], mood
 * }
 */
export async function resultModal(o) {
  const stars = o.stars;
  const html = `
    ${o.win ? '<div class="rays"></div>' : ''}
    <div class="res-mascot"></div>
    <h2 class="res-title stroke ${o.win ? 'win' : 'lose'}">${o.title}</h2>
    ${o.sub ? `<p class="sub">${o.sub}</p>` : ''}
    ${stars != null ? `<div class="star-row">${[0, 1, 2].map(starSvg).join('')}</div>` : ''}
    ${o.stats?.length ? `<div class="res-stats">${o.stats.map((s) => `<div class="res-stat"><div class="v ${s.cls || ''}" data-count="${s.count ?? ''}" data-prefix="${s.prefix || ''}">${s.v}</div><div class="l">${s.l}</div></div>`).join('')}</div>` : ''}
    ${o.xpGain != null ? `<div class="xp-line"><small>+${o.xpGain} XP · Level <span class="xl">${xpState(o.xpFrom).level}</span></small><div class="xp-track"><div class="xp-fill" style="width:${xpState(o.xpFrom).pct * 100}%"></div></div><div class="lvl-up-note" hidden></div></div>` : ''}
    ${o.note ? `<p class="res-note">${o.note}</p>` : ''}
    ${o.themes?.length ? `<div class="pz-themes">${chipsFor(o.themes)}</div>` : ''}
    <div class="modal-actions">${(o.buttons || []).map((b) => `<button class="btn ${b.cls || ''}" data-r="${b.r}">${b.label}</button>`).join('')}</div>`;
  const m = openModal(html, { dismissible: false, cls: 'result' });
  const root = m.el;
  const mascot = new Mascot(root.querySelector('.res-mascot'), { size: o.win ? 92 : 80, bubble: false });
  mascot.set(o.win ? (stars === 3 ? 'cheer' : 'happy') : 'sad');
  root.querySelector('.res-mascot').style.cssText = 'display:flex;justify-content:center;margin-bottom:2px';

  (async () => {
    const rect = () => root.getBoundingClientRect();
    if (o.win) {
      audio.solved();
      fx.cannons({ n: 70 });
      fx.rain(50);
    } else audio.gameOver();
    await sleep(350);
    if (stars != null) {
      const slots = [...root.querySelectorAll('.star-slot')];
      for (let i = 0; i < stars; i++) {
        slots[i].classList.add('lit');
        const r = slots[i].getBoundingClientRect();
        audio.star(i);
        vibrate(15);
        fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 24, speed: 380, life: 0.8, size: 7, shape: 'star', colors: ['#fff6a8', '#ffd23f', '#fff'] });
        fx.ring(r.left + r.width / 2, r.top + r.height / 2, { r1: 90, color: '#ffe14d', life: 0.5, w: 8 });
        fx.shake(0.2 + i * 0.1);
        if (i === 2) { fx.flash('#fff6a8', 0.5); fx.fireworks(r.left + r.width / 2, r.top); }
        await sleep(520);
      }
    }
    // roll numbers
    root.querySelectorAll('.res-stat .v[data-count]').forEach((el) => {
      const c = el.dataset.count;
      if (c === '') return;
      const to = +c, pre = el.dataset.prefix || '';
      tweenNumber(el, 0, to, 900, (v) => pre + Math.round(v).toLocaleString());
    });
    // xp bar
    if (o.xpGain) await animateXP(root, o.xpFrom, o.xpFrom + o.xpGain);
  })();
  return m.closed;
}

async function animateXP(root, from, to) {
  const fill = root.querySelector('.xp-fill'), lv = root.querySelector('.xl'), note = root.querySelector('.lvl-up-note');
  let cur = from;
  while (cur < to) {
    const st = xpState(cur);
    const roomXP = st.need - st.into;
    const step = Math.min(roomXP, to - cur);
    const p0 = st.pct, p1 = (st.into + step) / st.need;
    await tween(Math.max(350, Math.min(900, step * 14)), (e) => { fill.style.width = lerp(p0, p1, e) * 100 + '%'; }, ease.outCubic);
    cur += step;
    if (step === roomXP) {
      const ns = xpState(cur);
      lv.textContent = ns.level;
      const r = fill.getBoundingClientRect();
      audio.levelUp();
      fx.bigWord('LEVEL UP!', { color: '#7dffa8' });
      fx.fireworks(r.left + r.width / 2, r.top - 20);
      fx.cannons({ n: 50 });
      fx.shake(0.4);
      vibrate([20, 30, 40]);
      const unlocked = [...BOARDS, ...PIECE_SETS].filter((c) => c.level === ns.level);
      note.hidden = false;
      note.innerHTML = `<b style="font-size:20px">🎉 Level ${ns.level}!</b>${unlocked.length ? `<br><small>Unlocked: ${unlocked.map((u) => u.name).join(', ')}</small>` : ''}`;
      note.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
      fill.style.width = '0%';
      await sleep(350);
    }
  }
}
