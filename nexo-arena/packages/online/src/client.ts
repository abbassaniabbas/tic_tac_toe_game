import {
  createClient,
  processLock,
  type SupabaseClient,
  type SupportedStorage,
} from "@supabase/supabase-js";
import {
  decodeOnlineMatch,
  decodeQueue,
  decodeLeaderboard,
  type OnlineMatch,
  type Profile,
} from "./model";
import {
  decodeSignature,
  decodeExtras,
  type SignatureMatch,
  type Cosmetic,
} from "./signature";
import {
  validateReplay,
  type SignatureRule,
  type UltimateMove,
} from "@nexo/engine";
export interface OnlineConfig {
  url: string;
  key: string;
}
export function validateOnlineConfig(
  url: unknown,
  key: unknown,
): OnlineConfig | null {
  if (typeof url !== "string" || typeof key !== "string" || !url || !key)
    return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.pathname !== "/"
    )
      return null;
    if (
      parsed.protocol === "http:" &&
      !["localhost", "127.0.0.1", "10.0.2.2"].includes(parsed.hostname) &&
      !/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(parsed.hostname)
    )
      return null;
  } catch {
    return null;
  }
  if (key.startsWith("sb_secret_")) return null;
  // Refuse to construct a client with legacy privileged JWT keys.
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(
        atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") return null;
    } catch {
      return null;
    }
  } else if (!key.startsWith("sb_publishable_")) return null;
  return { url: url.replace(/\/$/, ""), key };
}
export function makeOnlineClient(
  config: OnlineConfig,
  storage?: SupportedStorage,
): SupabaseClient {
  return createClient(config.url, config.key, {
    auth: {
      storage,
      storageKey: "nexo.online.auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
    global: { headers: { "x-client-info": "nexo-arena/phase-4" } },
  });
}
export class ArenaApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
/** UUID requests work on LAN HTTP too, where randomUUID is unavailable. */
export function newRequestId(): string {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const explanations: Record<string, string> = {
  invalid_move: "Choose a legal square in the required board.",
  invalid_puzzle:
    "This solution could not be verified. Retry the daily puzzle.",
  puzzle_date: "The UTC daily puzzle changed. Open today’s puzzle.",
  cosmetic_locked:
    "Earn the required verified achievement to unlock this palette.",
  queue_active: "A search is already running. Refresh to restore it.",
  queue_superseded: "This search has ended. Refresh before starting another.",
  queue_rate_limit: "Please wait before starting another ranked search.",
  season_closed: "Ranked matchmaking is currently closed.",
  not_participant: "This match is private.",
  stale_revision: "The match changed. The latest board has been loaded.",
  wrong_turn: "Wait for your opponent’s move.",
  occupied_square: "That square is already occupied.",
  match_inactive: "This match is no longer active.",
  room_unavailable: "This invitation is already in use or closed.",
  invalid_invite: "This invitation was not found.",
  invite_expired: "This invitation has expired.",
  room_limit: "Close an existing invitation before creating another.",
  rate_limit: "Please wait before creating another invitation.",
  request_conflict: "This request changed. Please try again.",
  unauthorized: "Sign in to play online.",
};
export function createOnlineApi(client: SupabaseClient) {
  async function command(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await client.functions.invoke("arena", { body });
    if (error) {
      let payload: { error?: string } | undefined;
      try {
        payload = await error.context?.json();
      } catch {}
      const code = payload?.error ?? "network";
      throw new ArenaApiError(
        code,
        explanations[code] ??
          "Could not reach the arena. Reconnect and try again.",
      );
    }
    if (!data || typeof data !== "object")
      throw new ArenaApiError("response", "Invalid arena response.");
    return data;
  }
  return {
    async replay(matchId: string, signature: boolean) {
      const replay = validateReplay(
        (await command({ action: "replay", matchId, signature })).replay,
      );
      if (replay.source !== "server" || replay.id !== matchId)
        throw new Error("Invalid verified replay");
      return replay;
    },
    async variantCreate(rule: SignatureRule, requestId: string) {
      const data = await command({
        action: "variant",
        operation: "create",
        rule,
        requestId,
      });
      if (
        typeof data.invite !== "string" ||
        !/^[a-f0-9]{48}$/.test(data.invite)
      )
        throw new Error("Invalid invitation");
      return { match: decodeSignature(data.match), invite: data.invite };
    },
    async variantJoin(invite: string, requestId: string) {
      return decodeSignature(
        (
          await command({
            action: "variant",
            operation: "join",
            invite,
            requestId,
          })
        ).match,
      );
    },
    async variantFetch(matchId: string) {
      return decodeSignature(
        (await command({ action: "variant", operation: "fetch", matchId }))
          .match,
      );
    },
    async variantHistory() {
      const data = (await command({ action: "variant", operation: "history" }))
        .data;
      if (!Array.isArray(data)) throw new Error("Invalid signature history");
      return data.map(decodeSignature);
    },
    async variantAct(
      match: SignatureMatch,
      operation: "move" | "end",
      requestId: string,
      move?: number | UltimateMove,
    ) {
      return decodeSignature(
        (
          await command({
            action: "variant",
            operation,
            matchId: match.matchId,
            expectedRevision: match.revision,
            requestId,
            ...(operation === "move" ? { move } : {}),
          })
        ).match,
      );
    },
    async solve(day: string, puzzleId: string, moves: readonly number[]) {
      await command({ action: "solve", day, puzzleId, moves });
    },
    async extras() {
      return decodeExtras((await command({ action: "extras" })).extras);
    },
    async cosmetic(cosmetic: Cosmetic) {
      await command({ action: "cosmetic", cosmetic });
    },
    async queue(
      operation: "enter" | "poll" | "cancel" | "status",
      ticket?: string,
    ) {
      return decodeQueue(
        (
          await command({
            action: "queue",
            operation,
            ...(ticket ? { ticket } : {}),
          })
        ).queue,
      );
    },
    async leaderboard(region: string | null = null) {
      return decodeLeaderboard(
        (await command({ action: "leaderboard", region })).data,
      );
    },
    async createRoom(requestId: string) {
      const data = await command({ action: "create", requestId });
      if (
        typeof data.invite !== "string" ||
        !/^[a-f0-9]{48}$/.test(data.invite)
      )
        throw new Error("Invalid server invitation");
      return { match: decodeOnlineMatch(data.match), invite: data.invite };
    },
    async join(invite: string, requestId: string) {
      return decodeOnlineMatch(
        (await command({ action: "join", invite, requestId })).match,
      );
    },
    async fetchMatch(matchId: string) {
      return decodeOnlineMatch(
        (await command({ action: "fetch", matchId })).match,
      );
    },
    async move(match: OnlineMatch, square: number, requestId: string) {
      return decodeOnlineMatch(
        (
          await command({
            action: "move",
            matchId: match.matchId,
            expectedRevision: match.revision,
            square,
            requestId,
          })
        ).match,
      );
    },
    async end(match: OnlineMatch, requestId: string) {
      return decodeOnlineMatch(
        (
          await command({
            action: "end",
            matchId: match.matchId,
            expectedRevision: match.revision,
            requestId,
          })
        ).match,
      );
    },
    async profile(): Promise<Profile> {
      const { data, error } = await client
        .from("profiles")
        .select("id,handle,display_name,locale,region,leaderboard_visible")
        .single();
      if (error) throw error;
      return data;
    },
    async saveProfile(profile: Omit<Profile, "id">) {
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError || !user) throw new Error("Sign in again.");
      const { error } = await client
        .from("profiles")
        .update(profile)
        .eq("id", user.id);
      if (error)
        throw new Error(
          error.code === "23505"
            ? "This handle is already taken."
            : "Could not save this profile.",
        );
    },
    async rooms(): Promise<OnlineMatch[]> {
      const { data } = await command({ action: "rooms" });
      if (!Array.isArray(data)) throw new Error("Invalid rooms");
      return data.map(decodeOnlineMatch);
    },
    async history(): Promise<OnlineMatch[]> {
      const { data, error } = await command({ action: "history" });
      if (error) throw new Error(String(error));
      if (!Array.isArray(data)) throw new Error("Invalid history");
      return data.map(decodeOnlineMatch);
    },
    async deleteAccount() {
      await command({ action: "deleteAccount" });
      await client.auth.signOut({ scope: "local" });
    },
    subscribe(
      matchId: string,
      onChange: () => void,
      onStatus: (status: string) => void,
      table: "online_matches" | "signature_matches" = "online_matches",
    ) {
      const channel = client
        .channel(`nexo-match-${matchId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table,
            filter: `id=eq.${matchId}`,
          },
          onChange,
        )
        .subscribe(onStatus);
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
