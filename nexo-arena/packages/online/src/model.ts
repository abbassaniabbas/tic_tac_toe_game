import { createGame, playMove, type GameState, type Mark } from "@nexo/engine";
export interface Profile {
  id: string;
  handle: string | null;
  display_name: string;
  locale: string;
  region: string | null;
  leaderboard_visible?: boolean;
}
export interface OnlineMatch {
  matchId: string;
  revision: number;
  rulesVersion: "classic-v1";
  game: GameState;
  players: Record<Mark, string | null>;
  playerNames: Record<Mark, string | null>;
  phase:
    | "waiting"
    | "active"
    | "completed"
    | "cancelled"
    | "forfeited"
    | "abandoned";
  result: Mark | "draw" | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  competition?: "private" | "ranked";
  season?: string | null;
  ratingStatus?: "unrated" | "pending" | "settled" | "void";
  ratingVoidReason?: string | null;
  ratingChanges?: Record<
    Mark,
    { before: number; after: number; delta: number }
  > | null;
}
export const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
export const validHandle = (v: string) => /^[a-z][a-z0-9_]{2,19}$/.test(v);
export const validEmail = (v: string) =>
  v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export function decodeOnlineMatch(value: unknown): OnlineMatch {
  if (typeof value !== "object" || value === null)
    throw new Error("Invalid server response");
  const m = value as OnlineMatch;
  if (
    !isUuid(m.matchId) ||
    !Number.isSafeInteger(m.revision) ||
    m.revision < 0 ||
    m.rulesVersion !== "classic-v1" ||
    ![
      "waiting",
      "active",
      "completed",
      "cancelled",
      "forfeited",
      "abandoned",
    ].includes(m.phase) ||
    !m.players ||
    !m.playerNames ||
    !m.game ||
    !Array.isArray(m.game.moves) ||
    m.game.moves.length > 9 ||
    !["X", "O"].includes(m.game.first)
  )
    throw new Error("Invalid server match");
  for (const mark of ["X", "O"] as const) {
    if (m.players[mark] !== null && !isUuid(m.players[mark]))
      throw new Error("Invalid player");
    if (
      m.playerNames[mark] !== null &&
      (typeof m.playerNames[mark] !== "string" ||
        m.playerNames[mark].length > 24)
    )
      throw new Error("Invalid player name");
  }
  for (const date of [m.createdAt, m.updatedAt, m.expiresAt])
    if (typeof date !== "string" || !Number.isFinite(Date.parse(date)))
      throw new Error("Invalid server date");
  if (m.players.X !== null && m.players.X === m.players.O)
    throw new Error("Invalid opponents");
  const game = m.game.moves.reduce(
    (g, i) => playMove(g, i),
    createGame(m.game.first),
  );
  // Never render a server snapshot whose board/outcome conflicts with the shared rules.
  if (
    JSON.stringify(game.board) !== JSON.stringify(m.game.board) ||
    game.turn !== m.game.turn ||
    game.status !== m.game.status ||
    game.winner !== m.game.winner
  )
    throw new Error("Inconsistent server game");
  if (
    m.phase === "completed" &&
    (game.status === "playing" || m.result !== (game.winner ?? "draw"))
  )
    throw new Error("Invalid server result");
  if (![null, "X", "O", "draw"].includes(m.result))
    throw new Error("Invalid result");
  if (
    ["waiting", "active", "cancelled", "abandoned"].includes(m.phase) &&
    m.result !== null
  )
    throw new Error("Unexpected result");
  if (["waiting", "active"].includes(m.phase) && game.status !== "playing")
    throw new Error("Invalid active game");
  if (m.phase === "active" && (!m.players.X || !m.players.O))
    throw new Error("Missing opponent");
  if (
    m.phase === "waiting" &&
    (m.players.O !== null || game.moves.length !== 0)
  )
    throw new Error("Invalid waiting room");
  if (m.phase === "forfeited" && !["X", "O"].includes(m.result ?? ""))
    throw new Error("Invalid forfeit");
  if (m.competition !== undefined) {
    if (
      !["private", "ranked"].includes(m.competition) ||
      !["unrated", "pending", "settled", "void"].includes(
        m.ratingStatus ?? "",
      ) ||
      (m.competition === "ranked" &&
        (m.season !== "classic-open-v1" || m.ratingStatus === "unrated")) ||
      (m.competition === "private" &&
        (m.season !== null || m.ratingStatus !== "unrated"))
    )
      throw new Error("Invalid competition");
    if (m.ratingStatus === "settled") {
      for (const mark of ["X", "O"] as const) {
        const r = m.ratingChanges?.[mark];
        if (
          !r ||
          !Number.isSafeInteger(r.before) ||
          !Number.isSafeInteger(r.after) ||
          !Number.isSafeInteger(r.delta) ||
          r.before < 0 ||
          r.after < 0 ||
          r.after - r.before !== r.delta ||
          Math.abs(r.delta) > 32
        )
          throw new Error("Invalid rating result");
      }
      if (m.ratingChanges!.X.delta + m.ratingChanges!.O.delta !== 0)
        throw new Error("Invalid rating balance");
    } else if (m.ratingChanges != null)
      throw new Error("Unexpected rating result");
  }
  return { ...m, game };
}
export interface Rating {
  season: "classic-open-v1";
  value: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  provisional: boolean;
}
export interface QueueState {
  ticket: string | null;
  status: "idle" | "waiting" | "matched" | "cancelled" | "expired";
  joinedAt: string | null;
  expiresAt: string | null;
  match: OnlineMatch | null;
  rating: Rating;
}
export interface LeaderboardEntry {
  rank: number;
  handle: string;
  region: string | null;
  rating: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
}
function validStats(r: {
  games: number;
  wins: number;
  draws: number;
  losses: number;
}) {
  return (
    [r.games, r.wins, r.draws, r.losses].every(
      (v) => Number.isSafeInteger(v) && v >= 0,
    ) && r.games === r.wins + r.draws + r.losses
  );
}
export function decodeQueue(value: unknown): QueueState {
  if (!value || typeof value !== "object") throw new Error("Invalid queue");
  const q = value as QueueState,
    r = q.rating;
  if (
    !r ||
    r.season !== "classic-open-v1" ||
    !Number.isSafeInteger(r.value) ||
    r.value < 0 ||
    !validStats(r) ||
    r.provisional !== r.games < 10 ||
    !["idle", "waiting", "matched", "cancelled", "expired"].includes(
      q.status,
    ) ||
    (q.ticket !== null && !isUuid(q.ticket))
  )
    throw new Error("Invalid queue");
  for (const date of [q.joinedAt, q.expiresAt])
    if (
      date !== null &&
      (typeof date !== "string" || !Number.isFinite(Date.parse(date)))
    )
      throw new Error("Invalid queue date");
  if (q.status === "waiting" && (!q.ticket || !q.joinedAt || !q.expiresAt))
    throw new Error("Invalid waiting ticket");
  const match = q.match === null ? null : decodeOnlineMatch(q.match);
  if (
    q.status === "matched"
      ? !match || match.phase !== "active" || match.competition !== "ranked"
      : match !== null
  )
    throw new Error("Invalid queue match");
  return { ...q, match };
}
export function decodeLeaderboard(value: unknown): LeaderboardEntry[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new Error("Invalid leaderboard");
  return value.map((v, i) => {
    if (
      !v ||
      typeof v !== "object" ||
      v.rank !== i + 1 ||
      typeof v.handle !== "string" ||
      !validHandle(v.handle) ||
      (v.region !== null &&
        (typeof v.region !== "string" || !/^[A-Z]{2}$/.test(v.region))) ||
      !Number.isSafeInteger(v.rating) ||
      v.rating < 0 ||
      !validStats(v) ||
      v.games < 10
    )
      throw new Error("Invalid leaderboard entry");
    return {
      rank: v.rank,
      handle: v.handle,
      region: v.region,
      rating: v.rating,
      games: v.games,
      wins: v.wins,
      draws: v.draws,
      losses: v.losses,
    };
  });
}
export function ratingSummary(match: OnlineMatch, userId: string): string {
  if (match.competition !== "ranked") return "Private match · unrated";
  const mark = match.players.X === userId ? "X" : "O";
  const r = match.ratingChanges?.[mark];
  if (match.ratingStatus === "settled" && r)
    return `Elo ${r.before} → ${r.after} (${r.delta >= 0 ? "+" : ""}${r.delta})`;
  if (match.ratingStatus === "void")
    return match.ratingVoidReason === "repeat_pair_limit"
      ? "Unrated result · three rated games per opponent per hour"
      : "Unrated result · account deleted";
  return "Ranked Classic · untimed · Elo settles when the match ends";
}
export function newerSnapshot(
  current: OnlineMatch | null,
  next: OnlineMatch,
): OnlineMatch {
  return current?.matchId === next.matchId && current.revision >= next.revision
    ? current
    : next;
}
export function onlineStatus(match: OnlineMatch, userId: string): string {
  if (match.phase === "waiting") return "Waiting for your friend";
  if (match.phase === "cancelled") return "Invitation cancelled";
  if (match.phase === "abandoned")
    return "Match ended after an account was deleted";
  if (match.result === "draw") return "A worthy draw";
  if (match.result)
    return match.players[match.result] === userId
      ? "You won"
      : `${match.playerNames[match.result] ?? "Your opponent"} won`;
  return match.players[match.game.turn] === userId
    ? "Your turn"
    : `${match.playerNames[match.game.turn] ?? "Your opponent"}’s turn`;
}
