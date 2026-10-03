// Human-friendly names + explanations for Lichess puzzle themes.
import { titleCase } from './util.js';

// cat: 'tactic' | 'mate' | 'endgame' | 'meta'
export const THEMES = {
  mateIn1: { name: 'Mate in 1', emoji: '1️⃣', cat: 'mate', desc: 'Deliver checkmate in one move.' },
  mateIn2: { name: 'Mate in 2', emoji: '2️⃣', cat: 'mate', desc: 'Deliver checkmate in two moves.' },
  mateIn3: { name: 'Mate in 3', emoji: '3️⃣', cat: 'mate', desc: 'Deliver checkmate in three moves.' },
  mateIn4: { name: 'Mate in 4', emoji: '4️⃣', cat: 'mate', desc: 'Deliver checkmate in four moves.' },
  mateIn5: { name: 'Mate in 5+', emoji: '5️⃣', cat: 'mate', desc: 'A long forced mate. Calculate carefully!' },
  fork: { name: 'Fork', emoji: '🍴', cat: 'tactic', desc: 'One piece attacks two or more enemy pieces at once.' },
  pin: { name: 'Pin', emoji: '📌', cat: 'tactic', desc: 'A piece can\'t move without exposing something more valuable behind it.' },
  skewer: { name: 'Skewer', emoji: '🍢', cat: 'tactic', desc: 'A valuable piece is forced to move, exposing a piece behind it.' },
  discoveredAttack: { name: 'Discovered Attack', emoji: '🎭', cat: 'tactic', desc: 'Moving one piece uncovers an attack from another.' },
  discoveredCheck: { name: 'Discovered Check', emoji: '👀', cat: 'tactic', desc: 'Moving a piece reveals a check from another piece.' },
  doubleCheck: { name: 'Double Check', emoji: '✌️', cat: 'tactic', desc: 'Two pieces give check at the same time.' },
  hangingPiece: { name: 'Hanging Piece', emoji: '🎈', cat: 'tactic', desc: 'An undefended or insufficiently defended piece is up for grabs.' },
  sacrifice: { name: 'Sacrifice', emoji: '💎', cat: 'tactic', desc: 'Give up material now for a bigger payoff later.' },
  deflection: { name: 'Deflection', emoji: '↪️', cat: 'tactic', desc: 'Lure a defender away from its important duty.' },
  attraction: { name: 'Attraction', emoji: '🧲', cat: 'tactic', desc: 'Force a piece onto a bad square where it can be exploited.' },
  clearance: { name: 'Clearance', emoji: '🧹', cat: 'tactic', desc: 'Move a piece out of the way to open a line or square.' },
  interference: { name: 'Interference', emoji: '🚧', cat: 'tactic', desc: 'Block the line between two enemy pieces.' },
  intermezzo: { name: 'Intermezzo', emoji: '⏱️', cat: 'tactic', desc: 'An in-between move that changes everything before the expected reply.' },
  quietMove: { name: 'Quiet Move', emoji: '🤫', cat: 'tactic', desc: 'A calm move that sets up an unstoppable threat.' },
  xRayAttack: { name: 'X-Ray', emoji: '🩻', cat: 'tactic', desc: 'A piece attacks or defends through an enemy piece.' },
  zugzwang: { name: 'Zugzwang', emoji: '🔒', cat: 'tactic', desc: 'Every legal move makes the opponent\'s position worse.' },
  trappedPiece: { name: 'Trapped Piece', emoji: '🪤', cat: 'tactic', desc: 'A piece has no safe escape squares.' },
  capturingDefender: { name: 'Capture the Defender', emoji: '🗡️', cat: 'tactic', desc: 'Remove the piece that is guarding something important.' },
  defensiveMove: { name: 'Defensive Move', emoji: '🛡️', cat: 'tactic', desc: 'Find the precise move that holds the position together.' },
  exposedKing: { name: 'Exposed King', emoji: '👑', cat: 'tactic', desc: 'A king with few defenders is ripe for attack.' },
  advancedPawn: { name: 'Advanced Pawn', emoji: '🚀', cat: 'tactic', desc: 'A far-advanced pawn is about to promote.' },
  promotion: { name: 'Promotion', emoji: '⭐', cat: 'tactic', desc: 'Push a pawn to the final rank and crown a new piece.' },
  underPromotion: { name: 'Underpromotion', emoji: '🐴', cat: 'tactic', desc: 'Promote to a knight, bishop or rook instead of a queen.' },
  enPassant: { name: 'En Passant', emoji: '👻', cat: 'tactic', desc: 'The special pawn capture that\'s easy to forget.' },
  castling: { name: 'Castling', emoji: '🏰', cat: 'tactic', desc: 'Castling is the key to the solution.' },
  attackingF2F7: { name: 'Attacking f2/f7', emoji: '🎯', cat: 'tactic', desc: 'The classic weak points next to the king.' },
  kingsideAttack: { name: 'Kingside Attack', emoji: '➡️', cat: 'tactic', desc: 'Attack the king on the kingside.' },
  queensideAttack: { name: 'Queenside Attack', emoji: '⬅️', cat: 'tactic', desc: 'Attack the king on the queenside.' },
  collinearMove: { name: 'Collinear Move', emoji: '📏', cat: 'tactic', desc: 'A move along a line with a surprising point.' },
  backRankMate: { name: 'Back-Rank Mate', emoji: '🧱', cat: 'mate', desc: 'Checkmate on the back rank, with the king hemmed in by its own pawns.' },
  smotheredMate: { name: 'Smothered Mate', emoji: '🐴', cat: 'mate', desc: 'A knight mates a king surrounded by its own pieces.' },
  anastasiaMate: { name: 'Anastasia\'s Mate', emoji: '💘', cat: 'mate', desc: 'Knight and rook trap a king against the edge.' },
  arabianMate: { name: 'Arabian Mate', emoji: '🕌', cat: 'mate', desc: 'Knight and rook trap a king in the corner.' },
  bodenMate: { name: 'Boden\'s Mate', emoji: '❌', cat: 'mate', desc: 'Two criss-crossing bishops deliver mate.' },
  doubleBishopMate: { name: 'Double Bishop Mate', emoji: '⛪', cat: 'mate', desc: 'Two bishops on adjacent diagonals deliver mate.' },
  dovetailMate: { name: 'Dovetail Mate', emoji: '🕊️', cat: 'mate', desc: 'A queen mates, supported by a diagonal neighbour.' },
  hookMate: { name: 'Hook Mate', emoji: '🪝', cat: 'mate', desc: 'Rook, knight and pawn combine for mate.' },
  operaMate: { name: 'Opera Mate', emoji: '🎭', cat: 'mate', desc: 'A famous mate with a bishop and rook.' },
  pillsburysMate: { name: 'Pillsbury\'s Mate', emoji: '🥖', cat: 'mate', desc: 'Rook and bishop deliver mate.' },
  morphysMate: { name: 'Morphy\'s Mate', emoji: '🎩', cat: 'mate', desc: 'Bishop and rook mate against a castled king.' },
  epauletteMate: { name: 'Epaulette Mate', emoji: '🎖️', cat: 'mate', desc: 'The king\'s own rooks block its escape.' },
  cornerMate: { name: 'Corner Mate', emoji: '📐', cat: 'mate', desc: 'Checkmate in the corner.' },
  mate: { name: 'Checkmate', emoji: '♚', cat: 'mate', desc: 'The goal: checkmate.' },
  pawnEndgame: { name: 'Pawn Endgame', emoji: '♟️', cat: 'endgame', desc: 'Only kings and pawns left.' },
  rookEndgame: { name: 'Rook Endgame', emoji: '♜', cat: 'endgame', desc: 'Rooks and pawns.' },
  bishopEndgame: { name: 'Bishop Endgame', emoji: '♝', cat: 'endgame', desc: 'Bishops and pawns.' },
  knightEndgame: { name: 'Knight Endgame', emoji: '♞', cat: 'endgame', desc: 'Knights and pawns.' },
  queenEndgame: { name: 'Queen Endgame', emoji: '♛', cat: 'endgame', desc: 'Queens and pawns.' },
  queenRookEndgame: { name: 'Queen + Rook Endgame', emoji: '👸', cat: 'endgame', desc: 'Queens, rooks and pawns.' },
  endgame: { name: 'Endgame', emoji: '🏁', cat: 'endgame', desc: 'Few pieces left on the board.' },
  middlegame: { name: 'Middlegame', emoji: '⚔️', cat: 'meta', desc: 'The tactic happens in the middlegame.' },
  opening: { name: 'Opening', emoji: '🚪', cat: 'meta', desc: 'The tactic happens in the opening.' },
  advantage: { name: 'Advantage', emoji: '📈', cat: 'meta', desc: 'Convert a good position into a winning one.' },
  crushing: { name: 'Crushing', emoji: '💥', cat: 'meta', desc: 'Spot the blunder and take a winning advantage.' },
  equality: { name: 'Equality', emoji: '⚖️', cat: 'meta', desc: 'Fight back from a worse position to equality.' },
  oneMove: { name: 'One-Move', emoji: '☝️', cat: 'meta', desc: 'Just a single move to find.' },
  short: { name: 'Short', emoji: '⚡', cat: 'meta', desc: 'Two moves to win.' },
  long: { name: 'Long', emoji: '🧵', cat: 'meta', desc: 'Three moves to win.' },
  veryLong: { name: 'Very Long', emoji: '🐍', cat: 'meta', desc: 'Four or more moves to win.' },
  master: { name: 'Master Game', emoji: '🎓', cat: 'meta', desc: 'From a game by a titled player.' },
  masterVsMaster: { name: 'Master vs Master', emoji: '🥋', cat: 'meta', desc: 'From a game between two titled players.' },
  superGM: { name: 'Super GM Game', emoji: '🌟', cat: 'meta', desc: 'From a game by a top grandmaster.' },
};

