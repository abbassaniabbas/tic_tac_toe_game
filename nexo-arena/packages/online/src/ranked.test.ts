import { describe, it, expect } from "vitest";
import { createGame } from "@nexo/engine";
import {
  decodeQueue,
  decodeLeaderboard,
  decodeOnlineMatch,
  ratingSummary,
  type OnlineMatch,
} from "./model";
const x = "11111111-1111-4111-8111-111111111111",
  o = "22222222-2222-4222-8222-222222222222";
const rating = {
  season: "classic-open-v1",
  value: 1500,
  games: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  provisional: true,
};
const idle = {
  ticket: null,
  status: "idle",
  joinedAt: null,
  expiresAt: null,
  match: null,
  rating,
};
const match: OnlineMatch = {
  matchId: x,
  revision: 1,
  rulesVersion: "classic-v1",
  game: createGame(),
  players: { X: x, O: o },
  playerNames: { X: "Ada", O: "Bayo" },
  phase: "active",
  result: null,
  createdAt: "2026-10-10T10:00:00Z",
  updatedAt: "2026-10-10T10:00:00Z",
  expiresAt: "2026-10-10T10:10:00Z",
  competition: "ranked",
  season: "classic-open-v1",
  ratingStatus: "pending",
  ratingChanges: null,
};
describe("ranked server contracts", () => {
  it("accepts server idle/waiting/matched queue states", () => {
    expect(decodeQueue(idle).rating.value).toBe(1500);
    const waiting = {
      ...idle,
      status: "waiting",
      ticket: x,
      joinedAt: match.createdAt,
      expiresAt: match.expiresAt,
    };
    expect(decodeQueue(waiting).status).toBe("waiting");
    expect(
      decodeQueue({ ...waiting, status: "matched", match }).match?.players.O,
    ).toBe(o);
  });
  it("rejects impossible queue placement totals and forged matches", () => {
    for (const invalid of [
      { ...idle, rating: { ...rating, games: 1 } },
      { ...idle, rating: { ...rating, provisional: false } },
      { ...idle, status: "waiting" },
      {
        ...idle,
        status: "matched",
        match: {
          ...match,
          competition: "private",
          season: null,
          ratingStatus: "unrated",
        },
      },
      { ...idle, status: "waiting", match },
    ])
      expect(() => decodeQueue(invalid)).toThrow();
  });
  it("rejects unbalanced, oversized or missing settled Elo events", () => {
    const result = {
      ...match,
      phase: "forfeited",
      result: "X",
      ratingStatus: "settled",
      ratingChanges: {
        X: { before: 1500, after: 1516, delta: 16 },
        O: { before: 1500, after: 1484, delta: -16 },
      },
    };
    expect(decodeOnlineMatch(result).ratingChanges?.X.after).toBe(1516);
    expect(() =>
      decodeOnlineMatch({ ...result, ratingChanges: null }),
    ).toThrow();
    expect(() =>
      decodeOnlineMatch({
        ...result,
        ratingChanges: {
          ...result.ratingChanges,
          O: { before: 1500, after: 1485, delta: -15 },
        },
      }),
    ).toThrow();
    expect(() =>
      decodeOnlineMatch({
        ...result,
        ratingChanges: {
          X: { before: 1500, after: 1600, delta: 100 },
          O: { before: 1500, after: 1400, delta: -100 },
        },
      }),
    ).toThrow();
  });
  it("accepts only eligible sequential public leaderboard entries", () => {
    const row = {
      rank: 1,
      handle: "ada_test",
      region: "NG",
      rating: 1600,
      games: 10,
      wins: 9,
      draws: 1,
      losses: 0,
    };
    expect(decodeLeaderboard([row])).toEqual([row]);
    expect(decodeLeaderboard([])).toEqual([]);
    for (const change of [
      { rank: 0 },
      { handle: "bad handle" },
      { games: 9 },
      { region: "Nigeria" },
      { rating: NaN },
    ])
      expect(() => decodeLeaderboard([{ ...row, ...change }])).toThrow();
  });
  it("drops undeclared identity fields from public leaderboard payloads", () => {
    const row = {
      rank: 1,
      handle: "ada_test",
      region: null,
      rating: 1600,
      games: 10,
      wins: 10,
      draws: 0,
      losses: 0,
      player_id: x,
      email: "private@example.invalid",
    };
    expect(decodeLeaderboard([row])[0]).not.toHaveProperty("email");
    expect(decodeLeaderboard([row])[0]).not.toHaveProperty("player_id");
  });
  it("shows accepted rating changes and clear void/private labels", () => {
    expect(
      ratingSummary(
        {
          ...match,
          phase: "forfeited",
          result: "O",
          ratingStatus: "settled",
          ratingChanges: {
            X: { before: 1500, after: 1484, delta: -16 },
            O: { before: 1500, after: 1516, delta: 16 },
          },
        },
        x,
      ),
    ).toContain("1500 → 1484 (-16)");
    expect(
      ratingSummary(
        {
          ...match,
          ratingStatus: "void",
          ratingVoidReason: "repeat_pair_limit",
        },
        x,
      ),
    ).toContain("three rated games");
    expect(ratingSummary({ ...match, competition: "private" }, x)).toContain(
      "unrated",
    );
  });
});
