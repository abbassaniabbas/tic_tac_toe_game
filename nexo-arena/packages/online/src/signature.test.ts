import { describe, it, expect } from "vitest";
import { createGame, createUltimate, playUltimate } from "@nexo/engine";
import { decodeSignature, decodeExtras, displayedClocks } from "./signature";
import { decodeStudio, STUDIO_KEY, appendLocalReplay } from "./studio";
const x = "11111111-1111-4111-8111-111111111111",
  o = "22222222-2222-4222-8222-222222222222";
const base = {
  matchId: x,
  revision: 1,
  rulesVersion: "blitz-v1",
  game: createGame(),
  players: { X: x, O: o },
  playerNames: { X: "Ada", O: "Bayo" },
  phase: "active",
  result: null,
  createdAt: "2026-10-10T10:00:00Z",
  expiresAt: "2026-10-10T10:10:00Z",
  serverNow: "2026-10-10T10:00:10Z",
  clock: { X: 60000, O: 60000, startedAt: "2026-10-10T10:00:00Z" },
};
describe("signature snapshot and Studio persistence", () => {
  it("validates timeout outcomes against the running side and the accepted clock", () => {
    const timeout = {
      ...base,
      phase: "timeout",
      result: "O",
      clock: { X: 0, O: 60000, startedAt: null },
    };
    expect(decodeSignature(timeout).result).toBe("O");
    expect(() => decodeSignature({ ...timeout, result: "X" })).toThrow();
    expect(() =>
      decodeSignature({ ...timeout, clock: { ...timeout.clock, X: 1 } }),
    ).toThrow();
  });
  it("validates Ultimate state and refuses a forged route or claim", () => {
    const game = playUltimate(createUltimate(), { board: 4, cell: 2 }),
      m = { ...base, rulesVersion: "ultimate-v1", game, clock: null };
    expect(decodeSignature(m).game).toEqual(game);
    expect(() =>
      decodeSignature({ ...m, game: { ...game, forcedBoard: 3 } }),
    ).toThrow();
    expect(() =>
      decodeSignature({
        ...m,
        game: {
          ...game,
          claims: ["X", null, null, null, null, null, null, null, null],
        },
      }),
    ).toThrow();
  });
  it("uses server anchoring only for clock display and clamps estimates at zero", () => {
    const m = decodeSignature(base);
    expect(displayedClocks(m, Date.parse(m.serverNow))).toEqual({
      X: 50000,
      O: 60000,
    });
    expect(displayedClocks(m, Date.parse(m.serverNow) + 60000)?.X).toBe(0);
    expect(() =>
      decodeSignature({ ...base, clock: { ...base.clock, X: 999999 } }),
    ).toThrow();
    expect(() =>
      decodeSignature({
        ...base,
        phase: "active",
        clock: { ...base.clock, startedAt: null },
      }),
    ).toThrow();
  });
  it("never grants unrecognized or duplicated achievements from a payload", () => {
    expect(decodeExtras({ cosmetic: "blue", achievements: [] })).toEqual({
      cosmetic: "blue",
      achievements: [],
    });
    expect(() =>
      decodeExtras({ cosmetic: "gold", achievements: [] }),
    ).toThrow();
    expect(() =>
      decodeExtras({
        cosmetic: "blue",
        achievements: [{ code: "fake", earnedAt: base.serverNow }],
      }),
    ).toThrow();
  });
  it("reconstructs saved Ultimate positions and rejects corrupt data", () => {
    const v = decodeStudio(null);
    const next = { ...v, ultimateMoves: [{ board: 4, cell: 2 }] };
    expect(decodeStudio(JSON.stringify(next)).ultimateMoves).toEqual(
      next.ultimateMoves,
    );
    expect(() =>
      decodeStudio(
        JSON.stringify({
          ...next,
          ultimateMoves: [
            { board: 4, cell: 2 },
            { board: 1, cell: 0 },
          ],
        }),
      ),
    ).toThrow();
    expect(() => decodeStudio("{bad")).toThrow();
  });
  it("treats stored replays as local practice even if a save claims server provenance", () => {
    const v = decodeStudio(null);
    v.records = [
      {
        id: "pretend",
        rule: "classic-v1",
        first: "X",
        moves: [0, 3, 1, 4, 2],
        result: "X",
        source: "server",
      },
    ];
    expect(decodeStudio(JSON.stringify(v)).records[0].source).toBe("local");
  });
  it("appends a valid local replay once and keeps Studio data in its own key", async () => {
    const items = new Map<string, string>(),
      storage = {
        getItem: async (k: string) => items.get(k) ?? null,
        setItem: async (k: string, v: string) => {
          items.set(k, v);
        },
      };
    const r = {
      id: "local",
      rule: "classic-v1" as const,
      first: "X" as const,
      moves: [0, 3, 1, 4, 2],
      result: "X" as const,
      source: "local" as const,
    };
    await appendLocalReplay(storage, r);
    await appendLocalReplay(storage, r);
    expect(decodeStudio(items.get(STUDIO_KEY)!).records).toHaveLength(1);
  });
});
