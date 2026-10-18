import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { Client, Pool } from "pg";
import {
  decodeQueue,
  decodeOnlineMatch,
  type QueueState,
  type OnlineMatch,
} from "../../packages/online/src/model";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createGame, playMove } from "../../packages/game-engine/src/index";
import { createArenaHandler, type Repository } from "../functions/arena/core";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  c = "33333333-3333-4333-8333-333333333333";
interface Database {
  query<T>(sql: string, args?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
}
let db: Database;
let counter = 0;
let parallel = false;
let connectionPool: Pool | null = null;
const id = () =>
  `aaaaaaaa-aaaa-4aaa-8aaa-${(++counter).toString(16).padStart(12, "0")}`;
const call = async (name: string, args: Record<string, unknown>) => {
  const keys = Object.keys(args);
  const result = await db.query<{ value: unknown }>(
    `select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(",")}) as value`,
    Object.values(args).map((v) =>
      typeof v === "object" && v !== null ? JSON.stringify(v) : v,
    ),
  );
  return result.rows[0].value;
};
const repository: Repository = {
  async rpc(name, args) {
    return call(name, args);
  },
  async snapshot(match, user) {
    const s = (await call("arena_snapshot", { p_match_id: match })) as {
      players: { X: string; O: string };
    };
    if (!s || ![s.players.X, s.players.O].includes(user))
      throw new Error("not_participant");
    return s;
  },
  async receipt(user, request, action, fingerprint) {
    return call("arena_receipt", {
      p_player: user,
      p_request: request,
      p_action: action,
      p_fingerprint: fingerprint,
    });
  },
  async history(user, active = false) {
    const result = await db.query<{ value: unknown }>(
      `select public.arena_snapshot(id) value from public.online_matches where $1 in (owner_id,guest_id) and phase in (${active ? "'waiting','active'" : "'completed','forfeited','abandoned'"}) order by updated_at desc`,
      [user],
    );
    return result.rows.map((r) => r.value);
  },
  async deleteAuthUser(user) {
    await db.query("delete from auth.users where id=$1", [user]);
  },
};
const identities = new Set([a, b, c]);
const handler = createArenaHandler({
  repository,
  inviteSecret: "local-test-only-secret-not-a-production-secret",
  authenticate: async (token) => (identities.has(token) ? token : null),
});
async function request(user: string, body: Record<string, unknown>) {
  const response = await handler(
    new Request("http://localhost/arena", {
      method: "POST",
      headers: {
        authorization: `Bearer ${user}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, ...(await response.json()) } as {
    status: number;
    error?: string;
    match: OnlineMatch;
    invite: string;
    data?: OnlineMatch[];
    queue: QueueState;
  };
}
async function room(owner = a, guest = b) {
  const created = await request(owner, { action: "create", requestId: id() });
  expect(created.status).toBe(200);
  const joined = await request(guest, {
    action: "join",
    invite: created.invite,
    requestId: id(),
  });
  expect(joined.status).toBe(200);
  return joined.match;
}
beforeAll(async () => {
  if (process.env.NEXO_TEST_DATABASE_URL) {
    const rootUrl = new URL(process.env.NEXO_TEST_DATABASE_URL);
    if (
      !["localhost", "127.0.0.1"].includes(rootUrl.hostname) ||
      rootUrl.pathname !== "/nexo_tests"
    )
      throw new Error("Use the isolated localhost nexo_tests container.");
    const admin = new Client({ connectionString: rootUrl.toString() });
    await admin.connect();
    const databaseName = `nexo_test_${process.pid}_${Date.now()}`;
    await admin.query(`create database ${databaseName}`);
    rootUrl.pathname = `/${databaseName}`;
    const connectionString = rootUrl.toString();
    const client = new Client({ connectionString });
    await client.connect();
    connectionPool = new Pool({ connectionString, max: 4 });
    db = {
      async query<T>(sql, args) {
        const result = await (parallel ? connectionPool! : client).query(
          sql,
          args,
        );
        return { rows: result.rows as T[] };
      },
      exec: (sql) => client.query(sql),
      async close() {
        await connectionPool!.end();
        await client.end();
        await admin.query(`drop database ${databaseName}`);
        await admin.end();
      },
    };
  } else {
    db = new PGlite();
  }
  await db.exec(
    `do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select from pg_roles where rolname='service_role') then create role service_role bypassrls; end if; end $$;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261010000100_online_arena.sql",
      "utf8",
    ),
  );
  for (const user of [a, b, c])
    await db.query("insert into auth.users(id) values ($1)", [user]);
  await db.exec(
    await readFile(
      "supabase/migrations/20261010000200_ranked_arena.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261010000300_signature_studio.sql",
      "utf8",
    ),
  );
});
afterAll(async () => {
  await db.close();
});
describe("real PostgreSQL schema and server handler", () => {
  it("rejects missing/invalid auth, malformed JSON and methods", async () => {
    expect(
      (await request("invalid", { action: "create", requestId: id() })).status,
    ).toBe(401);
    expect(
      (await handler(new Request("http://localhost", { method: "GET" })))
        .status,
    ).toBe(405);
    expect(
      (
        await handler(
          new Request("http://localhost", {
            method: "POST",
            headers: { authorization: `Bearer ${a}` },
            body: "{bad",
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("creates and joins idempotently with a stable private invitation", async () => {
    const req = id();
    const one = await request(a, { action: "create", requestId: req });
    const two = await request(a, { action: "create", requestId: req });
    expect(two.invite).toBe(one.invite);
    expect(two.match.matchId).toBe(one.match.matchId);
    const join = id();
    const first = await request(b, {
      action: "join",
      invite: one.invite,
      requestId: join,
    });
    const second = await request(b, {
      action: "join",
      invite: one.invite,
      requestId: join,
    });
    expect(second.match).toEqual(first.match);
    expect(
      (
        await request(c, {
          action: "join",
          invite: one.invite,
          requestId: id(),
        })
      ).error,
    ).toBe("room_unavailable");
  });
  it("enforces turn, occupied square and stale revision checks", async () => {
    let match = await room();
    expect(
      (
        await request(b, {
          action: "move",
          matchId: match.matchId,
          expectedRevision: match.revision,
          square: 0,
          requestId: id(),
        })
      ).error,
    ).toBe("wrong_turn");
    const rev = match.revision;
    const result = await request(a, {
      action: "move",
      matchId: match.matchId,
      expectedRevision: rev,
      square: 0,
      requestId: id(),
    });
    match = result.match;
    expect(
      (
        await request(b, {
          action: "move",
          matchId: match.matchId,
          expectedRevision: rev,
          square: 1,
          requestId: id(),
        })
      ).error,
    ).toBe("stale_revision");
    expect(
      (
        await request(b, {
          action: "move",
          matchId: match.matchId,
          expectedRevision: match.revision,
          square: 0,
          requestId: id(),
        })
      ).error,
    ).toBe("occupied_square");
  });
  it("uses the shared engine and records a win once under duplicate requests", async () => {
    let match = await room();
    let lastRequest = "";
    let lastBody: Record<string, unknown> = {};
    let game = createGame();
    for (const [ply, square] of [0, 3, 1, 4, 2].entries()) {
      game = playMove(game, square);
      lastRequest = id();
      lastBody = {
        action: "move",
        matchId: match.matchId,
        expectedRevision: match.revision,
        square,
        requestId: lastRequest,
      };
      const result = await request(ply % 2 ? b : a, lastBody);
      expect(result.status).toBe(200);
      match = result.match;
      expect(match.game).toEqual(game);
    }
    expect(match.phase).toBe("completed");
    expect(match.result).toBe("X");
    expect((await request(a, lastBody)).match).toEqual(match);
    const moves = await db.query(
      "select * from public.online_moves where match_id=$1",
      [match.matchId],
    );
    expect(moves.rows).toHaveLength(5);
    expect(
      (
        await request(b, {
          action: "move",
          matchId: match.matchId,
          expectedRevision: match.revision,
          square: 8,
          requestId: id(),
        })
      ).error,
    ).toBe("match_inactive");
    expect((await request(a, { ...lastBody, square: 8 })).error).toBe(
      "request_conflict",
    );
  });
  it("only admits one guest when joins race", async () => {
    const created = await request(a, { action: "create", requestId: id() });
    parallel = true;
    const outcomes = await Promise.all([
      request(b, { action: "join", invite: created.invite, requestId: id() }),
      request(c, { action: "join", invite: created.invite, requestId: id() }),
    ]).finally(() => {
      parallel = false;
    });
    expect(outcomes.filter((r) => r.status === 200)).toHaveLength(1);
    expect(outcomes.filter((r) => r.error === "room_unavailable")).toHaveLength(
      1,
    );
  });
  it("a stale computed server move cannot commit a second turn", async () => {
    const match = await room();
    const args = {
      p_player: a,
      p_request: id(),
      p_match: match.matchId,
      p_revision: match.revision,
      p_square: 0,
      p_game: playMove(createGame(), 0),
    };
    await call("arena_commit_move", args);
    await expect(
      call("arena_commit_move", { ...args, p_request: id() }),
    ).rejects.toThrow("stale_revision");
  });
  it("commits concurrent duplicate moves exactly once", async () => {
    const match = await room();
    const body = {
      action: "move",
      matchId: match.matchId,
      expectedRevision: match.revision,
      square: 0,
      requestId: id(),
    };
    parallel = true;
    const results = await Promise.all([
      request(a, body),
      request(a, body),
    ]).finally(() => {
      parallel = false;
    });
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results[0].match).toEqual(results[1].match);
    expect(
      (
        await db.query("select * from public.online_moves where match_id=$1", [
          match.matchId,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("rejects one of two conflicting concurrent moves", async () => {
    const match = await room();
    parallel = true;
    const outcomes = await Promise.all(
      [0, 1].map((square) =>
        request(a, {
          action: "move",
          matchId: match.matchId,
          expectedRevision: match.revision,
          square,
          requestId: id(),
        }),
      ),
    ).finally(() => {
      parallel = false;
    });
    expect(outcomes.filter((r) => r.status === 200)).toHaveLength(1);
    expect(outcomes.filter((r) => r.error === "stale_revision")).toHaveLength(
      1,
    );
  });
  it("records a draw and ignores client-supplied game states", async () => {
    let match = await room();
    for (const [ply, square] of [0, 1, 2, 4, 3, 5, 7, 6, 8].entries()) {
      const result = await request(ply % 2 ? b : a, {
        action: "move",
        matchId: match.matchId,
        expectedRevision: match.revision,
        square,
        requestId: id(),
        game: { winner: "O", status: "won" },
      });
      expect(result.status).toBe(200);
      match = result.match;
    }
    expect(match.phase).toBe("completed");
    expect(match.result).toBe("draw");
    expect(match.game.status).toBe("draw");
  });
  it("returns participant history only and denies nonmembers", async () => {
    const match = await room();
    expect(
      (await request(c, { action: "fetch", matchId: match.matchId })).status,
    ).toBe(403);
    const ended = await request(a, {
      action: "end",
      matchId: match.matchId,
      expectedRevision: match.revision,
      requestId: id(),
    });
    expect(ended.match.phase).toBe("forfeited");
    expect(ended.match.result).toBe("O");
    const history = (await repository.history(c)) as { matchId: string }[];
    expect(history.some((r) => r.matchId === match.matchId)).toBe(false);
  });
  it("lists open rooms only for their participants", async () => {
    const match = await room();
    const mine = await request(a, { action: "rooms" });
    expect(mine.data?.some((m) => m.matchId === match.matchId)).toBe(true);
    const other = await request(c, { action: "rooms" });
    expect(other.data?.some((m) => m.matchId === match.matchId)).toBe(false);
  });
  it("expires invites and caps active waiting rooms", async () => {
    const created = await request(a, { action: "create", requestId: id() });
    await db.query(
      "update public.online_matches set expires_at=now()-interval '1 minute' where id=$1",
      [created.match.matchId],
    );
    expect(
      (
        await request(b, {
          action: "join",
          invite: created.invite,
          requestId: id(),
        })
      ).error,
    ).toBe("invite_expired");
    const rooms = [];
    for (let i = 0; i < 3; i++)
      rooms.push(await request(c, { action: "create", requestId: id() }));
    expect(rooms.every((r) => r.status === 200)).toBe(true);
    expect(
      (await request(c, { action: "create", requestId: id() })).error,
    ).toBe("room_limit");
    for (const r of rooms)
      await request(c, {
        action: "end",
        matchId: r.match.matchId,
        expectedRevision: 0,
        requestId: id(),
      });
  });
  it("RLS exposes only own profile and participant matches, denying direct writes/RPCs", async () => {
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${c}',false);`,
    );
    try {
      const profiles = await db.query<{ id: string }>(
        "select id from public.profiles",
      );
      expect(profiles.rows.map((r) => r.id)).toEqual([c]);
      const matches = await db.query<{ owner_id: string; guest_id: string }>(
        "select owner_id,guest_id from public.online_matches",
      );
      expect(
        matches.rows.every((m) => [m.owner_id, m.guest_id].includes(c)),
      ).toBe(true);
      await expect(
        db.query("update public.online_matches set revision=999"),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("select public.arena_snapshot($1)", [id()]),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("select public.arena_create($1,$2,$3,$4)", [
          c,
          id(),
          "0".repeat(64),
          JSON.stringify(createGame()),
        ]),
      ).rejects.toThrow("permission denied");
      await expect(db.query("select * from private.invites")).rejects.toThrow(
        "permission denied",
      );
      await expect(
        db.query("update public.profiles set id=$1 where id=$2", [id(), c]),
      ).rejects.toThrow("permission denied");
      await db.query(
        "update public.profiles set display_name='Ada',handle='ada_test' where id=$1",
        [c],
      );
    } finally {
      await db.exec(
        "reset role;select set_config('request.jwt.claim.sub','',false);",
      );
    }
  });
  it("anonymous callers cannot read private data", async () => {
    await db.exec("set role anon");
    try {
      await expect(
        db.query("select * from public.online_matches"),
      ).rejects.toThrow("permission denied");
      await expect(db.query("select * from public.profiles")).rejects.toThrow(
        "permission denied",
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("account deletion anonymizes histories and removes data access immediately", async () => {
    const match = await room();
    const moveBody = {
      action: "move",
      matchId: match.matchId,
      expectedRevision: match.revision,
      square: 0,
      requestId: id(),
    };
    const moved = await request(a, moveBody);
    expect(moved.status).toBe(200);
    await request(b, {
      action: "end",
      matchId: match.matchId,
      expectedRevision: moved.match.revision,
      requestId: id(),
    });
    const result = await request(b, { action: "deleteAccount" });
    expect(result.status).toBe(200);
    const snapshot = (await repository.snapshot(match.matchId, a)) as {
      players: { O: string | null };
      playerNames: { O: string };
      revision: number;
    };
    expect(snapshot.players.O).toBeNull();
    expect(snapshot.playerNames.O).toBe("Deleted player");
    expect(
      (
        await db.query(
          "select * from private.command_receipts where response #>> '{players,O}'=$1 or response #>> '{players,X}'=$1",
          [b],
        )
      ).rows,
    ).toHaveLength(0);
    expect((await request(a, moveBody)).error).toBe("stale_revision");
    expect(
      (await request(a, { ...moveBody, expectedRevision: snapshot.revision }))
        .error,
    ).toBe("match_inactive");
    expect(
      (
        await db.query("select * from public.online_moves where match_id=$1", [
          match.matchId,
        ])
      ).rows,
    ).toHaveLength(1);
    expect(
      (await db.query("select * from public.profiles where id=$1", [b])).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from auth.users where id=$1", [b])).rows,
    ).toHaveLength(0);
    expect(
      (await request(b, { action: "fetch", matchId: match.matchId })).status,
    ).toBe(403);
  });
});

describe("ranked queue, ratings and public projections", () => {
  beforeEach(async () => {
    await db.query(
      "update public.matchmaking_queue set status='expired' where status='waiting'",
    );
  });
  async function player(region = "NG") {
    const user = id();
    identities.add(user);
    await db.query("insert into auth.users(id) values($1)", [user]);
    await db.query("update public.profiles set region=$2 where id=$1", [
      user,
      region,
    ]);
    return user;
  }
  async function queue(user: string, operation = "enter", ticket = id()) {
    const r = await request(user, { action: "queue", operation, ticket });
    expect(r.status, r.error).toBe(200);
    return decodeQueue(r.queue);
  }
  async function pair(x: string, o: string) {
    await queue(x);
    const q = await queue(o);
    expect(q.status).toBe("matched");
    return q.match!;
  }
  async function end(match: OnlineMatch, user = match.players.X!) {
    const body = {
      action: "end",
      matchId: match.matchId,
      expectedRevision: match.revision,
      requestId: id(),
    };
    const r = await request(user, body);
    expect(r.status, r.error).toBe(200);
    return { match: decodeOnlineMatch(r.match), body };
  }
  it("pairs only once, restores both tickets and avoids private invitations", async () => {
    const x = await player(),
      o = await player(),
      t = id();
    expect((await queue(x, "enter", t)).status).toBe("waiting");
    const m = (await queue(o)).match!;
    expect(m.competition).toBe("ranked");
    expect(m.ratingStatus).toBe("pending");
    expect(m.players).toEqual({ X: x, O: o });
    expect((await queue(x, "enter", t)).match?.matchId).toBe(m.matchId);
    expect((await queue(x, "status")).match?.matchId).toBe(m.matchId);
    expect((await queue(x, "cancel", t)).match?.matchId).toBe(m.matchId);
    expect(
      (
        await db.query("select * from private.invites where match_id=$1", [
          m.matchId,
        ])
      ).rows,
    ).toHaveLength(0);
    await end(m);
  });
  it("cancels idempotently, rejects retired tickets, expires absent clients", async () => {
    const p = await player(),
      t = id();
    await queue(p, "enter", t);
    await queue(p, "cancel", t);
    expect((await queue(p, "cancel", t)).status).toBe("cancelled");
    const next = id();
    await queue(p, "enter", next);
    expect(
      (await request(p, { action: "queue", operation: "cancel", ticket: t }))
        .error,
    ).toBe("queue_superseded");
    await db.query(
      "update public.matchmaking_queue set expires_at=now()-interval '1 second' where player_id=$1",
      [p],
    );
    expect((await queue(p, "status")).status).toBe("expired");
  });
  it("widens regional and skill filters using server time", async () => {
    const x = await player("NG"),
      o = await player("GB");
    const q = await queue(x);
    await queue(o);
    expect((await queue(x, "status")).status).toBe("waiting");
    await db.query(
      "update public.matchmaking_queue set joined_at=now()-interval '16 seconds' where player_id=$1",
      [x],
    );
    const m = (await queue(x, "poll", q.ticket!)).match!;
    expect(m).not.toBeNull();
    await end(m);
    const p = await player(),
      r = await player();
    await queue(p, "status");
    await db.query("update public.ratings set rating=1900 where player_id=$1", [
      p,
    ]);
    const t = await queue(p);
    await queue(r);
    expect((await queue(p, "status")).status).toBe("waiting");
    await db.query(
      "update public.matchmaking_queue set joined_at=now()-interval '30 seconds' where player_id=$1",
      [p],
    );
    await end((await queue(p, "poll", t.ticket!)).match!);
  });
  it("settles a played win atomically and a final-move retry changes nothing", async () => {
    const x = await player(),
      o = await player();
    let m = await pair(x, o);
    let finalBody: Record<string, unknown> = {};
    for (const square of [0, 3, 1, 4, 2]) {
      const body = {
        action: "move",
        matchId: m.matchId,
        expectedRevision: m.revision,
        square,
        requestId: id(),
      };
      const r = await request(m.players[m.game.turn]!, body);
      expect(r.status, r.error).toBe(200);
      m = decodeOnlineMatch(r.match);
      finalBody = body;
    }
    expect(m.ratingChanges).toEqual({
      X: { before: 1500, after: 1516, delta: 16 },
      O: { before: 1500, after: 1484, delta: -16 },
    });
    expect((await request(x, finalBody)).match).toEqual(m);
    const q = await queue(x, "status");
    expect(q.rating.games).toBe(1);
    expect(q.rating.wins).toBe(1);
    expect(
      (
        await db.query(
          "select * from private.rating_events where match_id=$1",
          [m.matchId],
        )
      ).rows,
    ).toHaveLength(2);
  });
  it("settles draws and resignation exactly once and limits repeated opponents", async () => {
    const x = await player(),
      o = await player();
    let m = await pair(x, o);
    for (const square of [0, 1, 2, 4, 3, 5, 7, 6, 8]) {
      const r = await request(m.players[m.game.turn]!, {
        action: "move",
        matchId: m.matchId,
        expectedRevision: m.revision,
        square,
        requestId: id(),
      });
      expect(r.status, r.error).toBe(200);
      m = decodeOnlineMatch(r.match);
    }
    expect(m.result).toBe("draw");
    expect(m.ratingChanges?.X.delta).toBe(0);
    for (let i = 0; i < 3; i++) {
      const ended = await end(await pair(x, o));
      expect(ended.match.ratingStatus).toBe(i < 2 ? "settled" : "void");
      expect((await request(x, ended.body)).match).toEqual(ended.match);
      if (i === 2)
        expect(ended.match.ratingVoidReason).toBe("repeat_pair_limit");
    }
    expect((await queue(x, "status")).rating.games).toBe(3);
  });
  it("private games remain unrated", async () => {
    const x = await player(),
      o = await player();
    const m = await room(x, o);
    const finished = (await end(m)).match;
    expect(finished.ratingStatus).toBe("unrated");
    expect(finished.ratingChanges).toBeNull();
    expect(
      (await db.query("select * from public.ratings where player_id=$1", [x]))
        .rows,
    ).toHaveLength(0);
  });
  it("rolls back the terminal result if either rating update fails", async () => {
    const x = await player(),
      o = await player(),
      m = await pair(x, o);
    await db.exec(
      `create function private.fail_test_rating() returns trigger language plpgsql as $$ begin if new.player_id='${o}'::uuid then raise exception 'test_rating_failure';end if;return new;end $$;create trigger test_rating_failure before update on public.ratings for each row execute function private.fail_test_rating();`,
    );
    try {
      const r = await request(x, {
        action: "end",
        matchId: m.matchId,
        expectedRevision: m.revision,
        requestId: id(),
      });
      expect(r.status).toBe(500);
      const current = decodeOnlineMatch(
        await repository.snapshot(m.matchId, x),
      );
      expect(current.phase).toBe("active");
      expect(current.revision).toBe(m.revision);
      expect(current.ratingStatus).toBe("pending");
      expect((await queue(x, "status")).rating.games).toBe(0);
      expect(
        (
          await db.query(
            "select * from private.rating_events where match_id=$1",
            [m.matchId],
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await db.exec(
        "drop trigger test_rating_failure on public.ratings;drop function private.fail_test_rating();",
      );
    }
    await end(m);
  });
  it("settles concurrent duplicate resignations once", async () => {
    const x = await player(),
      o = await player(),
      m = await pair(x, o),
      body = {
        action: "end",
        matchId: m.matchId,
        expectedRevision: m.revision,
        requestId: id(),
      };
    parallel = true;
    let results: Awaited<ReturnType<typeof request>>[];
    try {
      results = await Promise.all(
        Array.from({ length: 4 }, () => request(x, body)),
      );
    } finally {
      parallel = false;
    }
    expect(results!.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(
      results!.every(
        (r) => JSON.stringify(r.match) === JSON.stringify(results![0].match),
      ),
    ).toBe(true);
    expect((await queue(x, "status")).rating.games).toBe(1);
    expect(
      (
        await db.query(
          "select * from private.rating_events where match_id=$1",
          [m.matchId],
        )
      ).rows,
    ).toHaveLength(2);
  });
  it("awards the ranked milestone exactly once after ten accepted rated results", async () => {
    const x = await player();
    for (let i = 0; i < 11; i++) {
      const o = await player(),
        m = await pair(x, o);
      const { body } = await end(m, i % 2 === 0 ? o : x);
      expect((await request(i % 2 === 0 ? o : x, body)).status).toBe(200);
      const badges = (
        await db.query<{ classic_match: string }>(
          "select classic_match from public.player_achievements where player_id=$1 and code='ranked_ten'",
          [x],
        )
      ).rows;
      expect(badges).toHaveLength(i < 9 ? 0 : 1);
      if (i === 9) expect(badges[0].classic_match).toBe(m.matchId);
    }
    expect(
      (
        await db.query<{ games: number }>(
          "select games from public.ratings where player_id=$1",
          [x],
        )
      ).rows[0].games,
    ).toBe(11);
  });
  it("shows only opted-in handles after placements, with regional rankings", async () => {
    const x = await player("NG"),
      o = await player("GB");
    await queue(x, "status");
    await queue(o, "status");
    await db.query(
      "update public.ratings set games=10,wins=10,rating=1600 where player_id in($1,$2)",
      [x, o],
    );
    await db.query(
      "update public.profiles set handle=case when id=$1 then 'ranked_ng' else 'ranked_gb' end where id in($1,$2)",
      [x, o],
    );
    expect(await call("arena_leaderboard", { p_region: null })).toEqual([]);
    await db.query(
      "update public.profiles set leaderboard_visible=true where id in($1,$2)",
      [x, o],
    );
    const entries = (await call("arena_leaderboard", {
      p_region: "NG",
    })) as Record<string, unknown>[];
    expect(entries).toHaveLength(1);
    expect(entries[0].handle).toBe("ranked_ng");
    expect(entries[0].rank).toBe(1);
    expect(entries[0]).not.toHaveProperty("player_id");
    expect(entries[0]).not.toHaveProperty("display_name");
    await db.query(
      "update public.profiles set region='GB',handle='renamed_ng' where id=$1",
      [x],
    );
    expect(await call("arena_leaderboard", { p_region: "NG" })).toEqual([]);
    await db.query(
      "update public.profiles set leaderboard_visible=false where id in($1,$2)",
      [x, o],
    );
    expect(await call("arena_leaderboard", { p_region: null })).toEqual([]);
  });
  it("enforces queue/rating RLS and rejects direct client settlement RPCs", async () => {
    const x = await player(),
      o = await player();
    await queue(x, "status");
    await queue(o);
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${x}',false);`,
    );
    try {
      expect(
        (await db.query("select * from public.matchmaking_queue")).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query<{ player_id: string }>("select * from public.ratings")
        ).rows.map((r) => r.player_id),
      ).toEqual([x]);
      await expect(
        db.query("update public.ratings set rating=9999"),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("select public.arena_queue($1,$2,'enter',$3)", [
          x,
          id(),
          JSON.stringify(createGame()),
        ]),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("select * from private.leaderboard_entries"),
      ).rejects.toThrow("permission denied");
    } finally {
      await db.exec(
        "reset role;select set_config('request.jwt.claim.sub','',false);",
      );
    }
    await queue(o, "cancel", (await queue(o, "status")).ticket!);
    expect(
      (await request(x, { action: "leaderboard", region: "invalid" })).status,
    ).toBe(400);
    expect(
      (
        await request(x, {
          action: "queue",
          operation: ["enter"],
          ticket: id(),
        })
      ).status,
    ).toBe(400);
  });
  it("limits new searches per hour without penalizing status or same-ticket retries", async () => {
    const p = await player();
    const tickets = Array.from({ length: 40 }, id);
    for (const ticket of tickets) {
      await queue(p, "enter", ticket);
      await queue(p, "cancel", ticket);
    }
    expect(
      (await request(p, { action: "queue", operation: "enter", ticket: id() }))
        .status,
    ).toBe(429);
    expect((await queue(p, "status")).status).toBe("cancelled");
  });
  it("matches concurrent entrants once per identity on independent PostgreSQL connections", async () => {
    const players: string[] = [];
    for (let i = 0; i < 12; i++) players.push(await player("CA"));
    parallel = true;
    try {
      await Promise.all(players.map((p) => queue(p)));
    } finally {
      parallel = false;
    }
    const rows = (
      await db.query<{ id: string; owner_id: string; guest_id: string }>(
        "select id,owner_id,guest_id from public.online_matches where competition='ranked' and phase='active' and owner_id=any($1::uuid[])",
        [players],
      )
    ).rows;
    expect(rows).toHaveLength(6);
    expect(new Set(rows.flatMap((m) => [m.owner_id, m.guest_id])).size).toBe(
      12,
    );
    for (const r of rows)
      await end((await repository.snapshot(r.id, r.owner_id)) as OnlineMatch);
  });
  it("account deletion voids active ranked games and clears queue, rating and projection", async () => {
    const x = await player(),
      o = await player();
    const m = await pair(x, o);
    expect((await request(o, { action: "deleteAccount" })).status).toBe(200);
    const snapshot = decodeOnlineMatch(await repository.snapshot(m.matchId, x));
    expect(snapshot.phase).toBe("abandoned");
    expect(snapshot.ratingStatus).toBe("void");
    expect(snapshot.players.O).toBeNull();
    expect((await queue(x, "status")).rating.games).toBe(0);
    for (const table of [
      "public.matchmaking_queue",
      "public.ratings",
      "private.leaderboard_entries",
    ])
      expect(
        (await db.query(`select * from ${table} where player_id=$1`, [o])).rows,
      ).toHaveLength(0);
  });
  it("anonymizes retained rating events after deleting a completed player", async () => {
    const x = await player(),
      o = await player(),
      m = (await end(await pair(x, o))).match;
    expect((await request(o, { action: "deleteAccount" })).status).toBe(200);
    const events = (
      await db.query<{ mark: string; player_id: string | null }>(
        "select mark,player_id from private.rating_events where match_id=$1",
        [m.matchId],
      )
    ).rows;
    expect(events.find((e) => e.mark === "O")?.player_id).toBeNull();
    expect(events.find((e) => e.mark === "X")?.player_id).toBe(x);
    expect(
      decodeOnlineMatch(await repository.snapshot(m.matchId, x)).ratingStatus,
    ).toBe("settled");
  });
});

describe("signature server clocks, verified telemetry and replay logs", () => {
  async function player() {
    const user = id();
    identities.add(user);
    await db.query("insert into auth.users(id) values($1)", [user]);
    return user;
  }
  async function vr(user: string, body: Record<string, unknown>) {
    return (await request(user, { action: "variant", ...body })) as unknown as {
      status: number;
      error?: string;
      match: import("../../packages/online/src/signature").SignatureMatch;
      invite: string;
      data?: unknown[];
    };
  }
  async function pair(rule = "blitz-v1") {
    const x = await player(),
      o = await player(),
      made = await vr(x, { operation: "create", rule, requestId: id() });
    expect(made.status, made.error).toBe(200);
    const joined = await vr(o, {
      operation: "join",
      invite: made.invite,
      requestId: id(),
    });
    expect(joined.status, joined.error).toBe(200);
    return { x, o, match: joined.match, invite: made.invite };
  }
  it("creates and joins versioned invitations idempotently and keeps them private", async () => {
    const x = await player(),
      o = await player(),
      requestId = id();
    const a = await vr(x, {
      operation: "create",
      rule: "ultimate-v1",
      requestId,
    });
    const b = await vr(x, {
      operation: "create",
      rule: "ultimate-v1",
      requestId,
    });
    expect(a.match).toEqual(b.match);
    expect(a.invite).toBe(b.invite);
    expect(
      (await vr(o, { operation: "fetch", matchId: a.match.matchId })).status,
    ).toBe(403);
    const joined = await vr(o, {
      operation: "join",
      invite: a.invite,
      requestId: id(),
    });
    expect(joined.match.rulesVersion).toBe("ultimate-v1");
    expect(joined.match.clock).toBeNull();
    expect(
      (
        await vr(await player(), {
          operation: "join",
          invite: a.invite,
          requestId: id(),
        })
      ).error,
    ).toBe("room_unavailable");
  });
  it("validates Ultimate routing with the shared engine and rejects forged client state", async () => {
    const { x, o, match } = await pair("ultimate-v1");
    const r = await vr(x, {
      operation: "move",
      matchId: match.matchId,
      expectedRevision: match.revision,
      requestId: id(),
      move: { board: 4, cell: 2 },
      game: { status: "won", winner: "X" },
    });
    expect(r.status, r.error).toBe(200);
    expect(
      (r.match.game as import("@nexo/engine").UltimateState).forcedBoard,
    ).toBe(2);
    expect(r.match.phase).toBe("active");
    expect(
      (
        await vr(o, {
          operation: "move",
          matchId: match.matchId,
          expectedRevision: r.match.revision,
          requestId: id(),
          move: { board: 3, cell: 0 },
        })
      ).error,
    ).toBe("invalid_move");
    expect(
      (
        await vr(x, {
          operation: "move",
          matchId: match.matchId,
          expectedRevision: r.match.revision,
          requestId: id(),
          move: { board: 2, cell: 0 },
        })
      ).error,
    ).toBe("wrong_turn");
  });
  it("deducts server elapsed time and ignores client clock/winner payloads", async () => {
    const { x, match } = await pair();
    await db.query(
      "update public.signature_matches set turn_started_at=clock_timestamp()-interval '10 seconds' where id=$1",
      [match.matchId],
    );
    const r = await vr(x, {
      operation: "move",
      matchId: match.matchId,
      expectedRevision: match.revision,
      requestId: id(),
      move: 0,
      clock: { X: 999999 },
      result: "X",
    });
    expect(r.status, r.error).toBe(200);
    expect(r.match.clock!.X).toBeLessThanOrEqual(50000);
    expect(r.match.clock!.X).toBeGreaterThan(48000);
    expect(r.match.clock!.O).toBe(60000);
    expect(r.match.result).toBeNull();
    expect(r.match.game.turn).toBe("O");
  });
  it("adjudicates elapsed deadlines on fetch and forbids late moves", async () => {
    const { x, o, match } = await pair();
    await db.query(
      "update public.signature_matches set turn_started_at=clock_timestamp()-interval '61 seconds' where id=$1",
      [match.matchId],
    );
    const ended = await vr(x, {
      operation: "move",
      matchId: match.matchId,
      expectedRevision: match.revision,
      requestId: id(),
      move: 0,
    });
    expect(ended.match.phase).toBe("timeout");
    expect(ended.match.result).toBe("O");
    expect(ended.match.game.moves).toEqual([]);
    expect(ended.match.clock!.X).toBe(0);
    expect(
      (await vr(o, { operation: "fetch", matchId: match.matchId })).match
        .revision,
    ).toBe(ended.match.revision);
    const extra = (await request(o, { action: "extras" })) as unknown as {
      extras: import("../../packages/online/src/signature").Extras;
    };
    expect(extra.extras.achievements.map((a) => a.code)).toEqual(
      expect.arrayContaining(["first_verified_win", "first_blitz_win"]),
    );
  });
  it("commits duplicate timed moves once and never deducts time twice", async () => {
    const { x, match } = await pair(),
      body = {
        operation: "move",
        matchId: match.matchId,
        expectedRevision: match.revision,
        requestId: id(),
        move: 0,
      };
    parallel = true;
    let results: Awaited<ReturnType<typeof vr>>[];
    try {
      results = await Promise.all([vr(x, body), vr(x, body)]);
    } finally {
      parallel = false;
    }
    expect(results![0].status).toBe(200);
    expect(results![1].match).toEqual(results![0].match);
    expect(
      (
        await db.query(
          "select * from public.signature_moves where match_id=$1",
          [match.matchId],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("returns accepted replay logs only to participants and detects tampered snapshots", async () => {
    const { x, o, match } = await pair();
    let m = match;
    for (const square of [0, 3, 1, 4, 2]) {
      const r = await vr(m.players[m.game.turn]!, {
        operation: "move",
        matchId: m.matchId,
        expectedRevision: m.revision,
        requestId: id(),
        move: square,
      });
      expect(r.status, r.error).toBe(200);
      m = r.match;
    }
    const replay = (await request(o, {
      action: "replay",
      matchId: m.matchId,
      signature: true,
    })) as unknown as {
      status: number;
      replay: import("@nexo/engine").ReplayRecord;
    };
    expect(replay.status).toBe(200);
    expect(replay.replay.moves).toEqual([0, 3, 1, 4, 2]);
    expect(replay.replay.source).toBe("server");
    expect(
      (
        await request(await player(), {
          action: "replay",
          matchId: m.matchId,
          signature: true,
        })
      ).status,
    ).toBe(403);
    const r = (await request(x, { action: "extras" })) as unknown as {
      extras: import("../../packages/online/src/signature").Extras;
    };
    expect(
      r.extras.achievements.some((a) => a.code === "first_blitz_win"),
    ).toBe(true);
    expect(
      (
        await db.query(
          "select * from public.ratings where player_id in($1,$2)",
          [x, o],
        )
      ).rows,
    ).toHaveLength(0);
    await db.query(
      "delete from public.signature_moves where match_id=$1 and ply=5",
      [m.matchId],
    );
    expect(
      (
        await request(x, {
          action: "replay",
          matchId: m.matchId,
          signature: true,
        })
      ).status,
    ).toBe(500);
  });
  it("verifies daily winning proofs, awards once and rejects incorrect dates/replies", async () => {
    const { dailyPuzzle, puzzleStart, playPuzzle, analyzeClassic } =
      await import("../../packages/game-engine/src/index");
    const user = await player(),
      day = new Date().toISOString().slice(0, 10),
      p = dailyPuzzle(day);
    let game = puzzleStart(p);
    while (game.status === "playing")
      game = playPuzzle(p, game, analyzeClassic(game).bestMoves[0]);
    const body = { action: "solve", day, puzzleId: p.id, moves: game.moves };
    expect((await request(user, body)).status).toBe(200);
    expect((await request(user, body)).status).toBe(200);
    expect(
      (
        await db.query(
          "select * from public.puzzle_solves where player_id=$1",
          [user],
        )
      ).rows,
    ).toHaveLength(1);
    expect((await request(user, { ...body, moves: p.seed })).error).toBe(
      "invalid_puzzle",
    );
    expect((await request(user, { ...body, puzzleId: "fake" })).error).toBe(
      "invalid_puzzle",
    );
    const yesterday = new Date(Date.parse(day + "T00:00:00Z") - 86400000)
        .toISOString()
        .slice(0, 10),
      previousPuzzle = dailyPuzzle(yesterday);
    let previousGame = puzzleStart(previousPuzzle);
    while (previousGame.status === "playing")
      previousGame = playPuzzle(
        previousPuzzle,
        previousGame,
        analyzeClassic(previousGame).bestMoves[0],
      );
    expect(
      (
        await request(user, {
          action: "solve",
          day: yesterday,
          puzzleId: previousPuzzle.id,
          moves: previousGame.moves,
        })
      ).error,
    ).toBe("puzzle_date");
    expect(
      (await request(user, { action: "cosmetic", cosmetic: "cyan" })).status,
    ).toBe(200);
    expect(
      (await request(user, { action: "cosmetic", cosmetic: "violet" })).error,
    ).toBe("cosmetic_locked");
  });
  it("denies direct client telemetry/clock/cosmetic writes and other-player reads", async () => {
    const { x, o, match } = await pair();
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${x}',false);`,
    );
    try {
      await expect(
        db.query("update public.signature_matches set remaining_x=60000"),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query(
          "insert into public.player_achievements(player_id,code,puzzle_day) values($1,'puzzle_solver',current_date)",
          [x],
        ),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("update public.profiles set cosmetic='cyan' where id=$1", [x]),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("select public.arena_cosmetic($1,$2)", [x, "cyan"]),
      ).rejects.toThrow("permission denied");
      expect(
        (
          await db.query(
            "select * from public.player_achievements where player_id=$1",
            [o],
          )
        ).rows,
      ).toHaveLength(0);
    } finally {
      await db.exec(
        "reset role;select set_config('request.jwt.claim.sub','',false);",
      );
    }
    expect(
      (await vr(x, { operation: "fetch", matchId: match.matchId })).status,
    ).toBe(200);
  });
  it("anonymizes signature matches and removes verified telemetry on deletion", async () => {
    const { x, o, match } = await pair("ultimate-v1");
    await vr(o, {
      operation: "end",
      matchId: match.matchId,
      expectedRevision: match.revision,
      requestId: id(),
    });
    expect((await request(x, { action: "deleteAccount" })).status).toBe(200);
    const m = (await vr(o, { operation: "fetch", matchId: match.matchId }))
      .match;
    expect(m.players.X).toBeNull();
    expect(m.playerNames.X).toBe("Deleted player");
    expect(
      (
        await db.query(
          "select * from public.player_achievements where player_id=$1",
          [x],
        )
      ).rows,
    ).toHaveLength(0);
  });
});
