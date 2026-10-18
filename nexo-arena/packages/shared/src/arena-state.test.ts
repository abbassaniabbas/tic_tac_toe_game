import { describe, it, expect } from "vitest";
import {
  arenaReducer,
  createArenaState,
  createArenaPersistence,
  decodeArenaState,
  summarizeHistory,
  HISTORY_LIMIT,
  isGameConfig,
  type ArenaState,
} from "./arena-state";
import { validInviteToken } from "./contracts";
const local = {
  mode: "local",
  difficulty: "hard",
  humanMark: "X",
  firstMark: "X",
} as const;
function move(state: ArenaState, index: number) {
  return arenaReducer(state, {
    type: "session",
    action: { type: "move", index },
    id: "next",
    now: 12345,
  });
}
function completed(id = "match") {
  let state = createArenaState(id);
  state.session.config = { ...local };
  for (const index of [0, 3, 1, 4, 2]) state = move(state, index);
  return state;
}
describe("saved native matches use the shared engine", () => {
  it("rejects coerced enum values in corrupt preferences/configuration", () => {
    expect(isGameConfig({...local,mode:["ai"]})).toBe(false);
    expect(isGameConfig({...local,firstMark:["X"]})).toBe(false);
    const raw=JSON.parse(JSON.stringify(createArenaState()));raw.preferences.theme=["light"];
    expect(decodeArenaState(JSON.stringify(raw)).preferences.theme).toBe("dark");
  });
  it("records one terminal outcome and keeps rematch scores", () => {
    const state = completed();
    expect(state.session.score.X).toBe(1);
    expect(state.history).toHaveLength(1);
    const next = arenaReducer(state, {
      type: "session",
      action: { type: "rematch" },
      id: "new",
      now: 12346,
    });
    expect(next.history).toEqual(state.history);
    expect(next.session.score.X).toBe(1);
    expect(next.matchId).toBe("new");
  });
  it("restores an in-progress round by replaying validated moves", () => {
    const state = move(createArenaState("pending"), 0);
    const decoded = decodeArenaState(JSON.stringify(state));
    expect(decoded).toEqual(state);
  });
  it("restoring a completed round does not count it twice", () => {
    const state = completed();
    const decoded = decodeArenaState(JSON.stringify(state));
    expect(decoded).toEqual(state);
    expect(decoded.session.score.X).toBe(1);
    expect(decoded.history).toHaveLength(1);
  });
  it("reconstructs board data and rejects illegal move histories", () => {
    const state = completed();
    const raw = JSON.parse(JSON.stringify(state));
    raw.session.game.board.fill("O");
    expect(decodeArenaState(JSON.stringify(raw)).session.game.board).toEqual(
      state.session.game.board,
    );
    raw.history[0].moves = [0, 0];
    raw.session.game.moves = [8, 8];
    const decoded = decodeArenaState(JSON.stringify(raw));
    expect(decoded.history).toHaveLength(0);
    expect(decoded.session.game.moves).toEqual([]);
  });
  it("recovers from corrupt storage and unsupported versions", () => {
    expect(decodeArenaState("{broken", "fallback")).toEqual(
      createArenaState("fallback"),
    );
    expect(decodeArenaState('{"version":99}', "fallback")).toEqual(
      createArenaState("fallback"),
    );
  });
  it("deduplicates, validates, sorts, and bounds saved history", () => {
    const state = completed();
    const record = state.history[0];
    state.history = Array.from({ length: 250 }, (_, i) => ({
      ...record,
      id: String(i),
      completedAt: i + 1,
    }));
    state.history.push(state.history[0]);
    const decoded = decodeArenaState(JSON.stringify(state));
    expect(decoded.history).toHaveLength(HISTORY_LIMIT);
    expect(decoded.history[0].id).toBe("249");
  });
  it("counts AI results from the human perspective and local wins separately", () => {
    const record = completed().history[0];
    expect(
      summarizeHistory([
        record,
        { ...record, config: { ...record.config, mode: "ai", humanMark: "O" } },
        { ...record, config: { ...record.config, mode: "ai" } },
        { ...record, winner: null, status: "draw" },
      ]),
    ).toEqual({
      played: 4,
      aiWins: 1,
      aiLosses: 1,
      draws: 1,
      localXWins: 1,
      localOWins: 0,
    });
  });
  it("normalizes preferences and removes invalid scores", () => {
    const raw = JSON.parse(JSON.stringify(createArenaState()));
    raw.preferences = {
      playerName: "  Ada\u0000  ",
      theme: "light",
      sound: true,
    };
    raw.session.score.X = -1;
    const state = decodeArenaState(JSON.stringify(raw));
    expect(state.preferences.playerName).toBe("Ada");
    expect(state.preferences.theme).toBe("light");
    expect(state.session.score.X).toBe(0);
  });
  it("does not record undone or abandoned rounds", () => {
    const state = move(createArenaState(), 0);
    const next = arenaReducer(state, {
      type: "session",
      action: { type: "undo" },
      id: "unused",
      now: 1,
    });
    expect(next.history).toHaveLength(0);
    expect(next.session.game.moves).toHaveLength(0);
  });
  it("serializes async writes and recovers after storage failure", async () => {
    let calls = 0;
    let saved = "";
    const persistence = createArenaPersistence({
      getItem: async () => saved,
      setItem: async (_, value) => {
        if (++calls === 1) throw new Error("disk");
        saved = value;
      },
    });
    await expect(persistence.save(createArenaState("first"))).rejects.toThrow(
      "disk",
    );
    await persistence.save(completed("second"));
    await persistence.flush();
    expect((await persistence.load()).matchId).toBe("second");
  });
  it("accepts bounded invitation tokens only", () => {
    expect(validInviteToken("abcDEF_123")).toBe(true);
    expect(validInviteToken("../bad")).toBe(false);
    expect(validInviteToken("a".repeat(129))).toBe(false);
  });
});
