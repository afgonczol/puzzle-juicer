import { audio } from '../audio.js';
import { fx } from '../fx.js';
import { store, settings, BOARDS } from '../store.js';
import { applyPieceSet } from '../pieces.js';
import { openModal, toast, go } from '../ui.js';
import { h } from '../util.js';

/** Push board theme / piece set / motion prefs into the DOM. */
export function applyAppearance() {
  const s = settings();
  const b = BOARDS.find((x) => x.id === s.board) || BOARDS[0];
  const r = document.documentElement;
  r.style.setProperty('--sq-l', b.l);
  r.style.setProperty('--sq-d', b.d);
  r.style.setProperty('--glow', b.glow);
  r.dataset.board = b.id;
  applyPieceSet(s.pieces);
  r.classList.toggle('reduce-motion', !!s.reduceMotion);
  document.querySelectorAll('.board').forEach((e) => e.classList.toggle('no-coords', !s.coords));
}

const row = (label, sub, control) => `<div class="set-row"><div>${label}${sub ? `<small>${sub}</small>` : ''}</div>${control}</div>`;
const sw = (k) => `<button class="switch ${settings()[k] ? 'on' : ''}" data-k="${k}" role="switch" aria-checked="${!!settings()[k]}"></button>`;
const slider = (k, max = 1) => `<input type="range" min="0" max="${max}" step="0.01" value="${settings()[k]}" data-s="${k}">`;

export function openSettings() {
  const s = settings();
  const m = openModal(`
    <button class="btn-round close-x" data-r="x" aria-label="Close">✕</button>
    <h2 class="stroke thin">Settings</h2>
    <div style="text-align:left">
      <div class="section-title">Sound</div>
      <div class="card set-group">
        ${row('Master volume', '', slider('master'))}
        ${row('Sound effects', '', sw('sfxOn'))}
        ${row('Effects volume', '', slider('sfx'))}
        ${row('Music', 'Generative lullaby that gets hype with your combo', sw('musicOn'))}
        ${row('Music volume', '', slider('music'))}
      </div>
      <div class="section-title">Juice</div>
      <div class="card set-group">
        ${row('Effects', 'Particles, shatters, confetti…', `<div class="seg" id="fxseg">${['Low', 'Med', 'MAX'].map((n, i) => `<button data-fx="${i + 1}" class="${s.fx === i + 1 ? 'on' : ''}">${n}</button>`).join('')}</div>`)}
        ${row('Screen shake', '', sw('shake'))}
        ${row('Haptics', 'Vibration on phones', sw('haptics'))}
        ${row('Reduce motion', 'Turns off particles and shake', sw('reduceMotion'))}
      </div>
      <div class="section-title">Gameplay</div>
      <div class="card set-group">
        ${row('Show legal moves', '', sw('legal'))}
        ${row('Board coordinates', '', sw('coords'))}
        ${row('Auto-next', 'Jump to the next puzzle/level after a 3-second countdown', sw('autoNext'))}
        ${row('Idle nudge', 'Piece wiggles if you pause too long', sw('idleNudge'))}
        ${row('Fetch Daily from Lichess', 'Falls back to a bundled puzzle offline', sw('online'))}
      </div>
      <div class="section-title">Your data</div>
      <div class="card set-group" style="padding:14px 16px">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn small blue" id="exp">⬇ Export save</button>
          <button class="btn small purple" id="imp">⬆ Import save</button>
          <button class="btn small red" id="rst">🗑 Reset all</button>
        </div>
        <textarea class="save-box" id="savebox" hidden spellcheck="false"></textarea>
        <button class="btn small green" id="doimp" hidden style="margin-top:8px">Load this save</button>
      </div>
      <p class="credit">Puzzle Juicer · Lichess puzzle data (CC0) · Pieces by Colin M.L. Burnett · Font: Fredoka</p>
    </div>`, { wide: true });
  const root = m.el;
  root.addEventListener('click', (e) => {
    const t = e.target.closest('.switch');
    if (t) {
      const k = t.dataset.k;
      s[k] = !s[k];
      t.classList.toggle('on', s[k]);
      t.setAttribute('aria-checked', s[k]);
      if (k === 'musicOn') s[k] ? audio.startMusic() : audio.stopMusic();
      if (k === 'reduceMotion' && s[k]) toast({ icon: '🧘', title: 'Reduced motion on', sub: 'Particles and shake are disabled.', sound: false });
      store.save(); applyAppearance();
      return;
    }
    const f = e.target.closest('#fxseg button');
    if (f) {
      s.fx = +f.dataset.fx;
      root.querySelectorAll('#fxseg button').forEach((b) => b.classList.toggle('on', b === f));
      store.save();
      const r = f.getBoundingClientRect();
      fx.fireworks(r.left + r.width / 2, r.top);
    }
  });
  root.querySelectorAll('input[type=range]').forEach((i) => {
    i.addEventListener('input', () => { s[i.dataset.s] = +i.value; store.save(); });
    i.addEventListener('change', () => { audio.correct(3); });
  });
  root.querySelector('#exp').addEventListener('click', () => {
    const box = root.querySelector('#savebox');
    box.hidden = false; box.value = store.exportJSON(); box.select();
    root.querySelector('#doimp').hidden = true;
    try { navigator.clipboard?.writeText(box.value); toast({ icon: '📋', title: 'Save copied!', sub: 'Paste it somewhere safe.', sound: false }); } catch { /* ignore */ }
  });
  root.querySelector('#imp').addEventListener('click', () => {
    const box = root.querySelector('#savebox');
    box.hidden = false; box.value = ''; box.placeholder = 'Paste your save here…';
    root.querySelector('#doimp').hidden = false;
  });
  root.querySelector('#doimp').addEventListener('click', () => {
    try {
      store.importJSON(root.querySelector('#savebox').value);
      toast({ icon: '✅', title: 'Save loaded!', sub: 'Welcome back.' });
      applyAppearance();
      m.close().then(() => go('home'));
    } catch (err) { toast({ icon: '⚠️', title: 'Could not load save', sub: err.message, sound: false }); }
  });
  root.querySelector('#rst').addEventListener('click', async () => {
    const c = openModal(`<h2 class="stroke thin">Reset everything?</h2><p class="sub">This deletes your level, rating, stars and trophies. It can't be undone.</p>
      <div class="modal-actions"><button class="btn gray" data-r="no">Keep my stuff</button><button class="btn red" data-r="yes">Reset</button></div>`);
    if ((await c.closed) === 'yes') { store.reset(); applyAppearance(); m.close(); go('home'); }
  });
  return m;
}
