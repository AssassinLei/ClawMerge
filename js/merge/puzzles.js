// Boards are authored and solved offline; loading a level never runs a search.
const LEVELS = require('./rescue-levels');
const RESCUE_RULES = {version: 2, energyCost: 30};
function randomFor(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function neighbors(index) { return [index - 4, index + 4, index % 4 ? index - 1 : -1, index % 4 < 3 ? index + 1 : -1].filter(i => i >= 0 && i < 16); }
// One directional swipe moves one adjacent cell, even when the finger travels farther.
function swipeTarget(from, dx, dy, cellSize) {
  if (!Number.isInteger(from) || from < 0 || from >= 16 || !Number.isFinite(dx) || !Number.isFinite(dy) || !(cellSize > 0)) return -1;
  const x = Math.abs(dx), y = Math.abs(dy), threshold = Math.max(10, Math.min(18, cellSize * .2));
  if (Math.max(x, y) < threshold) return -1;
  if (x > y * 1.15) { const column = from % 4; return dx < 0 ? column > 0 ? from - 1 : -1 : column < 3 ? from + 1 : -1; }
  if (y > x * 1.15) return dy < 0 ? from >= 4 ? from - 4 : -1 : from < 12 ? from + 4 : -1;
  return -1;
}
function makePuzzle(level) {
  const def = LEVELS[level - 1];
  if (!Number.isInteger(level) || !def) throw new Error('Invalid rescue level');
  return {...def, revision: RESCUE_RULES.version, board: def.board.slice(), solution: def.solution.map(move => ({...move}))};
}
function puzzleMove(session, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= 16 || to >= 16 ||
      session.won || session.moves >= session.limit || !neighbors(from).includes(to)) return {ok: false, reason: 'adjacent'};
  const a = session.board[from], b = session.board[to];
  if (a <= 0 || b < 0 || (b > 0 && a !== b)) return {ok: false, reason: 'blocked'};
  if (b === a && a >= session.target) return {ok: false, reason: 'max'};
  session.board[to] = b === a ? a + 1 : a; session.board[from] = 0; session.moves++;
  const won = session.board[session.goal] === session.target && session.board.filter(v => v > 0).length === 1;
  session.won = won;
  return {ok: true, kind: b === a ? 'merge' : 'move', won, failed: !won && session.moves >= session.limit};
}

module.exports = {makePuzzle, puzzleMove, neighbors, swipeTarget, randomFor, RESCUE_RULES};
