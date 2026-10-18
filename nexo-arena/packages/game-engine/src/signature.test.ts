import { describe, it, expect } from "vitest";
import {
  createUltimate,
  playUltimate,
  ultimateMoves,
  WINNING_LINES,
  PUZZLES,
  puzzleStart,
  playPuzzle,
  verifyPuzzle,
  analyzeClassic,
  dailyPuzzle,
  createGame,
  playMove,
  replayPosition,
  validateReplay,
  type UltimateState,
  type Mark,
} from "./index";
describe("Ultimate rules", () => {
  it("routes the next player and rejects wrong-board, occupied and terminal moves", () => {
    const g = playUltimate(createUltimate(), { board: 4, cell: 2 });
    expect(g.forcedBoard).toBe(2);
    expect(g.turn).toBe("O");
    expect(ultimateMoves(g)).toHaveLength(9);
    expect(() => playUltimate(g, { board: 3, cell: 0 })).toThrow();
    expect(() => playUltimate(g, { board: 2, cell: 10 })).toThrow();
    expect(() => playUltimate(g, { board: 2, cell: 0 }, "X")).toThrow();
    const a = playUltimate(g, { board: 2, cell: 4 });
    expect(() => playUltimate(a, { board: 4, cell: 2 })).toThrow("Occupied");
    expect(createUltimate().moves).toEqual([]);
  });
  it.each(WINNING_LINES)("recognizes each meta winning line %s", (a, b, c) => {
    const g = createUltimate();
    const claims = [...g.claims];
    claims[a] = "X";
    claims[b] = "X";
    const boards = g.boards.map((v, i) =>
      i === c
        ? ([
            "X",
            "X",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
          ] as (Mark | null)[])
        : v,
    );
    const won = playUltimate({ ...g, claims, boards }, { board: c, cell: 2 });
    expect(won.winner).toBe("X");
    expect(won.status).toBe("won");
    expect(() => playUltimate(won, { board: 0, cell: 0 })).toThrow("finished");
  });
  it("releases routing when sent to a won/drawn board and never reopens it", () => {
    const g = createUltimate(),
      claims = [...g.claims];
    claims[2] = "draw";
    const next = playUltimate({ ...g, claims }, { board: 4, cell: 2 });
    expect(next.forcedBoard).toBeNull();
    expect(ultimateMoves(next).every((m) => m.board !== 2)).toBe(true);
  });
  it("draws when all subboards close without a meta line", () => {
    const g = createUltimate();
    const claims: UltimateState["claims"] = [
      "X",
      "O",
      "X",
      "X",
      "O",
      "O",
      "O",
      "X",
      null,
    ];
    const boards = g.boards.map((v, i) =>
      i === 8
        ? (["X", "O", "X", "X", "O", "O", "O", "X", null] as (Mark | null)[])
        : v,
    );
    expect(
      playUltimate({ ...g, claims, boards }, { board: 8, cell: 8 }).status,
    ).toBe("draw");
  });
  it("reconstructs a complete legal game from accepted moves without mutation", () => {
    let g = createUltimate();
    for (let i = 0; i < 81 && g.status === "playing"; i++) {
      const moves = ultimateMoves(g);
      g = playUltimate(g, moves[(i * 7) % moves.length]);
    }
    const record = {
      id: "local",
      rule: "ultimate-v1" as const,
      first: "X" as const,
      moves: g.moves,
      result: g.winner ?? ("draw" as const),
      source: "local" as const,
    };
    expect(replayPosition(validateReplay(record), g.moves.length)).toEqual(g);
  });
});
describe("curated daily puzzles and exact Classic analysis", () => {
  it.each(PUZZLES)("has a valid forced-win solution: $id", (p) => {
    let g = puzzleStart(p);
    expect(g.turn).toBe(p.solver);
    expect(analyzeClassic(g).score).toBe(1);
    while (g.status === "playing")
      g = playPuzzle(p, g, analyzeClassic(g).bestMoves[0]);
    expect(g.winner).toBe(p.solver);
    expect(verifyPuzzle(p, g.moves)).toEqual(g);
    expect(() => verifyPuzzle(p, p.seed)).toThrow();
    expect(() => verifyPuzzle(p, [...p.seed, 9])).toThrow();
  });
  it("uses a documented seven-puzzle UTC cycle and rejects invalid dates", () => {
    expect(dailyPuzzle("2026-10-10").id).toBe(PUZZLES[0].id);
    expect(dailyPuzzle("2026-10-17")).toBe(dailyPuzzle("2026-10-10"));
    expect(() => dailyPuzzle("2026-02-30")).toThrow();
  });
  it("finds forks and distinguishes losing from drawing continuations", () => {
    const g = [0, 4, 8, 2].reduce((s, m) => playMove(s, m), createGame());
    expect(analyzeClassic(g).bestMoves).toContain(6);
    expect(analyzeClassic(createGame()).score).toBe(0);
  });
  it("rejects tampered replay outcomes, duplicate moves and out-of-range steps", () => {
    const r = {
      id: "example",
      rule: "classic-v1" as const,
      first: "X" as const,
      moves: [0, 3, 1, 4, 2],
      result: "X" as const,
      source: "local" as const,
    };
    expect(validateReplay(r)).toEqual(r);
    expect(() => validateReplay({ ...r, result: "O" })).toThrow();
    expect(() => validateReplay({ ...r, moves: [0, 0] })).toThrow();
    expect(() => replayPosition(r, 6)).toThrow();
  });
});
