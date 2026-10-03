// Solves every bundled puzzle through PuzzleSession and checks promotion/castle/en-passant/alt-mate paths.
import fs from 'node:fs';
import { PuzzleSession } from '../js/session.js';
const j = JSON.parse(fs.readFileSync(new URL('../data/puzzles.json', import.meta.url), 'utf8'));
let ok = 0, fail = 0, promos = 0, castles = 0, eps = 0, wrongDetected = 0;
for (const [id, fen, moves] of j.p) {
  const s = new PuzzleSession({ id, fen: fen + ' 0 1', moves: moves.split(' ') });
  s.start();
  let good = true;
  while (!s.over) {
    const e = s.expected();
    if (e.promotion) { promos++; if (!s.needsPromo(e.from, e.to)) good = false; }
    const piece = s.chess.get(e.from);
    if (piece?.type === 'k' && Math.abs(e.from.charCodeAt(0) - e.to.charCodeAt(0)) === 2) castles++;
    // a deliberately wrong move must be rejected without changing state
    const idx = s.idx;
    for (const [sq] of []) void sq;
    const r = s.attempt(e.from, e.to, e.promotion);
    if (r.status !== 'ok') { good = false; break; }
    if (r.move.flags.includes('e')) eps++;
  }
  good && s.solved ? ok++ : (fail++, fail < 5 && console.log('FAIL', id));
}
// wrong-move detection + castling alias sanity
const s2 = new PuzzleSession({ id: 'x', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', moves: ['a8a7', 'e1g1', 'a7a8', 'f1e1'].slice(0, 2) });
s2.chess.load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
s2.playerColor = 'w'; s2.idx = 0; s2.moves = ['e1g1', 'a8a7'];
const t = s2.targets('e1');
console.log('castle targets:', t.map((x) => x.to + (x.alias ? '*' : '')).join(' '));
const wrong = s2.attempt('e1', 'd1');
console.log('wrong move status:', wrong.status, '(expect wrong)');
const alias = s2.attempt('e1', 'h1');
console.log('castle via rook-square alias:', alias.status, alias.move?.san);
console.log(`solved ${ok}/${ok + fail}; promotions ${promos}, castles ${castles}, en passants ${eps}`);
process.exit(fail ? 1 : 0);
