export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Difficulty = "easy" | "medium" | "hard";
export type Mode = "ai" | "local";
export type Status = "playing" | "won" | "draw";
export type Board = readonly Cell[];
export const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export interface GameState {
  readonly board: Board;
  readonly first: Mark;
  readonly turn: Mark;
  readonly status: Status;
  readonly winner: Mark | null;
  readonly winningLine: readonly number[] | null;
  readonly moves: readonly number[];
}
export interface GameConfig {
  mode: Mode;
  difficulty: Difficulty;
  humanMark: Mark;
  firstMark: Mark;
}
export interface Score {
  X: number;
  O: number;
  draws: number;
}
export interface Session {
  game: GameState;
  config: GameConfig;
  score: Score;
  round: number;
}
export const DEFAULT_CONFIG: GameConfig = {
  mode: "ai",
  difficulty: "medium",
  humanMark: "X",
  firstMark: "X",
};
export const otherMark = (mark: Mark): Mark => (mark === "X" ? "O" : "X");
export const legalMoves = (board: Board): number[] =>
  board.flatMap((cell, i) => (cell === null ? [i] : []));

export function evaluate(
  board: Board,
): Pick<GameState, "winner" | "winningLine" | "status"> {
  for (const line of WINNING_LINES) {
    if (board[line[0]] && line.every((i) => board[i] === board[line[0]])) {
      return { winner: board[line[0]], winningLine: [...line], status: "won" };
    }
  }
  return {
    winner: null,
    winningLine: null,
    status: board.every((cell) => cell !== null) ? "draw" : "playing",
  };
}
export function createGame(first: Mark = "X"): GameState {
  return {
    board: Array<Cell>(9).fill(null),
    first,
    turn: first,
    moves: [],
    winner: null,
    winningLine: null,
    status: "playing",
  };
}
export class InvalidMoveError extends Error {
  constructor(
    public readonly code: "range" | "occupied" | "turn" | "finished",
  ) {
    super(`Invalid move: ${code}`);
  }
}
export function playMove(
  game: GameState,
  index: number,
  mark: Mark = game.turn,
): GameState {
  if (game.status !== "playing") throw new InvalidMoveError("finished");
  if (!Number.isInteger(index) || index < 0 || index > 8)
    throw new InvalidMoveError("range");
  if (mark !== game.turn) throw new InvalidMoveError("turn");
  if (game.board[index] !== null) throw new InvalidMoveError("occupied");
  const board = [...game.board];
  board[index] = mark;
  return {
    ...game,
    board,
    turn: otherMark(mark),
    moves: [...game.moves, index],
    ...evaluate(board),
  };
}

