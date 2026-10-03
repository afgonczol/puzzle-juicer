// Sanity check: every bundled puzzle loads and its full solution is legal; solution ends on the player's move.
import fs from 'node:fs';
import { Chess } from '../js/vendor/chess.js';
const j = JSON.parse(fs.readFileSync(new URL('../data/puzzles.json', import.meta.url), 'utf8'));
let bad = 0, mates = 0;
const keep = [];
for (const row of j.p) {
  const [id, fen, moves] = row;
  try {
    const c = new Chess(fen + ' 0 1');
    const ms = moves.split(' ');
    if (ms.length % 2 !== 0) throw new Error('odd length');
    for (const u of ms) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    if (c.isCheckmate()) mates++;
    keep.push(row);
  } catch (e) { bad++; if (bad < 10) console.log('bad', id, e.message); }
}
console.log(`ok ${keep.length}/${j.p.length}, bad ${bad}, ending in mate ${mates}`);
if (bad && process.argv[2] === '--fix') { j.p = keep; fs.writeFileSync(new URL('../data/puzzles.json', import.meta.url), JSON.stringify(j)); console.log('rewrote without bad puzzles'); }
