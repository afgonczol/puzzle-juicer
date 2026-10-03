// Recolors the cburnett SVG pieces into glossy "colorways" at runtime.
import { RAW } from './piece-data.js';

// top/mid/bot = gradient stops, line = outline, hl = inner detail lines (dark side only), eye = knight eye (light side)
export const COLORWAYS = {
  classic: {
    w: { top: '#ffffff', mid: '#ffffff', bot: '#ffffff', line: '#000000', eye: '#000000' },
    b: { top: '#000000', mid: '#000000', bot: '#000000', line: '#000000', hl: '#ececec' },
  },
  gummy: {
    w: { top: '#fff6f9', mid: '#ffc6dd', bot: '#ff8ec0', line: '#6b1b4d', eye: '#4a0f36' },
    b: { top: '#9d7bff', mid: '#6a3de0', bot: '#3a1a9e', line: '#1c0a52', hl: '#dccfff' },
  },
  minty: {
    w: { top: '#f4fffa', mid: '#a6f5d6', bot: '#4ee0a8', line: '#0a4d3a', eye: '#05382a' },
    b: { top: '#ff9cbb', mid: '#f0467c', bot: '#b0124a', line: '#4d0522', hl: '#ffd6e3' },
  },
  gold: {
    w: { top: '#fffbe0', mid: '#ffd970', bot: '#e5a100', line: '#5e3f00', eye: '#3d2900' },
    b: { top: '#6b6b80', mid: '#34343f', bot: '#12121a', line: '#000000', hl: '#c9c9e0' },
  },
  icefire: {
    w: { top: '#ffffff', mid: '#c4eeff', bot: '#6ec8ff', line: '#0b3f78', eye: '#082d57' },
    b: { top: '#ffd070', mid: '#ff7a2a', bot: '#d8240b', line: '#5a0e00', hl: '#fff0c0' },
  },
  neon: {
    w: { top: '#e9ffff', mid: '#6df7ff', bot: '#12c4f0', line: '#02394a', eye: '#02394a' },
    b: { top: '#ff7de8', mid: '#e02bd0', bot: '#6d0f9e', line: '#2a0040', hl: '#ffd0f7' },
  },
};

function recolor(raw, cw, color) {
  const c = cw[color];
  let s = raw;
  if (color === 'w') {
    s = s
      .replace(/fill="#fff"/g, 'fill="url(#pg)"')
      .replace(/fill="#000"/g, `fill="${c.eye}"`)
      .replace(/stroke="#000"/g, `stroke="${c.line}"`);
  } else {
    s = s
      .replace(/fill="#000"/g, 'fill="url(#pg)"')
      .replace(/stroke="#000"/g, `stroke="${c.line}"`)
      .replace(/#ececec/g, c.hl);
    // black queen/rook/pawn rely on the implicit default (black) fill
    if (/^<path stroke="#?[^"]*"/.test(s) && !/fill=/.test(s.slice(0, 20))) s = s.replace('<path ', '<path fill="url(#pg)" ');
    s = s.replace(/^<g fill-rule="evenodd"/, '<g fill="url(#pg)" fill-rule="evenodd"');
  }
  return s;
}

function buildSvg(key, cwId) {
  const cw = COLORWAYS[cwId] || COLORWAYS.gummy;
  const color = key[0];
  const c = cw[color];
  const body = recolor(RAW[key], cw, color);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 45 45">` +
    `<defs><linearGradient id="pg" gradientUnits="userSpaceOnUse" x1="0" y1="7" x2="0" y2="40">` +
    `<stop offset="0" stop-color="${c.top}"/><stop offset=".5" stop-color="${c.mid}"/><stop offset="1" stop-color="${c.bot}"/>` +
    `</linearGradient></defs>${body}</svg>`
  );
}

const urlCache = new Map();
const imgCache = new Map();

export function pieceURL(setId, key) {
  const k = setId + key;
  if (!urlCache.has(k)) urlCache.set(k, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildSvg(key, setId))}`);
  return urlCache.get(k);
}

/** Loaded HTMLImageElement for canvas effects (shatter etc). */
export function pieceImage(setId, key) {
  const k = setId + key;
  if (!imgCache.has(k)) {
    const img = new Image();
    img.src = pieceURL(setId, key);
    imgCache.set(k, img);
  }
  return imgCache.get(k);
}

export const KEYS = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];
let current = 'gummy';
export const currentSet = () => current;

/** Publishes the set as CSS custom properties so every piece restyles instantly. */
export function applyPieceSet(setId) {
  current = COLORWAYS[setId] ? setId : 'gummy';
  const root = document.documentElement;
  for (const k of KEYS) root.style.setProperty(`--p-${k}`, `url("${pieceURL(current, k)}")`);
  root.dataset.pieces = current;
  KEYS.forEach((k) => pieceImage(current, k));
}
