import {
  createGame,
  playMove,
  createUltimate,
  playUltimate,
  dailyPuzzle,
  verifyPuzzle,
  type UltimateState,
  type UltimateMove,
  type GameState,
} from "../../../packages/game-engine/src/index.ts";
export interface Repository {
  snapshot(id: string, user: string): Promise<unknown>;
  receipt(
    user: string,
    request: string,
    action: string,
    fingerprint: Record<string, unknown>,
  ): Promise<unknown | null>;
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>;
  history(user: string, active?: boolean): Promise<unknown[]>;
  deleteAuthUser(user: string): Promise<void>;
}
export interface Dependencies {
  authenticate(token: string): Promise<string | null>;
  repository: Repository;
  inviteSecret: string;
}
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
async function digest(value: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}
async function invite(secret: string, user: string, request: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`nexo:${user}:${request}`),
    ),
  ).slice(0, 48);
}
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
export function createArenaHandler({
  authenticate,
  repository,
  inviteSecret,
}: Dependencies) {
  return async (req: Request): Promise<Response> => {
    const respond = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: cors });
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST")
      return respond({ error: "method_not_allowed" }, 405);
    if (Number(req.headers.get("content-length") ?? 0) > 4096)
      return respond({ error: "body_too_large" }, 413);
    const token = req.headers
      .get("authorization")
      ?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return respond({ error: "unauthorized" }, 401);
    let user: string | null;
    try {
      user = await authenticate(token);
    } catch {
      return respond({ error: "unauthorized" }, 401);
    }
    if (!user || !uuid(user)) return respond({ error: "unauthorized" }, 401);
    try {
      const raw = await req.text();
      if (raw.length > 4096) return respond({ error: "body_too_large" }, 413);
      const body = JSON.parse(raw) as Record<string, unknown>;
      if (!body || typeof body !== "object" || Array.isArray(body))
        return respond({ error: "invalid_request" }, 400);
      const action = body.action;
      if (action === "replay") {
        if (!uuid(body.matchId) || typeof body.signature !== "boolean")
          return respond({ error: "invalid_request" }, 400);
        return respond({
          replay: await repository.rpc("arena_replay", {
            p_player: user,
            p_match: body.matchId,
            p_signature: body.signature,
          }),
        });
      }
      if (action === "extras")
        return respond({
          extras: await repository.rpc("arena_extras", { p_player: user }),
        });
      if (action === "cosmetic") {
        if (
          typeof body.cosmetic !== "string" ||
          !["blue", "slate", "violet", "cyan"].includes(body.cosmetic)
        )
          return respond({ error: "invalid_request" }, 400);
        await repository.rpc("arena_cosmetic", {
          p_player: user,
          p_cosmetic: body.cosmetic,
        });
        return respond({ saved: true });
      }
      if (action === "solve") {
        if (
          typeof body.day !== "string" ||
          typeof body.puzzleId !== "string" ||
          !Array.isArray(body.moves)
        )
          return respond({ error: "invalid_request" }, 400);
        let puzzle, game;
        try {
          puzzle = dailyPuzzle(body.day);
          if (puzzle.id !== body.puzzleId) throw new Error("puzzle");
          game = verifyPuzzle(puzzle, body.moves as number[]);
        } catch {
          return respond({ error: "invalid_puzzle" }, 400);
        }
        await repository.rpc("arena_solve", {
          p_player: user,
          p_day: body.day,
          p_puzzle: puzzle.id,
          p_moves: game.moves,
        });
        return respond({ verified: true });
      }
      if (action === "variant") {
        const operation = body.operation;
        if (
          typeof operation !== "string" ||
          !["create", "join", "fetch", "history", "move", "end"].includes(
            operation,
          ) ||
          (!["fetch", "history"].includes(operation) && !uuid(body.requestId))
        )
          return respond({ error: "invalid_request" }, 400);
        const args: Record<string, unknown> = {
          p_player: user,
          p_action: operation,
          p_request: ["fetch", "history"].includes(operation)
            ? null
            : body.requestId,
          p_match: null,
          p_revision: null,
          p_digest: null,
          p_rule: null,
          p_move: null,
          p_game: null,
        };
        let code: string | undefined;
        if (operation === "create") {
          if (
            typeof body.rule !== "string" ||
            !["ultimate-v1", "blitz-v1"].includes(body.rule)
          )
            return respond({ error: "invalid_request" }, 400);
          args.p_rule = body.rule;
          args.p_game =
            body.rule === "ultimate-v1" ? createUltimate() : createGame();
          code = await invite(inviteSecret, user, String(body.requestId));
          args.p_digest = await digest(code);
        } else if (operation === "join") {
          if (
            typeof body.invite !== "string" ||
            !/^[a-f0-9]{48}$/.test(body.invite)
          )
            return respond({ error: "invalid_invite" }, 400);
          args.p_digest = await digest(body.invite);
        } else if (operation !== "history") {
          if (!uuid(body.matchId))
            return respond({ error: "invalid_request" }, 400);
          args.p_match = body.matchId;
          if (operation === "move" || operation === "end") {
            if (
              !Number.isSafeInteger(body.expectedRevision) ||
              (body.expectedRevision as number) < 0
            )
              return respond({ error: "invalid_request" }, 400);
            args.p_revision = body.expectedRevision;
            if (operation === "move") {
              args.p_move = body.move;
              const fingerprint = {
                matchId: body.matchId,
                revision: body.expectedRevision,
                digest: null,
                rule: null,
                move: body.move,
              };
              const receipt = await repository.receipt(
                user,
                String(body.requestId),
                "variant_move",
                fingerprint,
              );
              if (receipt) return respond({ match: receipt });
              const snapshot = (await repository.rpc("arena_variant", {
                ...args,
                p_action: "fetch",
                p_request: null,
                p_revision: null,
                p_move: null,
              })) as {
                phase: string;
                revision: number;
                rulesVersion: string;
                game: GameState | UltimateState;
                players: { X: string; O: string };
              };
              if (snapshot.phase !== "active")
                return respond({ match: snapshot });
              if (snapshot.revision !== body.expectedRevision)
                return respond({ error: "stale_revision" }, 409);
              if (snapshot.players[snapshot.game.turn] !== user)
                return respond({ error: "wrong_turn" }, 409);
              try {
                args.p_game =
                  snapshot.rulesVersion === "ultimate-v1"
                    ? playUltimate(
                        snapshot.game as UltimateState,
                        body.move as UltimateMove,
                      )
                    : playMove(snapshot.game as GameState, body.move as number);
              } catch {
                return respond({ error: "invalid_move" }, 400);
              }
            }
          }
        }
        const result = await repository.rpc("arena_variant", args);
        return respond(
          operation === "history"
            ? { data: result }
            : { match: result, ...(code ? { invite: code } : {}) },
        );
      }
      if (action === "history" || action === "rooms")
        return respond({
          data: await repository.history(user, action === "rooms"),
        });
      if (action === "queue") {
        if (
          typeof body.operation !== "string" ||
          !["enter", "poll", "cancel", "status"].includes(body.operation) ||
          (body.operation !== "status" && !uuid(body.ticket))
        )
          return respond({ error: "invalid_request" }, 400);
        return respond({
          queue: await repository.rpc("arena_queue", {
            p_player: user,
            p_ticket: body.operation === "status" ? null : body.ticket,
            p_action: body.operation,
            p_game: createGame(),
          }),
        });
      }
      if (action === "leaderboard") {
        if (
          body.region != null &&
          (typeof body.region !== "string" || !/^[A-Z]{2}$/.test(body.region))
        )
          return respond({ error: "invalid_request" }, 400);
        return respond({
          data: await repository.rpc("arena_leaderboard", {
            p_region: body.region ?? null,
          }),
        });
      }
      if (action === "deleteAccount") {
        await repository.rpc("arena_delete_account", { p_player: user });
        await repository.deleteAuthUser(user);
        return respond({ deleted: true });
      }
      if (action === "fetch") {
        if (!uuid(body.matchId))
          return respond({ error: "invalid_request" }, 400);
        return respond({
          match: await repository.snapshot(body.matchId, user),
        });
      }
      if (
        typeof action !== "string" ||
        !["create", "join", "move", "end"].includes(action) ||
        !uuid(body.requestId)
      )
        return respond({ error: "invalid_request" }, 400);
      const request = body.requestId;
      if (action === "create") {
        const code = await invite(inviteSecret, user, request);
        const match = await repository.rpc("arena_create", {
          p_player: user,
          p_request: request,
          p_digest: await digest(code),
          p_game: createGame(),
        });
        return respond({ match, invite: code });
      }
      if (action === "join") {
        if (
          typeof body.invite !== "string" ||
          !/^[a-f0-9]{48}$/.test(body.invite)
        )
          return respond({ error: "invalid_invite" }, 400);
        const match = await repository.rpc("arena_join", {
          p_player: user,
          p_request: request,
          p_digest: await digest(body.invite),
        });
        return respond({ match });
      }
      if (
        !uuid(body.matchId) ||
        !Number.isSafeInteger(body.expectedRevision) ||
        (body.expectedRevision as number) < 0
      )
        return respond({ error: "invalid_request" }, 400);
      const fingerprint = {
        matchId: body.matchId,
        expectedRevision: body.expectedRevision,
        ...(action === "move" ? { square: body.square } : {}),
      };
      if (
        action === "move" &&
        (!Number.isInteger(body.square) ||
          (body.square as number) < 0 ||
          (body.square as number) > 8)
      )
        return respond({ error: "invalid_square" }, 400);
      const previous = await repository.receipt(
        user,
        request,
        String(action),
        fingerprint,
      );
      if (previous) return respond({ match: previous });
      if (action === "end")
        return respond({
          match: await repository.rpc("arena_end", {
            p_player: user,
            p_request: request,
            p_match: body.matchId,
            p_revision: body.expectedRevision,
          }),
        });
      const match = (await repository.snapshot(body.matchId, user)) as {
        game: GameState;
        revision: number;
        phase: string;
        players: { X: string; O: string };
      };
      if (match.revision !== body.expectedRevision)
        return respond({ error: "stale_revision" }, 409);
      if (match.phase !== "active")
        return respond({ error: "match_inactive" }, 409);
      if (match.players[match.game.turn] !== user)
        return respond({ error: "wrong_turn" }, 409);
      const game = playMove(match.game, body.square as number);
      return respond({
        match: await repository.rpc("arena_commit_move", {
          p_player: user,
          p_request: request,
          p_match: body.matchId,
          p_revision: body.expectedRevision,
          p_square: body.square,
          p_game: game,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const known = [
        "puzzle_date",
        "cosmetic_locked",
        "queue_active",
        "queue_superseded",
        "queue_rate_limit",
        "season_closed",
        "not_participant",
        "profile_missing",
        "invalid_invite",
        "invite_expired",
        "room_unavailable",
        "room_limit",
        "rate_limit",
        "request_conflict",
        "stale_revision",
        "wrong_turn",
        "match_inactive",
        "invalid_square",
      ];
      const code =
        known.find((code) => message.includes(code)) ??
        (message.includes("occupied")
          ? "occupied_square"
          : message.includes("Invalid move")
            ? "invalid_move"
            : error instanceof SyntaxError
              ? "invalid_request"
              : "server_error");
      return respond(
        { error: code },
        code === "not_participant"
          ? 403
          : code === "server_error"
            ? 500
            : code === "room_limit" ||
                code === "rate_limit" ||
                code === "queue_rate_limit"
              ? 429
              : code === "invalid_request"
                ? 400
                : 409,
      );
    }
  };
}
