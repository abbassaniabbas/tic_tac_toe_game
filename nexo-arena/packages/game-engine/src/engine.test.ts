import { describe, expect, it } from 'vitest';
import { WINNING_LINES, evaluate, createGame, playMove, chooseAiMove, legalMoves, otherMark, createSession, sessionReducer, canUndo, type GameState, type Mark, type Cell } from './index';

function sequence(moves: number[], first: Mark = 'X') {
  return moves.reduce((game, move) => playMove(game, move), createGame(first));
}
describe('classic rules', () => {
  for (const mark of ['X', 'O'] as const) {
    WINNING_LINES.forEach((line, index) => it(`${mark} wins on line ${index + 1}`, () => {
      const board: Cell[] = Array(9).fill(null); line.forEach(i => board[i] = mark);
      expect(evaluate(board)).toEqual({ winner: mark, status: 'won', winningLine: [...line] });
    }));
  }
  it('detects a draw only when full with no winner', () => {
    expect(sequence([0, 1, 2, 4, 3, 5, 7, 6, 8]).status).toBe('draw');
    expect(createGame().status).toBe('playing');
  });
  it('a full winning board is not a draw', () => expect(evaluate(['X','O','X','O','X','O','X','X','O']).status).toBe('won'));
  it.each([-1, 9, 1.5, NaN])('rejects out-of-range index %s', index => expect(() => playMove(createGame(), index)).toThrow('range'));
  it('rejects occupied squares and preserves the previous state', () => {
    const first = createGame(); const next = playMove(first, 0);
    expect(() => playMove(next, 0)).toThrow('occupied'); expect(first.board[0]).toBeNull();
  });
  it('validates turn ownership and alternates turns', () => {
    expect(() => playMove(createGame(), 0, 'O')).toThrow('turn');
    expect(sequence([0, 1]).turn).toBe('X');
    expect(playMove(createGame('O'), 4).turn).toBe('X');
  });
  it('stops accepting moves after a win or draw', () => {
    expect(() => playMove(sequence([0, 3, 1, 4, 2]), 5)).toThrow('finished');
    expect(() => playMove(sequence([0, 1, 2, 4, 3, 5, 7, 6, 8]), 0)).toThrow('finished');
  });
});
describe('AI', () => {
  it('Easy samples legal moves', () => {
    const game = sequence([0]);
    expect(chooseAiMove(game, 'easy', () => 0)).toBe(1);
    expect(chooseAiMove(game, 'easy', () => 0.99)).toBe(8);
  });
  it('Medium takes an immediate win', () => expect(chooseAiMove(sequence([0, 3, 1, 4, 8]), 'medium', () => 0)).toBe(5));
  it('Medium blocks a threat in its tactical branch', () => expect(chooseAiMove(sequence([0, 4, 1]), 'medium', () => 0.9)).toBe(2));
  it('Medium exploration can leave an immediate threat unblocked', () => {
    const draws = [0.1, 0.99];
    expect(chooseAiMove(sequence([0, 4, 1]), 'medium', () => draws.shift()!)).toBe(8);
  });
  it('all difficulties return null on a finished board', () => {
    for (const level of ['easy','medium','hard'] as const) expect(chooseAiMove(sequence([0, 3, 1, 4, 2]), level)).toBeNull();
  });
  for (const first of ['X', 'O'] as const) for (const ai of ['X', 'O'] as const) {
    it(`Hard never loses: AI ${ai}, ${first} first, every possible opponent continuation`, () => {
      const visited = new Set<string>(); let terminal = 0;
      function walk(game: GameState) {
        const key = game.board.map(c => c ?? '-').join('');
        if (visited.has(key)) return; visited.add(key);
        if (game.status !== 'playing') { expect(game.winner).not.toBe(otherMark(ai)); terminal++; return; }
        if (game.turn === ai) walk(playMove(game, chooseAiMove(game, 'hard')!));
        else for (const move of legalMoves(game.board)) walk(playMove(game, move));
      }
      walk(createGame(first)); expect(terminal).toBeGreaterThan(10);
    });
  }
});
describe('session lifecycle', () => {
  it('records one result, preserves scores on rematch and resets the board', () => {
    let session = createSession({ mode: 'local', difficulty: 'hard', humanMark: 'X', firstMark: 'X' });
    for (const index of [0, 3, 1, 4, 2]) session = sessionReducer(session, { type: 'move', index });
    expect(session.score.X).toBe(1); expect(canUndo(session)).toBe(false);
    expect(() => sessionReducer(session, { type: 'move', index: 5 })).toThrow('finished');
    const next = sessionReducer(session, { type: 'rematch' });
    expect(next.score.X).toBe(1); expect(next.game.moves).toHaveLength(0); expect(next.round).toBe(2);
  });
  it('restart removes a discarded round result', () => {
    let session = createSession();
    for (const index of [0, 3, 1, 4, 2]) session = sessionReducer(session, { type: 'move', index });
    session = sessionReducer(session, { type: 'restart' });
    expect(session.score.X).toBe(0); expect(session.game.status).toBe('playing');
  });
  it('local undo removes one move', () => {
    let session = createSession({ mode: 'local', difficulty: 'easy', humanMark: 'X', firstMark: 'X' });
    session = sessionReducer(session, { type: 'move', index: 4 });
    expect(sessionReducer(session, { type: 'undo' }).game).toEqual(createGame());
  });
  it('AI undo removes the human move and response', () => {
    let session = createSession();
    for (const index of [0, 4]) session = sessionReducer(session, { type: 'move', index });
    expect(sessionReducer(session, { type: 'undo' }).game).toEqual(createGame());
  });
  it('AI undo during thinking removes just the pending human move', () => {
    const session = sessionReducer(createSession(), { type: 'move', index: 0 });
    expect(sessionReducer(session, { type: 'undo' }).game.moves).toHaveLength(0);
  });
  it('the AI opening alone cannot be undone', () => {
    const session = sessionReducer(createSession({ mode: 'ai', difficulty: 'hard', humanMark: 'O', firstMark: 'X' }), { type: 'move', index: 4 });
    expect(canUndo(session)).toBe(false);
  });
  it('new configuration resets scores, marks and starting player', () => {
    const session = sessionReducer(createSession(), { type: 'configure', config: { mode: 'local', humanMark: 'O', firstMark: 'O', difficulty: 'easy' } });
    expect(session.game.turn).toBe('O'); expect(session.score).toEqual({ X: 0, O: 0, draws: 0 });
  });
});
