import { audio } from '../audio.js';
import { fx } from '../fx.js';
import { store, settings, BOARDS, PIECE_SETS } from '../store.js';
import { pieceURL } from '../pieces.js';
import { go, toast, registerScreen } from '../ui.js';
import { h } from '../util.js';
import { ACHIEVEMENTS } from '../progress.js';
import { applyAppearance } from './settings.js';

const miniBoard = (b) => `<div class="mini-board">${Array.from({ length: 16 }, (_, i) => `<i style="background:${((i % 4) + Math.floor(i / 4)) % 2 ? b.d : b.l}"></i>`).join('')}</div>`;
const miniPieces = (id) => `<div class="mini-pieces" style="background:radial-gradient(circle,#ffffff22,transparent 70%)">${['wN', 'bQ', 'wR', 'bK'].map((k) => `<div class="pc" style="background-image:url('${pieceURL(id, k)}')"></div>`).join('')}</div>`;

export function collectionScreen({ tab = 'boards' } = {}) {
  const el = h(`
  <div class="screen scroll">
    <header class="topbar">
      <button class="btn-round" data-act="back" aria-label="Back">‹</button>
      <div class="grow"><div class="top-title stroke thin">Collection</div><div class="top-sub">Level ${store.level} · unlock more by leveling up</div></div>
    </header>
    <div class="page">
      <div class="tabs">
        <button class="tab" data-tab="boards">🎨 Boards</button>
        <button class="tab" data-tab="pieces">♞ Pieces</button>
        <button class="tab" data-tab="trophies">🏆 Trophies <small>${Object.keys(store.s.achievements).length}/${ACHIEVEMENTS.length}</small></button>
      </div>
      <div class="content"></div>
    </div>
  </div>`);
  const content = el.querySelector('.content');

  function render() {
    el.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    const s = settings(), lvl = store.level;
    if (tab === 'boards') {
      content.innerHTML = `<div class="cosm-grid">${BOARDS.map((b) => {
        const ok = lvl >= b.level;
        return `<div class="cosm card ${s.board === b.id ? 'sel' : ''} ${ok ? '' : 'locked'}" data-kind="board" data-id="${b.id}">${miniBoard(b)}<div class="nm">${b.name}</div><div class="lk">${ok ? (s.board === b.id ? '✔ In use' : 'Tap to use') : `🔒 Level ${b.level}`}</div></div>`;
      }).join('')}</div>`;
    } else if (tab === 'pieces') {
      content.innerHTML = `<div class="cosm-grid">${PIECE_SETS.map((p) => {
        const ok = lvl >= p.level;
        return `<div class="cosm card ${s.pieces === p.id ? 'sel' : ''} ${ok ? '' : 'locked'}" data-kind="pieces" data-id="${p.id}">${miniPieces(p.id)}<div class="nm">${p.name}</div><div class="lk">${ok ? (s.pieces === p.id ? '✔ In use' : 'Tap to use') : `🔒 Level ${p.level}`}</div></div>`;
      }).join('')}</div>`;
    } else {
      content.innerHTML = `<div class="ach-list">${ACHIEVEMENTS.map((a) => {
        const got = store.s.achievements[a.id];
        return `<div class="ach card ${got ? '' : 'locked'}"><div class="ai">${got ? a.icon : '❔'}</div><div><b>${a.name}</b><small>${a.desc}</small></div><div class="xp">+${a.xp} XP</div></div>`;
      }).join('')}</div>`;
    }
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-act=back]')) return go('home', {}, { dir: 'back' });
    const t = e.target.closest('.tab');
    if (t) { tab = t.dataset.tab; render(); return; }
    const c = e.target.closest('.cosm');
    if (!c) return;
    const lvl = store.level;
    const item = (c.dataset.kind === 'board' ? BOARDS : PIECE_SETS).find((x) => x.id === c.dataset.id);
    if (lvl < item.level) {
      audio.illegal();
      fx.shake(0.12);
      c.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], { duration: 300 });
      toast({ icon: '🔒', title: `Reach level ${item.level}`, sub: `Keep solving to unlock ${item.name}!`, sound: false, ms: 2000 });
      return;
    }
    settings()[c.dataset.kind === 'board' ? 'board' : 'pieces'] = item.id;
    store.save();
    applyAppearance();
    audio.correct(6);
    const r = c.getBoundingClientRect();
    fx.fireworks(r.left + r.width / 2, r.top + r.height / 2);
    render();
  });
  render();
  return { el };
}

registerScreen('collection', collectionScreen);
