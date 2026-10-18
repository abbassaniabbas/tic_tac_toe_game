import { describe, it, expect } from "vitest";
import { createGame, playMove } from "@nexo/engine";
import { decodeOnlineMatch, newerSnapshot, type OnlineMatch } from "./model";
import { validateOnlineConfig } from "./client";
import { createChunkedStorage } from "./storage";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const match: OnlineMatch = {
  matchId: a,
  revision: 1,
  rulesVersion: "classic-v1",
  game: createGame(),
  players: { X: a, O: b },
  playerNames: { X: "Ada", O: "Bayo" },
  phase: "active",
  result: null,
  createdAt: "2026-10-10T10:00:00Z",
  updatedAt: "2026-10-10T10:00:00Z",
  expiresAt: "2026-10-10T10:10:00Z",
};
describe("online snapshots", () => {
  it("reconstructs accepted moves with the shared rules", () => {
    const game = [0, 3, 1, 4, 2].reduce((g, i) => playMove(g, i), createGame());
    expect(
      decodeOnlineMatch({ ...match, game, phase: "completed", result: "X" })
        .game,
    ).toEqual(game);
  });
  it("rejects forged boards, outcomes and impossible histories", () => {
    expect(() =>
      decodeOnlineMatch({
        ...match,
        game: {
          ...match.game,
          board: ["X", null, null, null, null, null, null, null, null],
        },
      }),
    ).toThrow();
    expect(() =>
      decodeOnlineMatch({ ...match, game: { ...match.game, moves: [0, 0] } }),
    ).toThrow();
    expect(() =>
      decodeOnlineMatch({ ...match, phase: "completed", result: "O" }),
    ).toThrow();
  });
  it("rejects invalid phases, dates and missing active opponents", () => {
    expect(() => decodeOnlineMatch({ ...match, phase: "rated" })).toThrow();
    expect(() =>
      decodeOnlineMatch({ ...match, createdAt: "yesterday" }),
    ).toThrow();
    expect(() =>
      decodeOnlineMatch({ ...match, players: { X: a, O: null } }),
    ).toThrow();
    expect(() => decodeOnlineMatch({ ...match, phase: "waiting" })).toThrow();
  });
  it("accepts anonymous historical opponents after deletion", () => {
    expect(
      decodeOnlineMatch({
        ...match,
        phase: "abandoned",
        players: { X: a, O: null },
        playerNames: { X: "Ada", O: "Deleted player" },
      }).players.O,
    ).toBeNull();
  });
  it("ignores late and duplicate snapshots", () => {
    expect(newerSnapshot(match, { ...match, revision: 0 })).toBe(match);
    expect(newerSnapshot(match, { ...match })).toBe(match);
    expect(newerSnapshot(match, { ...match, revision: 2 }).revision).toBe(2);
  });
});
describe("public backend configuration", () => {
  it("allows HTTPS and local development hosts", () => {
    expect(
      validateOnlineConfig(
        "https://example.supabase.co",
        "sb_publishable_example",
      ),
    ).not.toBeNull();
    expect(
      validateOnlineConfig("http://10.0.2.2:54341", "sb_publishable_local"),
    ).not.toBeNull();
    expect(
      validateOnlineConfig("http://192.168.1.4:54341", "sb_publishable_local"),
    ).not.toBeNull();
  });
  it("rejects privileged keys and remote plaintext endpoints", () => {
    expect(
      validateOnlineConfig("https://example.supabase.co", "sb_secret_no"),
    ).toBeNull();
    const jwt = `eyJ.${btoa(JSON.stringify({ role: "service_role" }))}.signature`;
    expect(validateOnlineConfig("https://example.supabase.co", jwt)).toBeNull();
    expect(
      validateOnlineConfig("http://example.com", "sb_publishable_key"),
    ).toBeNull();
    expect(
      validateOnlineConfig(
        "https://user:password@example.com",
        "sb_publishable_key",
      ),
    ).toBeNull();
  });
});
function fixture() {
  const items = new Map<string, string>();
  let generation = 0;
  let fail = false;
  return {
    items,
    setFail(value: boolean) {
      fail = value;
    },
    storage: createChunkedStorage(
      {
        async get(k) {
          return items.get(k) ?? null;
        },
        async set(k, v) {
          if (fail && k.endsWith(".1"))
            throw new Error("Keychain write failed");
          items.set(k, v);
        },
        async remove(k) {
          items.delete(k);
        },
      },
      () => `generation-${++generation}`,
    ),
  };
}
describe("native secure session storage", () => {
  it("roundtrips large Unicode sessions in small encrypted-store entries", async () => {
    const { storage, items } = fixture();
    const value = JSON.stringify({
      access_token: "😀".repeat(1600),
      refresh_token: "a".repeat(2500),
    });
    await storage.setItem("nexo.auth", value);
    expect(await storage.getItem("nexo.auth")).toBe(value);
    expect(
      [...items.values()].every(
        (v) => new TextEncoder().encode(v).length <= 1600,
      ),
    ).toBe(true);
  });
  it("preserves the previous session if a chunk write fails", async () => {
    const { storage, items, setFail } = fixture();
    await storage.setItem("nexo.auth", "previous");
    setFail(true);
    await expect(
      storage.setItem("nexo.auth", "x".repeat(1000)),
    ).rejects.toThrow("Keychain write failed");
    expect(await storage.getItem("nexo.auth")).toBe("previous");
    expect([...items.keys()].some((k) => k.includes("generation-2"))).toBe(
      false,
    );
  });
  it("serializes refresh writes and removes obsolete chunks", async () => {
    const { storage, items } = fixture();
    await Promise.all([
      storage.setItem("nexo.auth", "a".repeat(1000)),
      storage.setItem("nexo.auth", "latest"),
    ]);
    expect(await storage.getItem("nexo.auth")).toBe("latest");
    expect(items.size).toBe(2);
  });
  it("removes credentials on sign out", async () => {
    const { storage, items } = fixture();
    await storage.setItem("nexo.auth", "x".repeat(1600));
    await storage.removeItem("nexo.auth");
    expect(await storage.getItem("nexo.auth")).toBeNull();
    expect(items.size).toBe(0);
  });
  it("returns no partial session and bounds keys/value sizes", async () => {
    const { storage, items } = fixture();
    await storage.setItem("nexo.auth", "abc");
    items.delete("nexo.auth.generation-1.0");
    expect(await storage.getItem("nexo.auth")).toBeNull();
    await expect(storage.setItem("bad/key", "token")).rejects.toThrow();
    await expect(
      storage.setItem("nexo.auth", "a".repeat(51201)),
    ).rejects.toThrow("limit");
  });
});
