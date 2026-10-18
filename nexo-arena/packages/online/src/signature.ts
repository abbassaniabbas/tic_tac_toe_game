import {
  createGame,
  playMove,
  createUltimate,
  playUltimate,
  type GameState,
  type UltimateState,
  type SignatureRule,
  type Mark,
} from "@nexo/engine";
import { isUuid } from "./model";
export interface SignatureMatch {
  matchId: string;
  revision: number;
  rulesVersion: SignatureRule;
  game: GameState | UltimateState;
  players: Record<Mark, string | null>;
  playerNames: Record<Mark, string | null>;
  phase:
    | "waiting"
    | "active"
    | "completed"
    | "cancelled"
    | "forfeited"
    | "timeout"
    | "abandoned";
  result: Mark | "draw" | null;
  createdAt: string;
  expiresAt: string;
  serverNow: string;
  clock: { X: number; O: number; startedAt: string | null } | null;
}
export const ACHIEVEMENTS = {
  first_verified_win: "First verified win",
  first_ultimate_win: "Ultimate winner",
  first_blitz_win: "Blitz winner",
  ranked_ten: "Ten ranked games",
  puzzle_solver: "Daily strategist",
} as const;
export type AchievementCode = keyof typeof ACHIEVEMENTS;
export type Cosmetic = "blue" | "slate" | "violet" | "cyan";
export const COSMETICS: Record<
  Cosmetic,
  { name: string; color: string; requires: AchievementCode | null }
> = {
  blue: { name: "Arena blue", color: "#6a8dff", requires: null },
  slate: { name: "Silver", color: "#a1a5b4", requires: null },
  violet: {
    name: "Victory violet",
    color: "#b196ff",
    requires: "first_verified_win",
  },
  cyan: { name: "Strategy mint", color: "#72d9c2", requires: "puzzle_solver" },
};
export interface Extras {
  cosmetic: Cosmetic;
  achievements: { code: AchievementCode; earnedAt: string }[];
}
export function decodeExtras(value: unknown): Extras {
  if (!value || typeof value !== "object")
    throw new Error("Invalid achievements");
  const e = value as Extras;
  if (
    !Object.hasOwn(COSMETICS, e.cosmetic) ||
    !Array.isArray(e.achievements) ||
    e.achievements.length > 5 ||
    new Set(e.achievements.map((a) => a.code)).size !== e.achievements.length ||
    e.achievements.some(
      (a) =>
        !Object.hasOwn(ACHIEVEMENTS, a.code) ||
        typeof a.earnedAt !== "string" ||
        !Number.isFinite(Date.parse(a.earnedAt)),
    )
  )
    throw new Error("Invalid achievements");
  return e;
}
export function decodeSignature(value: unknown): SignatureMatch {
  if (!value || typeof value !== "object")
    throw new Error("Invalid signature match");
  const m = value as SignatureMatch;
  if (
    !isUuid(m.matchId) ||
    !Number.isSafeInteger(m.revision) ||
    m.revision < 0 ||
    !["ultimate-v1", "blitz-v1"].includes(m.rulesVersion) ||
    ![
      "waiting",
      "active",
      "completed",
      "cancelled",
      "forfeited",
      "timeout",
      "abandoned",
    ].includes(m.phase) ||
    !m.game ||
    !Array.isArray(m.game.moves) ||
    m.game.moves.length > (m.rulesVersion === "ultimate-v1" ? 81 : 9) ||
    !["X", "O"].includes(m.game.first) ||
    !m.players ||
    !m.playerNames
  )
    throw new Error("Invalid signature match");
  for (const mark of ["X", "O"] as const) {
    if (m.players[mark] !== null && !isUuid(m.players[mark]))
      throw new Error("Invalid player");
    if (
      m.playerNames[mark] !== null &&
      (typeof m.playerNames[mark] !== "string" ||
        m.playerNames[mark]!.length > 24)
    )
      throw new Error("Invalid name");
  }
  for (const date of [m.createdAt, m.expiresAt, m.serverNow])
    if (typeof date !== "string" || !Number.isFinite(Date.parse(date)))
      throw new Error("Invalid date");
  if (m.players.X !== null && m.players.X === m.players.O)
    throw new Error("Invalid opponents");
  const game =
    m.rulesVersion === "ultimate-v1"
      ? (m.game as UltimateState).moves.reduce(
          (s, v) => playUltimate(s, v),
          createUltimate(m.game.first),
        )
      : (m.game as GameState).moves.reduce(
          (s, v) => playMove(s, v),
          createGame(m.game.first),
        );
  if (JSON.stringify(game) !== JSON.stringify(m.game)) {
    // PostgreSQL JSONB changes key order. Compare each reconstructed state field.
    for (const key of Object.keys(game))
      if (
        JSON.stringify(game[key as keyof typeof game]) !==
        JSON.stringify(m.game[key as keyof typeof game])
      )
        throw new Error("Inconsistent signature game");
  }
  if (
    m.phase === "active" &&
    (!m.players.X || !m.players.O || game.status !== "playing")
  )
    throw new Error("Invalid active match");
  if (
    m.phase === "waiting" &&
    (m.players.O !== null || game.moves.length !== 0)
  )
    throw new Error("Invalid invitation");
  if (
    m.phase === "completed" &&
    (game.status === "playing" || m.result !== (game.winner ?? "draw"))
  )
    throw new Error("Invalid result");
  if (
    ["forfeited", "timeout"].includes(m.phase)
      ? !["X", "O"].includes(m.result ?? "")
      : m.phase !== "completed" && m.result !== null
  )
    throw new Error("Invalid outcome");
  if (m.rulesVersion === "blitz-v1") {
    if (
      !m.clock ||
      ![m.clock.X, m.clock.O].every(
        (v) => Number.isInteger(v) && v >= 0 && v <= 60000,
      ) ||
      (m.phase === "active"
        ? typeof m.clock.startedAt !== "string" ||
          !Number.isFinite(Date.parse(m.clock.startedAt))
        : m.clock.startedAt !== null)
    )
      throw new Error("Invalid server clock");
    if (
      m.phase === "timeout" &&
      (m.result !== (game.turn === "X" ? "O" : "X") || m.clock[game.turn] !== 0)
    )
      throw new Error("Invalid timeout");
  } else if (m.clock !== null || m.phase === "timeout")
    throw new Error("Unexpected clock");
  return { ...m, game };
}
export function displayedClocks(
  match: SignatureMatch,
  estimatedServerNow: number,
): Record<Mark, number> | null {
  if (!match.clock) return null;
  const remaining = { X: match.clock.X, O: match.clock.O };
  if (match.phase === "active" && match.clock.startedAt)
    remaining[match.game.turn] = Math.max(
      0,
      remaining[match.game.turn] -
        Math.max(0, estimatedServerNow - Date.parse(match.clock.startedAt)),
    );
  return remaining;
}
