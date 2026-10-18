import {
  createGame,
  playMove,
  chooseAiMove,
  type GameState,
  type Mark,
} from "./classic.ts";
import {
  createUltimate,
  playUltimate,
  type UltimateMove,
  type UltimateState,
} from "./ultimate.ts";
export type SignatureRule = "ultimate-v1" | "blitz-v1";
export type ReplayRule = "classic-v1" | SignatureRule;
export interface ReplayRecord {
  id: string;
  rule: ReplayRule;
  first: Mark;
  moves: readonly (number | UltimateMove)[];
  result: Mark | "draw" | null;
  source: "local" | "server";
}
const outcomeCache = new Map<string, number>();
function value(game: GameState): number {
  if (game.status !== "playing")
    return game.winner ? (game.winner === game.turn ? 1 : -1) : 0;
  const key = game.board.map((c) => c ?? "-").join("") + game.turn;
  const saved = outcomeCache.get(key);
  if (saved !== undefined) return saved;
  const result = Math.max(
    ...game.board.flatMap((cell, i) =>
      cell === null ? [-value(playMove(game, i))] : [],
    ),
  );
  outcomeCache.set(key, result);
  return result;
}
export function analyzeClassic(game: GameState) {
  const options =
    game.status === "playing"
      ? game.board.flatMap((cell, square) =>
          cell === null
            ? [{ square, score: -value(playMove(game, square)) }]
            : [],
        )
      : [];
  const best =
    (options.length ? Math.max(...options.map((v) => v.score)) : value(game)) ||
    0;
  return {
    score: best,
    options,
    bestMoves: options.filter((v) => v.score === best).map((v) => v.square),
  };
}
export function replayPosition(
  record: ReplayRecord,
  step: number,
): GameState | UltimateState {
  if (!Number.isInteger(step) || step < 0 || step > record.moves.length)
    throw new Error("Invalid replay step");
  if (record.rule === "ultimate-v1")
    return (record.moves as UltimateMove[])
      .slice(0, step)
      .reduce((s, m) => playUltimate(s, m), createUltimate(record.first));
  return (record.moves as number[])
    .slice(0, step)
    .reduce((s, m) => playMove(s, m), createGame(record.first));
}
export function validateReplay(value: unknown): ReplayRecord {
  if (!value || typeof value !== "object") throw new Error("Invalid replay");
  const r = value as ReplayRecord;
  if (
    typeof r.id !== "string" ||
    r.id.length > 100 ||
    !["classic-v1", "ultimate-v1", "blitz-v1"].includes(r.rule) ||
    !["X", "O"].includes(r.first) ||
    !Array.isArray(r.moves) ||
    r.moves.length > (r.rule === "ultimate-v1" ? 81 : 9) ||
    ![null, "X", "O", "draw"].includes(r.result) ||
    !["local", "server"].includes(r.source)
  )
    throw new Error("Invalid replay");
  const final = replayPosition(r, r.moves.length);
  if (final.status !== "playing" && r.result !== (final.winner ?? "draw"))
    throw new Error("Replay result disagrees with moves");
  return r;
}
export interface StrategyPuzzle {
  id: string;
  title: string;
  theme: string;
  seed: readonly number[];
  solver: Mark;
}
export const PUZZLES: readonly StrategyPuzzle[] = [
  {
    id: "row-finish",
    title: "Finish the line",
    theme: "Find a win before your opponent finishes theirs.",
    seed: [0, 3, 1, 4],
    solver: "X",
  },
  {
    id: "diagonal",
    title: "The diagonal",
    theme: "Look across the board.",
    seed: [0, 1, 4, 2],
    solver: "X",
  },
  {
    id: "top-row",
    title: "Take the initiative",
    theme: "A threat can be stronger than a defence.",
    seed: [0, 4, 1, 7],
    solver: "X",
  },
  {
    id: "double-threat",
    title: "Two threats",
    theme: "Create two winning threats with one move.",
    seed: [4, 0, 8, 1],
    solver: "X",
  },
  {
    id: "corner-fork",
    title: "Corner fork",
    theme: "Block and build a fork.",
    seed: [0, 4, 8, 2],
    solver: "X",
  },
  {
    id: "center-diagonal",
    title: "Through the centre",
    theme: "Find the immediate finish.",
    seed: [0, 3, 4, 1],
    solver: "X",
  },
  {
    id: "cross-diagonal",
    title: "Cross the board",
    theme: "A winning move can also defend.",
    seed: [2, 0, 4, 3],
    solver: "X",
  },
];
export function puzzleStart(p: StrategyPuzzle) {
  return p.seed.reduce((g, m) => playMove(g, m), createGame());
}
export function dailyPuzzle(day: string): StrategyPuzzle {
  const date = Date.parse(day + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(date) ||
    new Date(date).toISOString().slice(0, 10) !== day
  )
    throw new Error("Invalid puzzle date");
  const n = Math.floor((date - Date.parse("2026-10-10T00:00:00Z")) / 86400000);
  return PUZZLES[((n % PUZZLES.length) + PUZZLES.length) % PUZZLES.length];
}
export function playPuzzle(
  p: StrategyPuzzle,
  game: GameState,
  square: number,
): GameState {
  if (game.turn !== p.solver) throw new Error("Wait for the puzzle reply");
  let next = playMove(game, square);
  if (next.status === "playing") {
    const reply = chooseAiMove(next, "hard");
    if (reply !== null) next = playMove(next, reply);
  }
  return next;
}
export function verifyPuzzle(
  p: StrategyPuzzle,
  moves: readonly number[],
): GameState {
  if (
    !Array.isArray(moves) ||
    moves.length > 9 ||
    JSON.stringify(moves.slice(0, p.seed.length)) !== JSON.stringify(p.seed)
  )
    throw new Error("Invalid puzzle proof");
  let game = puzzleStart(p),
    step = p.seed.length;
  while (step < moves.length) {
    const next = playPuzzle(p, game, moves[step]);
    if (
      JSON.stringify(next.moves) !==
      JSON.stringify(moves.slice(0, next.moves.length))
    )
      throw new Error("Invalid puzzle reply");
    game = next;
    step = game.moves.length;
  }
  if (game.winner !== p.solver) throw new Error("Puzzle is not solved");
  return game;
}