export const themeInfo = (t) => THEMES[t] || { name: titleCase(t), emoji: '🧩', cat: 'meta', desc: '' };
export const themeName = (t) => themeInfo(t).name;

/** Themes worth surfacing as chips after a puzzle (skip pure meta noise). */
export const displayThemes = (list) => {
  const main = list.filter((t) => themeInfo(t).cat !== 'meta');
  const meta = list.filter((t) => ['opening', 'middlegame', 'endgame', 'crushing', 'advantage', 'equality'].includes(t));
  return [...new Set([...main, ...meta])].slice(0, 6);
};

/** Picker order for Training mode. */
export const TRAINING_THEMES = [
  'mateIn1', 'mateIn2', 'mateIn3', 'fork', 'pin', 'skewer', 'discoveredAttack', 'hangingPiece', 'sacrifice',
  'deflection', 'attraction', 'backRankMate', 'smotheredMate', 'trappedPiece', 'capturingDefender', 'clearance',
  'quietMove', 'intermezzo', 'xRayAttack', 'zugzwang', 'defensiveMove', 'exposedKing', 'advancedPawn', 'promotion',
  'underPromotion', 'enPassant', 'doubleCheck', 'interference', 'pawnEndgame', 'rookEndgame', 'bishopEndgame',
  'knightEndgame', 'queenEndgame', 'opening', 'middlegame', 'endgame',
];
