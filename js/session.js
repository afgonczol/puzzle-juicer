// Pure puzzle logic (no DOM): validates moves against the Lichess solution.
import { Chess } from './vendor/chess.js';

const parse = (uci) => ({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });

export class PuzzleSession {
  constructor(puzzle) {
    this.puzzle = puzzle;
    this.chess = new Chess(puzzle.fen);
    this.moves = puzzle.moves;
    this.idx = 0;
    this.mistakes = 0;
    this.hints = 0;
    this.solved = false;
    this.gaveUp = false;
    this.correct = 0;
    this.captures = 0;
    this.playerColor = this.chess.turn() === 'w' ? 'b' : 'w'; // moves[0] is the opponent's
  }

  get boardArray() { return this.chess.board(); }
  get turn() { return this.chess.turn(); }
  get over() { return this.solved || this.gaveUp; }
  get total() { return Math.ceil((this.moves.length - 1) / 2); }
  get progress() { return this.over ? 1 : Math.floor((this.idx - 1) / 2) / this.total; }

  /** Plays the opponent's setup move. */
  start() {
    const m = this._apply(this.moves[0]);
    this.idx = 1;
    return m;
  }

  _apply(uci) {
    const m = this.chess.move(parse(uci));
    return m;
  }

  canGrab(sq) {
    if (this.over || this.chess.turn() !== this.playerColor) return false;
    const p = this.chess.get(sq);
    return !!p && p.color === this.playerColor;
  }

  /** Legal destinations; castling also accepts "king takes own rook" as a hidden alias. */
  targets(sq) {
    if (this.over) return [];
    const seen = new Map();
    for (const m of this.chess.moves({ square: sq, verbose: true })) {
      if (!seen.has(m.to)) seen.set(m.to, { to: m.to, capture: m.flags.includes('c') || m.flags.includes('e') });
      if (m.flags.includes('k') || m.flags.includes('q')) {
        const rook = m.flags.includes('k') ? 'h' : 'a';
        const alias = rook + m.from[1];
        if (!seen.has(alias)) seen.set(alias, { to: alias, capture: false, alias: true });
      }
    }
    return [...seen.values()];
  }

  needsPromo(from, to) {
    const p = this.chess.get(from);
    if (!p || p.type !== 'p') return null;
    const last = p.color === 'w' ? '8' : '1';
    if (to[1] !== last) return null;
    return this.chess.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion) ? p.color : null;
  }

  /** Try a player move. Returns { status, move, reply?, solved?, alt? }. */
  attempt(from, to, promo) {
    const alias = this.targets(from).find((t) => t.to === to && t.alias);
    if (alias) to = from[0] === 'e' ? (to[0] === 'h' ? 'g' : 'c') + from[1] : to;
    const legal = this.chess.moves({ square: from, verbose: true }).filter((m) => m.to === to && (!m.promotion || m.promotion === (promo || 'q')));
    if (!legal.length) return { status: 'illegal' };
    const m = legal[0];
    const uci = m.from + m.to + (m.promotion || '');
    const expected = this.moves[this.idx];
    let alt = false;
    if (uci !== expected) {
      // Lichess rule: any move that checkmates is as good as the book solution
      const probe = new Chess(this.chess.fen());
      probe.move({ from: m.from, to: m.to, promotion: m.promotion });
      if (probe.isCheckmate()) alt = true;
    }
    if (uci !== expected && !alt) {
      this.mistakes++;
      return { status: 'wrong', move: m };
    }
    const move = this.chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    if (move.captured) this.captures++;
    this.correct++;
    this.idx++;
    if (alt || this.idx >= this.moves.length) {
      this.solved = true;
      return { status: 'ok', move, solved: true, alt };
    }
    const reply = this._apply(this.moves[this.idx]);
    this.idx++;
    if (this.idx >= this.moves.length) {
      this.solved = true;
      return { status: 'ok', move, reply, solved: true };
    }
    return { status: 'ok', move, reply, solved: false };
  }

  /** The move the player should make now, as {from,to,promotion}. */
  expected() { return this.over ? null : parse(this.moves[this.idx]); }

  hint(level) {
    const e = this.expected();
    if (!e) return null;
    this.hints = Math.max(this.hints, level);
    return level >= 2 ? { from: e.from, to: e.to } : { from: e.from, to: null };
  }

  /** Remaining solution as verbose moves, applied to the internal board. */
  revealSolution() {
    const out = [];
    this.gaveUp = true;
    while (this.idx < this.moves.length) {
      out.push(this._apply(this.moves[this.idx]));
      this.idx++;
    }
    return out;
  }
}
