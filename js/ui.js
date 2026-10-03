// Screen router, modals, toasts, and global "every click is juicy" behavior.
import { audio } from './audio.js';
import { fx } from './fx.js';
import { h, sleep, vibrate } from './util.js';

const screens = {};
let current = null;
const root = () => document.getElementById('app');

export function registerScreen(name, factory) { screens[name] = factory; }
export const currentScreen = () => current;

/** Navigate. factory(params) returns { el, destroy?, onShow? }. */
export async function go(name, params = {}, { dir = 'forward' } = {}) {
  const factory = screens[name];
  if (!factory) throw new Error('Unknown screen ' + name);
  const prev = current;
  const inst = factory(params);
  inst.name = name;
  inst.el.classList.add('screen');
  inst.el.dataset.screen = name;
  const r = root();
  r.appendChild(inst.el);
  current = inst;
  const fromX = dir === 'back' ? -40 : 40;
  inst.el.animate(
    [{ opacity: 0, transform: `translateX(${fromX}px) scale(.97)` }, { opacity: 1, transform: 'none' }],
    { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1.1)' }
  );
  if (prev) {
    prev.el.style.pointerEvents = 'none';
    const a = prev.el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-fromX}px) scale(.97)` }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => { prev.destroy?.(); prev.el.remove(); };
  }
  audio.whoosh(dir === 'forward');
  inst.onShow?.();
  return inst;
}

// ---------- modals ----------
const modalStack = [];

export function openModal(content, { wide = false, dismissible = true, cls = '' } = {}) {
  const back = h('<div class="modal-back"></div>');
  const card = h(`<div class="modal ${wide ? 'wide' : ''} ${cls}"></div>`);
  if (typeof content === 'string') card.innerHTML = content; else card.appendChild(content);
  back.appendChild(card);
  document.body.appendChild(back);
  let resolve;
  const closed = new Promise((r) => { resolve = r; });
  let done = false;
  const m = {
    el: card, back, closed,
    async close(value) {
      if (done) return;
      done = true;
      modalStack.splice(modalStack.indexOf(m), 1);
      back.classList.add('closing');
      card.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(.85) translateY(30px)', opacity: 0 }], { duration: 200, fill: 'forwards' });
      await sleep(200);
      back.remove();
      resolve(value);
    },
  };
  back.addEventListener('pointerdown', (e) => { if (e.target === back && dismissible) m.close(null); });
  card.addEventListener('click', (e) => {
    const t = e.target.closest('[data-r]');
    if (t && !t.disabled) m.close(t.dataset.r);
  });
  modalStack.push(m);
  audio.pop();
  return m;
}

window.addEventListener('keydown', (e) => {
  if (!modalStack.length) return;
  const top = modalStack[modalStack.length - 1];
  if (e.key === 'Escape') top.close(null);
  else if (e.key === 'Enter' || e.key === ' ') {
    const primary = top.el.querySelector('.btn.pulse, .btn.green');
    if (primary && !e.target.matches('input,textarea,button.switch')) { e.preventDefault(); primary.click(); }
  }
});
export const modalOpen = () => modalStack.length > 0;

// ---------- toasts ----------
export function toast({ icon = '⭐', title, sub = '', ms = 3200, sound = true }) {
  const box = document.getElementById('toasts');
  const t = h(`<div class="toast"><div class="ti">${icon}</div><div><b>${title}</b><small>${sub}</small></div></div>`);
  box.appendChild(t);
  if (sound) audio.achievement();
  const r = t.getBoundingClientRect();
  fx.burst(r.left + 30, r.top + 30, { n: 14, speed: 280, life: 0.7, size: 5, shape: 'star' });
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 360); }, ms);
}

// ---------- global click juice ----------
const CLICKABLE = '.btn, .btn-round, .mode-card, .tab, .pick, .node, .cosm, .lvl-badge, .switch, .seg button, .promo-opt';
document.addEventListener('pointerdown', (e) => {
  const t = e.target.closest(CLICKABLE);
  if (!t || t.disabled) return;
  audio.click();
  vibrate(5);
  fx.burst(e.clientX, e.clientY, { n: 7, speed: 170, life: 0.45, size: 3.5, g: 200, shape: 'star' });
}, true);
let lastHover = 0;
document.addEventListener('pointerover', (e) => {
  const t = e.target.closest('.btn, .btn-round, .mode-card, .node, .cosm, .tab, .pick');
  if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
  const now = performance.now();
  if (now - lastHover < 60 || e.pointerType === 'touch') return;
  lastHover = now;
  audio.hover();
}, true);
