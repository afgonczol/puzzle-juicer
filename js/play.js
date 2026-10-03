// The play screen: wires board + puzzle session + HUD + juice together. Modes plug in via hooks.
import { Board } from './board.js';
import { PuzzleSession } from './session.js';
import { audio } from './audio.js';
import { fx, CANDY } from './fx.js';
import { Mascot } from './mascot.js';
import { store, settings } from './store.js';
import { go, openModal, modalOpen, toast } from './ui.js';
import { h, sleep, fmtTime, vibrate, clamp, choice, tweenNumber } from './util.js';
import { chipsFor } from './results.js';
import { recordPuzzle } from './progress.js';
import { themeInfo } from './themes.js';
import { openSettings } from './screens/settings.js';

const COMBO_WORDS = {
  3: ['Nice!', '#7dffa8'], 5: ['Sweet!', '#ffe14d'], 8: ['Tasty!', '#ffa62b'], 12: ['Delicious!', '#ff7ad9'],
  16: ['Divine!', '#9b6bff'], 20: ['Brilliant!', '#3cc8ff'], 25: ['Sugar Crush!', '#ff4fa3'], 35: ['Unreal!', '#ffe14d'], 50: ['LEGENDARY!', '#ff4fa3'],
};
const SAY_OK = ['Sweet!', 'Yes! Keep going!', 'Ooh, juicy!', 'Nice one!', 'You got it!', 'Tasty move!'];
const SAY_BAD = ['Hmm, not that one…', 'Oops! Try again.', 'Nope — think again!', 'Close, but no.'];
const SAY_SOLVED = ['Puzzle squeezed! 🍊', 'You nailed it!', 'Absolutely delicious!', 'Squeezed to perfection!'];
const SAY_START = (c) => `Find the best move for ${c}!`;

class PlayScreen {
  constructor(mode) {
    this.mode = mode;
    this.alive = true;
    this.token = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.score = 0;
    this.hearts = mode.hearts || 0;
    this.maxHearts = this.hearts;
    this.timeTotal = mode.time || 0;
    this.timeLeft = this.timeTotal;
    this.runStats = { solved: 0, failed: 0, moves: 0, startedAt: Date.now() };
    this.locked = true;
    this.finished = false;
    this.hintLevel = 0;
    this.ended = false;
    this.clockRunning = false;
    this._build();
  }

