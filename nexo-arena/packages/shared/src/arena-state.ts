import {
  createGame,
  createSession,
  playMove,
  sessionReducer,
  type GameConfig,
  type Session,
  type SessionAction,
} from "@nexo/engine";

export const HISTORY_LIMIT = 200;
export interface NativePreferences {
  theme: "system" | "dark" | "light";
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  playerName: string;
}
export const DEFAULT_NATIVE_PREFERENCES: NativePreferences = {
  theme: "dark",
  sound: false,
  haptics: true,
  reducedMotion: false,
  playerName: "You",
};
export interface MatchRecord {
  id: string;
  completedAt: number;
  config: GameConfig;
  moves: number[];
  winner: "X" | "O" | null;
  status: "won" | "draw";
}
export interface ArenaState {
  version: 1;
  matchId: string;
  session: Session;
  preferences: NativePreferences;
  history: MatchRecord[];
}
export const newLocalId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
export function createArenaState(id: string = newLocalId()): ArenaState {
  return {
    version: 1,
    matchId: id,
    session: createSession(),
    preferences: { ...DEFAULT_NATIVE_PREFERENCES },
    history: [],
  };
}
export type ArenaAction =
  | { type: "session"; action: SessionAction; id: string; now: number }
  | { type: "preferences"; patch: Partial<NativePreferences> }
  | { type: "restore"; state: ArenaState }
  | { type: "clearHistory" };
export function arenaReducer(
  state: ArenaState,
  action: ArenaAction,
): ArenaState {
  if (action.type === "restore") return action.state;
  if (action.type === "preferences")
    return { ...state, preferences: { ...state.preferences, ...action.patch } };
  if (action.type === "clearHistory") return { ...state, history: [] };
  const session = sessionReducer(state.session, action.action);
  const newRound = ["configure", "rematch", "restart", "resetScore"].includes(
    action.action.type,
  );
  let history = state.history;
  if (
    state.session.game.status === "playing" &&
    session.game.status !== "playing"
  ) {
    const record: MatchRecord = {
      id: state.matchId,
      completedAt: action.now,
      config: { ...session.config },
      moves: [...session.game.moves],
      status: session.game.status,
      winner: session.game.winner,
    };
    history = [
      record,
      ...history.filter((match) => match.id !== record.id),
    ].slice(0, HISTORY_LIMIT);
  }
  return {
    ...state,
    session,
    history,
    matchId: newRound ? action.id : state.matchId,
  };
}
export function summarizeHistory(history: readonly MatchRecord[]) {
  const result = {
    played: history.length,
    aiWins: 0,
    aiLosses: 0,
    draws: 0,
    localXWins: 0,
    localOWins: 0,
  };
  for (const match of history) {
    if (!match.winner) result.draws++;
    else if (match.config.mode === "ai") {
      if (match.winner === match.config.humanMark) result.aiWins++;
      else result.aiLosses++;
    } else if (match.winner === "X") result.localXWins++;
    else result.localOWins++;
  }
  return result;
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export function isGameConfig(value: unknown): value is GameConfig {
  return (
    object(value) &&
    (value.mode === "ai" || value.mode === "local") &&
    (value.difficulty === "easy" || value.difficulty === "medium" || value.difficulty === "hard") &&
    (value.humanMark === "X" || value.humanMark === "O") &&
    (value.firstMark === "X" || value.firstMark === "O")
  );
}
function safePreferences(value: unknown): NativePreferences {
  if (!object(value)) return { ...DEFAULT_NATIVE_PREFERENCES };
  const name =
    typeof value.playerName === "string"
      ? value.playerName
          .replace(/[\u0000-\u001f]/g, "")
          .trim()
          .slice(0, 24)
      : "";
  return {
    theme: (value.theme === "system" || value.theme === "dark" || value.theme === "light")
      ? (value.theme as NativePreferences["theme"])
      : "dark",
    sound: value.sound === true,
    haptics: typeof value.haptics === "boolean" ? value.haptics : true,
    reducedMotion: value.reducedMotion === true,
    playerName: name || "You",
  };
}
export function validateMatch(value: unknown): MatchRecord | null {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    value.id.length > 80 ||
    !value.id ||
    typeof value.completedAt !== "number" ||
    !Number.isFinite(value.completedAt) ||
    value.completedAt <= 0 ||
    !isGameConfig(value.config) ||
    !Array.isArray(value.moves) ||
    value.moves.length > 9
  )
    return null;
  try {
    const game = value.moves.reduce(
      (state, index) => playMove(state, index),
      createGame(value.config.firstMark),
    );
    if (
      game.status === "playing" ||
      game.status !== value.status ||
      game.winner !== value.winner
    )
      return null;
    return {
      id: value.id,
      completedAt: value.completedAt,
      config: { ...value.config },
      moves: [...game.moves],
      status: game.status,
      winner: game.winner,
    };
  } catch {
    return null;
  }
}
export function decodeArenaState(
  raw: string | null,
  fallbackId: string = newLocalId(),
): ArenaState {
  const fallback = createArenaState(fallbackId);
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!object(value) || value.version !== 1) return fallback;
    fallback.preferences = safePreferences(value.preferences);
    const seen = new Set<string>();
    if (Array.isArray(value.history))
      fallback.history = value.history
        .flatMap((candidate) => {
          const match = validateMatch(candidate);
          if (!match || seen.has(match.id)) return [];
          seen.add(match.id);
          return [match];
        })
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, HISTORY_LIMIT);
    if (object(value.session) && isGameConfig(value.session.config)) {
      const config = value.session.config;
      const s = value.session.score;
      const score =
        object(s) &&
        ["X", "O", "draws"].every(
          (key) => Number.isSafeInteger(s[key]) && (s[key] as number) >= 0,
        )
          ? { X: s.X as number, O: s.O as number, draws: s.draws as number }
          : { X: 0, O: 0, draws: 0 };
      fallback.session = createSession(config, score);
      if (
        object(value.session.game) &&
        Array.isArray(value.session.game.moves) &&
        value.session.game.moves.length <= 9
      ) {
        const game = value.session.game.moves.reduce(
          (state, index) => playMove(state, index),
          createGame(config.firstMark),
        );
        const round = value.session.round;
        fallback.session = {
          config: { ...config },
          score,
          game,
          round:
            typeof round === "number" &&
            Number.isSafeInteger(round) &&
            round > 0
              ? round
              : fallback.session.round,
        };
      }
    }
    if (
      typeof value.matchId === "string" &&
      value.matchId.length > 0 &&
      value.matchId.length <= 80
    )
      fallback.matchId = value.matchId;
    return fallback;
  } catch {
    return fallback;
  }
}
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export function createArenaPersistence(
  storage: KeyValueStorage,
  key = "nexo-native-v1",
) {
  let queue: Promise<void> = Promise.resolve();
  return {
    async load() {
      await queue;
      return decodeArenaState(await storage.getItem(key));
    },
    save(state: ArenaState) {
      const serialized = JSON.stringify(state);
      const write = queue.then(() => storage.setItem(key, serialized));
      queue = write.catch(() => undefined);
      return write;
    },
    flush() {
      return queue;
    },
  };
}