function minimax(
  board: Board,
  turn: Mark,
  ai: Mark,
  depth: number,
  cache: Map<string, number>,
): number {
  const outcome = evaluate(board);
  if (outcome.winner) return outcome.winner === ai ? 10 - depth : depth - 10;
  if (outcome.status === "draw") return 0;
  const key = `${board.map((c) => c ?? "-").join("")}:${turn}`;
  const known = cache.get(key);
  if (known !== undefined) return known;
  const values = legalMoves(board).map((index) => {
    const next = [...board];
    next[index] = turn;
    return minimax(next, otherMark(turn), ai, depth + 1, cache);
  });
  const value = turn === ai ? Math.max(...values) : Math.min(...values);
  cache.set(key, value);
  return value;
}
function randomChoice(moves: number[], random: () => number): number {
  return moves[
    Math.min(moves.length - 1, Math.max(0, Math.floor(random() * moves.length)))
  ];
}
function immediateMove(board: Board, mark: Mark): number | undefined {
  return legalMoves(board).find((index) => {
    const next = [...board];
    next[index] = mark;
    return evaluate(next).winner === mark;
  });
}
export function chooseAiMove(
  game: GameState,
  difficulty: Difficulty,
  random: () => number = Math.random,
): number | null {
  if (game.status !== "playing") return null;
  const moves = legalMoves(game.board);
  if (difficulty === "easy") return randomChoice(moves, random);
  if (difficulty === "medium") {
    const win = immediateMove(game.board, game.turn);
    if (win !== undefined) return win;
    // Occasional exploration makes Medium beatable while retaining basic tactics.
    if (random() < 0.2) return randomChoice(moves, random);
    const block = immediateMove(game.board, otherMark(game.turn));
    if (block !== undefined) return block;
    if (game.board[4] === null) return 4;
    const corners = moves.filter((i) => [0, 2, 6, 8].includes(i));
    return randomChoice(corners.length ? corners : moves, random);
  }
  const cache = new Map<string, number>();
  const scored = moves.map((index) => {
    const next = [...game.board];
    next[index] = game.turn;
    return {
      index,
      value: minimax(next, otherMark(game.turn), game.turn, 0, cache),
    };
  });
  const best = Math.max(...scored.map((move) => move.value));
  // Prefer the center and corners when equally optimal, for a natural opening.
  return [4, 0, 2, 6, 8, 1, 3, 5, 7].find((index) =>
    scored.some((move) => move.index === index && move.value === best),
  )!;
}
export function createSession(
  config: GameConfig = DEFAULT_CONFIG,
  score: Score = { X: 0, O: 0, draws: 0 },
): Session {
  return {
    config: { ...config },
    game: createGame(config.firstMark),
    score: { ...score },
    round: score.X + score.O + score.draws + 1,
  };
}
export function canUndo(session: Session): boolean {
  if (session.game.status !== "playing") return false;
  if (session.config.mode === "local") return session.game.moves.length > 0;
  return session.game.moves.some(
    (_, i) =>
      (i % 2 === 0 ? session.game.first : otherMark(session.game.first)) ===
      session.config.humanMark,
  );
}
export type SessionAction =
  | { type: "move"; index: number }
  | { type: "undo" }
  | { type: "rematch" }
  | { type: "restart" }
  | { type: "resetScore" }
  | { type: "configure"; config: GameConfig }
  | { type: "restore"; session: Session };
export function sessionReducer(
  session: Session,
  action: SessionAction,
): Session {
  switch (action.type) {
    case "move": {
      const game = playMove(session.game, action.index);
      const score = { ...session.score };
      if (game.winner) score[game.winner] += 1;
      else if (game.status === "draw") score.draws += 1;
      return { ...session, game, score };
    }
    case "undo": {
      if (!canUndo(session)) return session;
      const moves = session.game.moves;
      let remove = 1;
      if (session.config.mode === "ai") {
        const lastMark =
          moves.length % 2 === 1
            ? session.game.first
            : otherMark(session.game.first);
        remove = lastMark === session.config.humanMark ? 1 : 2;
      }
      const game = moves
        .slice(0, -remove)
        .reduce(
          (state, index) => playMove(state, index),
          createGame(session.game.first),
        );
      return { ...session, game };
    }
    case "restart": {
      const score = { ...session.score };
      if (session.game.winner) score[session.game.winner] -= 1;
      else if (session.game.status === "draw") score.draws -= 1;
      return { ...session, score, game: createGame(session.config.firstMark) };
    }
    case "rematch":
      return {
        ...session,
        game: createGame(session.config.firstMark),
        round: session.round + 1,
      };
    case "resetScore":
      return createSession(session.config);
    case "configure":
      return createSession(action.config);
    case "restore":
      return action.session;
  }
}

// Future rule sets own their state and validators; Classic never branches on variants.
export interface RuleSet<State, Move> {
  id: string;
  create: () => State;
  legalMoves: (state: State) => readonly Move[];
  apply: (state: State, move: Move) => State;
  outcome: (state: State) => { finished: boolean; winner: Mark | null };
}
export const classicRules: RuleSet<GameState, number> = {
  id: "classic-v1",
  create: createGame,
  legalMoves: (state) =>
    state.status === "playing" ? legalMoves(state.board) : [],
  apply: playMove,
  outcome: (state) => ({
    finished: state.status !== "playing",
    winner: state.winner,
  }),
};