  // ---------- DOM ----------
  _build() {
    const m = this.mode;
    this.el = h(`
    <div class="play">
      <header class="topbar">
        <button class="btn-round" data-act="back" aria-label="Back">‹</button>
        <div class="grow"><div class="top-title stroke thin"></div><div class="top-sub"></div></div>
        <button class="btn-round" data-act="music" aria-label="Music">🎵</button>
        <button class="btn-round" data-act="settings" aria-label="Settings">⚙️</button>
      </header>
      <div class="timerbar" hidden><div class="timerfill"></div><div class="timer-text"></div></div>
      <main class="stage">
        <aside class="side card side-l">
          <h4>Puzzle</h4>
          <div><div class="big pz-id">—</div><div class="pz-rating" style="opacity:.8"></div></div>
          <h4>Themes</h4>
          <div class="pz-themes"></div>
          <div class="pz-links" style="display:flex;flex-direction:column;gap:6px;font-size:14px"></div>
        </aside>
        <div class="center">
          <div class="turn-banner card">
            <div class="mascot-slot"></div>
            <div class="turn-info">
              <div class="turn-line"><span class="turn-dot"></span><span class="turn-text">Loading…</span></div>
              <div class="turn-say"></div>
            </div>
            <div class="pips"></div>
          </div>
          <div class="hud-row">
            <div class="hud-left"></div>
            <div class="score-box"><div class="lbl"></div><div class="val">0</div></div>
            <div class="combo"><div class="fill"></div><span class="t">×0</span></div>
          </div>
          <div class="board-wrap"></div>
          <div class="actions">
            <button class="btn blue" data-act="hint">💡 Hint</button>
            <button class="btn purple" data-act="flip">🔄 Flip</button>
            <button class="btn gray" data-act="solution">🏳️ Solution</button>
          </div>
        </div>
        <aside class="side card side-r">
          <h4>Streak combo</h4>
          <div><div class="big best-combo">0</div><div style="opacity:.8;font-size:14px">best this session</div></div>
          <h4>Controls</h4>
          <ul>
            <li>🖱️ Drag a piece — or tap, then tap</li>
            <li><span class="kbd">H</span> hint (twice for the arrow)</li>
            <li><span class="kbd">F</span> flip board</li>
            <li><span class="kbd">M</span> music on/off</li>
          </ul>
        </aside>
      </main>
    </div>`);
    const $ = (s) => this.el.querySelector(s);
    this.ui = {
      title: $('.top-title'), sub: $('.top-sub'), timerbar: $('.timerbar'), timerfill: $('.timerfill'), timertext: $('.timer-text'),
      turnDot: $('.turn-dot'), turnText: $('.turn-text'), say: $('.turn-say'), pips: $('.pips'), left: $('.hud-left'),
      scoreLbl: $('.score-box .lbl'), scoreVal: $('.score-box .val'), combo: $('.combo'), comboFill: $('.combo .fill'), comboT: $('.combo .t'),
      boardWrap: $('.board-wrap'), actions: $('.actions'), hintBtn: $('[data-act=hint]'), solBtn: $('[data-act=solution]'), musicBtn: $('[data-act=music]'),
      pzId: $('.pz-id'), pzRating: $('.pz-rating'), pzThemes: $('.side-l .pz-themes'), pzLinks: $('.pz-links'), bestCombo: $('.best-combo'),
    };
    this.ui.title.textContent = m.title;
    this.ui.sub.textContent = m.sub || '';
    this.ui.scoreLbl.textContent = m.scoreLabel || 'Score';
    if (m.hearts) this._renderHearts();
    if (m.time) { this.ui.timerbar.hidden = false; this._renderClock(); }
    if (!m.hints) this.ui.hintBtn.hidden = true;
    if (!m.solution) this.ui.solBtn.hidden = true;
    if (m.noScore) this.el.querySelector('.score-box').style.visibility = 'hidden';
    if (m.centerText) { this.ui.scoreLbl.textContent = m.centerText.label; this.ui.scoreVal.textContent = m.centerText.value; }
    this.board = new Board(this.ui.boardWrap);
    this.mascot = new Mascot(this.el.querySelector('.mascot-slot'), { size: 62, bubble: false });
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) this._act(b.dataset.act);
    });
    this._keys = (e) => this._key(e);
    window.addEventListener('keydown', this._keys);
    this._vis = () => { this._lastTick = performance.now(); };
    document.addEventListener('visibilitychange', this._vis);
    this._syncMusicBtn();
    document.documentElement.classList.toggle('no-coords-root', !settings().coords);
    this.board.el.classList.toggle('no-coords', !settings().coords);
  }

  onShow() { this.start(); }

  destroy() {
    this.alive = false;
    this.token++;
    clearTimeout(this.idleT);
    window.removeEventListener('keydown', this._keys);
    document.removeEventListener('visibilitychange', this._vis);
    audio.setIntensity(0.2);
    this.mode.onExit?.(this);
  }

  _key(e) {
    if (modalOpen() || e.target.matches('input,textarea') || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'h') this._act('hint');
    else if (k === 'f') this._act('flip');
    else if (k === 'm') this._act('music');
  }

  async _act(a) {
    if (a === 'back') return this.exit();
    if (a === 'settings') return openSettings();
    if (a === 'music') {
      const s = settings();
      s.musicOn = !s.musicOn;
      store.save();
      s.musicOn ? audio.startMusic() : audio.stopMusic();
      this._syncMusicBtn();
      return;
    }
    if (a === 'flip') return this.board.flip();
    if (a === 'hint') return this.hint();
    if (a === 'solution') return this.giveUp();
    if (a === 'share') {
      const url = `${location.origin}${location.pathname}#p=${this.session.puzzle.id}`;
      try { await navigator.clipboard.writeText(url); toast({ icon: '🔗', title: 'Link copied!', sub: 'Challenge a friend to this puzzle.', sound: false }); } catch { prompt('Copy this link', url); }
    }
  }

  _syncMusicBtn() { this.ui.musicBtn.textContent = settings().musicOn ? '🎵' : '🔇'; }

  async exit() {
    if (this.mode.confirmExit && !this.ended) {
      const m = openModal(`<h2 class="stroke thin">Quit this run?</h2><p class="sub">Your progress in this run will be lost.</p>
        <div class="modal-actions"><button class="btn gray" data-r="no">Keep playing</button><button class="btn red" data-r="yes">Quit</button></div>`);
      if ((await m.closed) !== 'yes') return;
    }
    this.mode.exitTo ? this.mode.exitTo() : go('home', {}, { dir: 'back' });
  }

  // ---------- run control ----------
  async start() {
    audio.setIntensity(this.mode.intensity ?? 0.3);
    await this.next();
  }

  async next() {
    if (!this.alive || this.ended) return;
    const p = await this.mode.nextPuzzle(this);
    if (!p || !this.alive) return;
    await this.loadPuzzle(p);
  }

  async loadPuzzle(p) {
    const token = ++this.token;
    const stale = () => !this.alive || this.ended || token !== this.token;
    this.locked = true;
    this.finished = false;
    this.hintLevel = 0;
    clearTimeout(this.idleT);
    this.session = new PuzzleSession(p);
    const s = this.session;
    this.board.disableInput();
    this._setTurn(s.playerColor);
    this._renderPips();
    this._renderMeta(false);
    this.mascot.set('think');
    this._say(SAY_START(s.playerColor === 'w' ? 'White' : 'Black'), false);
    this.ui.hintBtn.classList.remove('lit');
    this._hintLabel();
    if (this.board.pieces.size) { await this.board.sweepOut(); if (stale()) return; }
    this.board.clear();
    await this.board.setOrientation(s.playerColor === 'w' ? 'white' : 'black', false);
    await this.board.setPosition(s.boardArray, { animate: true });
    if (stale()) return;
    await sleep(this.mode.fast ? 120 : 280);
    if (stale()) return;
    const m = s.start();
    await this.board.playMove(m, { speed: this.mode.fast ? 1.3 : 1 });
    if (stale()) return;
    this._enableInput();
    this.t0 = performance.now();
    this.locked = false;
    this.mode.onPuzzleStart?.(this, p);
    this._armIdle();
    if (!this.clockRunning && this.timeTotal) this._startClock();
  }

  _enableInput() {
    this.board.enableInput({
      canGrab: (sq) => !this.locked && this.session.canGrab(sq),
      targets: (sq) => this.session.targets(sq),
      needsPromo: (f, t) => this.session.needsPromo(f, t),
      attempt: (f, t, pr) => this._onAttempt(f, t, pr),
      afterMove: (r) => this._afterMove(r),
      afterWrong: (r) => this._afterWrong(r),
    });
  }

  _onAttempt(from, to, promo) {
    this._noteActivity();
    const r = this.session.attempt(from, to, promo);
    if (r.status === 'ok') this.locked = true;
    if (r.status === 'wrong') { this.locked = true; this._wrongFx(from, to); }
    return r;
  }

  _wrongFx() {
    this.combo = 0;
    this._renderCombo();
    audio.wrong();
    fx.shake(0.4);
    fx.vignette('#ff2d55', 700);
    vibrate([40, 30, 60]);
    this.mascot.set('sad');
    this._say(choice(SAY_BAD));
  }

  async _afterWrong(r) {
    if (!this.alive || this.ended) return;
    const verdict = (await this.mode.onWrong(this, r)) || 'retry';
    if (!this.alive || this.ended) return;
    if (verdict === 'retry') {
      this.locked = false;
      this._armIdle();
      return;
    }
    // 'fail' (reveal + end) | 'skip' (flash answer, move on)
    await this._reveal(verdict === 'skip' ? 1 : 99, verdict === 'skip');
    await this._finish({ solved: false, skipped: verdict === 'skip' });
  }

  async _afterMove(r) {
    if (!this.alive || this.ended) return;
    const s = this.session;
    const mv = r.move;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (this.bestCombo > store.s.best.combo) store.s.best.combo = this.bestCombo;
    this.ui.bestCombo.textContent = this.bestCombo;
    this.hintLevel = 0;
    this._hintLabel();
    this.ui.hintBtn.classList.remove('lit');
    const c = this.board.centerOf(mv.to);
    const mult = Math.min(8, 1 + Math.floor(this.combo / 5));
    const pts = 10 * mult;
    this.board.flashSquare(mv.to, 'good');
    fx.burst(c.x, c.y, { n: 16, speed: 300, life: 0.7, size: 6, colors: ['#7dffa8', '#3ee6a8', '#ffffff', '#ffe14d'] });
    fx.popText(c.x, c.y - this.board.sqSize * 0.4, `+${pts}`, { color: mult > 2 ? '#ffe14d' : '#7dffa8', size: 26 + mult * 2 });
    audio.correct(this.combo - 1);
    this.mode.onCorrect?.(this, pts);
    this._renderCombo(true);
    this._renderPips();
    this.mascot.set('happy');
    if (!r.solved) this._say(choice(SAY_OK));
    if (r.solved) { await this._solved(r); return; }
    await sleep(this.mode.fast ? 180 : 340);
    if (!this.alive || this.ended) return;
    await this.board.playMove(r.reply, { speed: this.mode.fast ? 1.3 : 1 });
    if (!this.alive || this.ended) return;
    this.mascot.set('think');
    this.locked = false;
    this._armIdle();
  }

  async _solved(r) {
    const s = this.session;
    this.finished = true;
    clearTimeout(this.idleT);
    if (r.reply) await this.board.playMove(r.reply);
    const mated = (r.move.san || '').endsWith('#');
    this._renderPips();
    this.mascot.set('cheer');
    this._say(choice(SAY_SOLVED));
    if (!this.mode.quietCelebrate) {
      const quality = s.mistakes === 0 && s.hints === 0;
      fx.bigWord(quality ? choice(['Sweet!', 'Tasty!', 'Delicious!', 'Divine!', 'Brilliant!']) : choice(['Solved!', 'Nice!', 'Got it!']), { color: quality ? '#ffe14d' : '#7dffa8' });
      fx.confetti(window.innerWidth / 2, window.innerHeight * 0.55, { n: 40, spread: 2.2, power: 700 });
    } else {
      const c = this.board.centerOf(r.move.to);
      fx.ring(c.x, c.y, { r1: this.board.sqSize * 3, color: '#7dffa8' });
    }
    audio.combo(this.combo);
    await this._finish({ solved: true, mate: mated, alt: r.alt });
  }

  async _finish({ solved, skipped = false, mate = false, alt = false }) {
    if (!this.alive || this.ended) return;
    const s = this.session;
    this.finished = true;
    this.board.disableInput();
    const res = {
      puzzle: s.puzzle, solved, skipped, mate, alt, mistakes: s.mistakes, hints: s.hints, captures: s.captures, moves: s.correct,
      timeMs: this.t0 ? performance.now() - this.t0 : 0, gaveUp: s.gaveUp,
    };
    const rec = recordPuzzle(res);
    if (solved) this.runStats.solved++; else this.runStats.failed++;
    this.runStats.moves += s.correct;
    this._renderMeta(true);
    await this.mode.onDone(this, res, rec);
  }

  // ---------- helpers modes can use ----------
  addScore(n) {
    const from = this.score;
    this.score += n;
    tweenNumber(this.ui.scoreVal, from, this.score, 350);
    this.ui.scoreVal.classList.remove('bump'); void this.ui.scoreVal.offsetWidth; this.ui.scoreVal.classList.add('bump');
  }
  setCenter(label, value) {
    this.ui.scoreLbl.textContent = label;
    this.ui.scoreVal.textContent = value;
    this.ui.scoreVal.classList.remove('bump'); void this.ui.scoreVal.offsetWidth; this.ui.scoreVal.classList.add('bump');
  }

  _renderHearts() {
    this.ui.left.innerHTML = `<div class="hearts">${Array.from({ length: this.maxHearts }, (_, i) => `<span class="heart ${i >= this.hearts ? 'lost' : ''}">❤️</span>`).join('')}</div>`;
    this.ui.left.querySelectorAll('.heart')[this.hearts - 1]?.classList.toggle('beat', this.hearts === 1);
  }

  /** Returns true if out of hearts. */
  loseHeart() {
    const hs = this.ui.left.querySelectorAll('.heart');
    const idx = this.hearts - 1;
    this.hearts = Math.max(0, this.hearts - 1);
    const el = hs[idx];
    if (el) {
      const r = el.getBoundingClientRect();
      audio.heartBreak();
      fx.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 22, colors: ['#ff4d6d', '#ff8fa3', '#fff'], speed: 340, life: 0.8, size: 6, g: 900 });
      fx.ring(r.left + r.width / 2, r.top + r.height / 2, { r1: 60, color: '#ff4d6d', life: 0.4, w: 6 });
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.6) rotate(-14deg)', offset: 0.25 }, { transform: 'scale(.8) rotate(8deg)' }], { duration: 480 });
      el.classList.add('lost');
      el.classList.remove('beat');
    }
    hs[this.hearts - 1]?.classList.toggle('beat', this.hearts === 1);
    return this.hearts <= 0;
  }

  _renderClock() {
    const t = Math.max(0, this.timeLeft);
    this.ui.timerfill.style.transform = `scaleX(${clamp(t / this.timeTotal, 0, 1)})`;
    this.ui.timertext.textContent = fmtTime(t);
    this.ui.timerbar.classList.toggle('low', t <= 10 && this.clockRunning);
  }

  _startClock() {
    this.clockRunning = true;
    this._lastTick = performance.now();
    let lastSec = Math.ceil(this.timeLeft);
    const tick = (now) => {
      if (!this.alive || this.ended) return;
      const dt = Math.min(0.1, (now - this._lastTick) / 1000);
      this._lastTick = now;
      if (!modalOpen() && !document.hidden) {
        this.timeLeft -= dt;
        const sec = Math.ceil(this.timeLeft);
        if (sec !== lastSec) {
          lastSec = sec;
          if (sec <= 10 && sec > 0) audio.tick(true); else if (sec <= 3 && sec > 0) audio.tick(true);
        }
        this._renderClock();
        if (this.timeLeft <= 0) { this.timeLeft = 0; this._renderClock(); this.mode.onTimeUp?.(this); return; }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  addTime(sec) {
    const prev = this.timeLeft;
    this.timeLeft = Math.max(0, this.timeLeft + sec);
    const r = this.ui.timerbar.getBoundingClientRect();
    fx.popText(r.left + r.width * clamp(this.timeLeft / this.timeTotal, 0.1, 0.95), r.bottom + 18, `${sec > 0 ? '+' : ''}${sec}s`, { color: sec > 0 ? '#7dffa8' : '#ff6b86', size: 34, dur: 1100 });
    if (sec > 0) { audio.timeBonus(); fx.sparks(r.left + r.width / 2, r.top + 10, { n: 18, colors: ['#7dffa8', '#fff'] }); }
    else { audio.timePenalty(); fx.shake(0.45); fx.vignette('#ff2d55', 600); }
    this._renderClock();
    return prev;
  }

  stopClock() { this.clockRunning = false; this.ui.timerbar.classList.remove('low'); }

  _renderCombo(bump = false) {
    const c = this.combo;
    this.ui.comboT.textContent = `×${c}`;
    const lvl = [0, 3, 5, 8, 12, 16, 20, 25, 35, 50].filter((x) => c >= x).length;
    const next = [3, 5, 8, 12, 16, 20, 25, 35, 50, 99].find((x) => x > c) || 99;
    const prevT = [0, 3, 5, 8, 12, 16, 20, 25, 35, 50].filter((x) => x <= c).pop() || 0;
    this.ui.comboFill.style.setProperty('--p', c ? ((c - prevT) / (next - prevT)).toFixed(3) : 0);
    this.ui.combo.classList.toggle('hot', c >= 8);
    if (bump) { this.ui.combo.classList.remove('bump'); void this.ui.combo.offsetWidth; this.ui.combo.classList.add('bump'); }
    audio.setIntensity(clamp((this.mode.intensity ?? 0.3) + c * 0.025, 0, 1));
    if (bump && COMBO_WORDS[c]) {
      const [w, col] = COMBO_WORDS[c];
      fx.bigWord(w, { color: col });
      audio.combo(c);
      const r = this.ui.combo.getBoundingClientRect();
      fx.fireworks(r.left + r.width / 2, r.top + 10);
      fx.shake(0.25 + lvl * 0.04);
      fx.flash(col, 0.1);
    }
  }

  _setTurn(color) {
    this.ui.turnDot.classList.toggle('b', color === 'b');
    this.ui.turnText.textContent = `${color === 'w' ? 'White' : 'Black'} to move`;
  }

  _say(text, pop = true) {
    this.ui.say.textContent = text;
    if (pop) { this.ui.say.classList.remove('pop'); void this.ui.say.offsetWidth; this.ui.say.classList.add('pop'); }
  }

  _renderPips() {
    const s = this.session;
    if (!s) return;
    const done = s.over ? s.total : Math.floor((s.idx - 1) / 2);
    this.ui.pips.innerHTML = Array.from({ length: s.total }, (_, i) => `<i class="pip ${i < done ? 'on' : ''}"></i>`).join('');
  }

  _renderMeta(reveal) {
    const p = this.session.puzzle;
    this.ui.pzId.textContent = '#' + p.id;
    this.ui.pzRating.textContent = reveal || this.mode.showRating ? `Rated ${p.rating}` : 'Rating hidden until solved';
    if (reveal) this.ui.pzThemes.innerHTML = chipsFor(p.themes);
    else if (this.mode.revealTheme) this.ui.pzThemes.innerHTML = chipsFor(this.mode.revealTheme(p));
    else this.ui.pzThemes.innerHTML = '<span style="opacity:.7">🔒 Solve it to reveal</span>';
    const links = [`<a href="https://lichess.org/training/${p.id}" target="_blank" rel="noopener">View on Lichess ↗</a>`, `<button class="btn small blue" data-act="share" style="align-self:flex-start">🔗 Copy challenge link</button>`];
    this.ui.pzLinks.innerHTML = reveal ? links.join('') : '';
  }

  // ---------- hints, idle, reveal ----------
  _hintLabel() {
    this.ui.hintBtn.innerHTML = this.hintLevel === 0 ? '💡 Hint' : this.hintLevel === 1 ? '💡 Show move' : '💡 Hint';
  }

  hint() {
    if (!this.mode.hints || this.locked || this.finished || !this.session) return;
    this._noteActivity();
    const level = Math.min(2, this.hintLevel + 1);
    const hh = this.session.hint(level);
    if (!hh) return;
    this.hintLevel = level;
    this.board.showHint(hh.from, hh.to);
    audio.hint();
    this.ui.hintBtn.classList.add('lit');
    this.mascot.set('wink');
    this._say(level === 1 ? 'Psst… look at this piece!' : 'Move it right there!');
    const c = this.board.centerOf(hh.from);
    fx.burst(c.x, c.y, { n: 14, speed: 200, life: 0.7, size: 5, shape: 'star', colors: ['#ffe14d', '#fff'], g: -60 });
    this._hintLabel();
  }

  _armIdle() {
    clearTimeout(this.idleT);
    if (!settings().idleNudge || this.finished || !this.alive) return;
    this.idleT = setTimeout(() => {
      if (!this.alive || this.finished) return;
      if (this.locked || modalOpen()) return this._armIdle();
      const e = this.session.expected();
      if (e) { this.board.nudge(e.from); this.mascot.set('wink', { bounce: true }); }
      this.idleT = setTimeout(() => this._armIdle(), 4500);
    }, 10500);
  }
  _noteActivity() { this._armIdle(); }

  /** Play out the remaining solution (n moves) on the board. */
  async _reveal(n = 99, flashOnly = false) {
    this.locked = true;
    clearTimeout(this.idleT);
    const s = this.session;
    const e = s.expected();
    if (flashOnly && e) {
      this.board.showHint(e.from, e.to);
      this.mascot.set('wink');
      await sleep(950);
      return;
    }
    this._say('Here is the solution…');
    const moves = s.revealSolution();
    for (const m of moves) {
      await sleep(550);
      if (!this.alive) return;
      await this.board.playMove(m);
    }
    await sleep(500);
  }

  async giveUp() {
    if (this.finished || this.locked || !this.session) return;
    this.finished = true;
    this.board.disableInput();
    this.combo = 0;
    this._renderCombo();
    this.mascot.set('sad');
    await this._reveal();
    await this._finish({ solved: false });
  }

  /** Clean end of a run (Rush/Survival). */
  endRun() {
    this.ended = true;
    this.stopClock();
    clearTimeout(this.idleT);
    this.board.disableInput();
  }
}

export function playScreen(mode) {
  const p = new PlayScreen(mode);
  return { el: p.el, onShow: () => p.onShow(), destroy: () => p.destroy(), play: p };
}
