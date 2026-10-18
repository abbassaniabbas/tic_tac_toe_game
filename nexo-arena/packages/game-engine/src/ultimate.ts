import {
  evaluate,
  otherMark,
  WINNING_LINES,
  type Board,
  type Mark,
  type Status,
  type RuleSet,
} from "./classic.ts";
export interface UltimateMove {
  board: number;
  cell: number;
}
export interface UltimateState {
  boards: readonly Board[];
  claims: readonly (Mark | "draw" | null)[];
  first: Mark;
  turn: Mark;
  status: Status;
  winner: Mark | null;
  winningLine: readonly number[] | null;
  forcedBoard: number | null;
  moves: readonly UltimateMove[];
}
export function createUltimate(first: Mark = "X"): UltimateState {
  return {
    boards: Array.from({ length: 9 }, () => Array(9).fill(null)),
    claims: Array(9).fill(null),
    first,
    turn: first,
    status: "playing",
    winner: null,
    winningLine: null,
    forcedBoard: null,
    moves: [],
  };
}
export function ultimateMoves(state: UltimateState): UltimateMove[] {
  if (state.status !== "playing") return [];
  return state.boards.flatMap((board, b) =>
    state.claims[b] === null &&
    (state.forcedBoard === null || state.forcedBoard === b)
      ? board.flatMap((v, c) => (v === null ? [{ board: b, cell: c }] : []))
      : [],
  );
}
export function playUltimate(
  state: UltimateState,
  move: UltimateMove,
  mark: Mark = state.turn,
): UltimateState {
  if (state.status !== "playing") throw new Error("Match finished");
  if (
    !move ||
    ![move.board, move.cell].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 8,
    )
  )
    throw new Error("Invalid Ultimate square");
  if (mark !== state.turn) throw new Error("Wrong turn");
  if (
    state.claims[move.board] !== null ||
    (state.forcedBoard !== null && move.board !== state.forcedBoard)
  )
    throw new Error("Play in the required board");
  if (state.boards[move.board][move.cell] !== null)
    throw new Error("Occupied square");
  const board = [...state.boards[move.board]];
  board[move.cell] = mark;
  const boards = state.boards.map((b, i) => (i === move.board ? board : b)),
    claims = [...state.claims];
  const local = evaluate(board);
  claims[move.board] =
    local.winner ?? (local.status === "draw" ? "draw" : null);
  const line = WINNING_LINES.find(
    (l) =>
      claims[l[0]] !== null &&
      claims[l[0]] !== "draw" &&
      l.every((i) => claims[i] === claims[l[0]]),
  );
  const winner = line ? (claims[line[0]] as Mark) : null;
  return {
    ...state,
    boards,
    claims,
    turn: otherMark(mark),
    winner,
    winningLine: line ? [...line] : null,
    status: winner
      ? "won"
      : claims.every((c) => c !== null)
        ? "draw"
        : "playing",
    forcedBoard: claims[move.cell] === null ? move.cell : null,
    moves: [...state.moves, { ...move }],
  };
}
export const ultimateRules: RuleSet<UltimateState, UltimateMove> = {
  id: "ultimate-v1",
  create: createUltimate,
  legalMoves: ultimateMoves,
  apply: playUltimate,
  outcome: (s) => ({ finished: s.status !== "playing", winner: s.winner }),
};
