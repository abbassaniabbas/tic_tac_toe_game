import { beforeAll, afterAll, it, expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  createOnlineApi,
  decodeSignature,
  type SignatureMatch,
} from "@nexo/online";
import {
  dailyPuzzle,
  puzzleStart,
  playPuzzle,
  analyzeClassic,
} from "@nexo/engine";

const url = process.env.NEXO_INTEGRATION_URL!,
  key = process.env.NEXO_INTEGRATION_KEY!,
  mail = process.env.NEXO_INTEGRATION_MAIL!;
for (const value of [url, mail, process.env.NEXO_INTEGRATION_DB])
  if (
    !value ||
    !["127.0.0.1", "localhost", "[::1]"].includes(new URL(value).hostname)
  )
    throw new Error("Only the local test stack is allowed.");
const clients: SupabaseClient[] = [],
  users: string[] = [];
const admin = createClient(url, process.env.NEXO_INTEGRATION_SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
let a: SupabaseClient, b: SupabaseClient;
let aa: ReturnType<typeof createOnlineApi>,
  bb: ReturnType<typeof createOnlineApi>;
const run = randomUUID().replaceAll("-", "").slice(0, 12);
export async function localEmailCode(email: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await fetch(`${mail}/api/v1/messages`).then((r) => r.json());
    const message = list.messages?.find(
      (m: { ID: string; To: { Address: string }[] }) =>
        m.To?.some((t) => t.Address === email),
    );
    if (message) {
      const body = await fetch(`${mail}/api/v1/message/${message.ID}`).then(
        (r) => r.json(),
      );
      const code = (body.Text ?? body.HTML ?? "").match(/\b\d{6}\b/)?.[0];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The local inbox did not receive an OTP.");
}
async function login(label: string) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(client);
  const email = `nexo-phase6-${run}-${label}@example.test`;
  const sent = await client.auth.signInWithOtp({ email });
  if (sent.error) throw sent.error;
  const verified = await client.auth.verifyOtp({
    email,
    token: await localEmailCode(email),
    type: "email",
  });
  if (verified.error) throw verified.error;
  expect(verified.data.user?.email).toBe(email);
  users.push(verified.data.user!.id);
  return client;
}
beforeAll(async () => {
  a = await login("a");
  b = await login("b");
  aa = createOnlineApi(a);
  bb = createOnlineApi(b);
});
afterAll(async () => {
  for (const client of clients) {
    await client.removeAllChannels();
    await client.auth.signOut({ scope: "local" });
  }
  for (const user of users) await admin.auth.admin.deleteUser(user);
});
it("delivers actual email codes, restores/refreshes sessions and protects profiles through PostgREST", async () => {
  expect(users[0]).not.toBe(users[1]);
  const previous = (await a.auth.getSession()).data.session!;
  const fresh = await a.auth.refreshSession();
  expect(fresh.error).toBeNull();
  expect(fresh.data.session?.refresh_token !== previous.refresh_token).toBe(
    true,
  );
  const restored = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  clients.push(restored);
  expect(
    (
      await restored.auth.setSession({
        access_token: fresh.data.session!.access_token,
        refresh_token: fresh.data.session!.refresh_token,
      })
    ).error,
  ).toBeNull();
  expect((await restored.auth.getUser()).data.user?.id).toBe(users[0]);
  await aa.saveProfile({
    display_name: "Phase Six A",
    handle: `a_${run}`,
    locale: "en",
    region: "NG",
    leaderboard_visible: false,
  });
  await bb.saveProfile({
    display_name: "Phase Six B",
    handle: `b_${run}`,
    locale: "en",
    region: "NG",
    leaderboard_visible: false,
  });
  expect((await aa.profile()).display_name).toBe("Phase Six A");
  expect(
    (await a.from("profiles").select("id").eq("id", users[1])).data,
  ).toEqual([]);
  const write = await a
    .from("profiles")
    .update({ cosmetic: "violet" })
    .eq("id", users[0]);
  expect(write.error).not.toBeNull();
});
it("runs two-account Classic through the deployed Edge handler and delivers a real Realtime notification", async () => {
  const created = await aa.createRoom(randomUUID());
  let received = false;
  const channel = a.channel(`nexo-test-${run}`).on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "online_matches",
      filter: `id=eq.${created.match.matchId}`,
    },
    () => {
      received = true;
    },
  );
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Realtime subscription timed out")),
      15000,
    );
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      } else if (status === "CHANNEL_ERROR") {
        clearTimeout(timer);
        reject(new Error("Realtime subscription failed"));
      }
    });
  });
  try {
    let match = await bb.join(created.invite, randomUUID());
    await expect.poll(() => received, { timeout: 10000 }).toBe(true);
    const requestId = randomUUID(),
      accepted = await aa.move(match, 0, requestId);
    expect(await aa.move(match, 0, requestId)).toEqual(accepted);
    match = accepted;
    for (const square of [3, 1, 4, 2])
      match = await (match.game.turn === "X" ? aa : bb).move(
        match,
        square,
        randomUUID(),
      );
    expect(match.result).toBe("X");
    expect((await bb.history()).some((m) => m.matchId === match.matchId)).toBe(
      true,
    );
    expect((await bb.replay(match.matchId, false)).moves).toEqual([
      0, 3, 1, 4, 2,
    ]);
    expect(
      (await aa.extras()).achievements.some(
        (v) => v.code === "first_verified_win",
      ),
    ).toBe(true);
    await aa.cosmetic("violet");
    expect((await aa.extras()).cosmetic).toBe("violet");
    const denied = await a
      .from("online_matches")
      .update({ result: "O" })
      .eq("id", match.matchId);
    expect(denied.error).not.toBeNull();
  } finally {
    await a.removeChannel(channel);
  }
});
it("pairs and settles actual ranked requests without exposing unconsented leaderboard profiles", async () => {
  expect((await aa.queue("enter", randomUUID())).status).toBe("waiting");
  const paired = await bb.queue("enter", randomUUID());
  expect(paired.status).toBe("matched");
  const ended = await bb.end(paired.match!, randomUUID());
  expect(ended.ratingStatus).toBe("settled");
  expect((await aa.queue("status")).rating.games).toBe(1);
  expect((await bb.queue("status")).rating.games).toBe(1);
  expect((await aa.leaderboard()).some((e) => e.handle === `a_${run}`)).toBe(
    false,
  );
});
it("validates Ultimate routing and accepted logs across the actual services", async () => {
  const made = await aa.variantCreate("ultimate-v1", randomUUID());
  let match = await bb.variantJoin(made.invite, randomUUID());
  match = await aa.variantAct(match, "move", randomUUID(), {
    board: 4,
    cell: 2,
  });
  expect("forcedBoard" in match.game && match.game.forcedBoard).toBe(2);
  await expect(
    bb.variantAct(match, "move", randomUUID(), { board: 3, cell: 0 }),
  ).rejects.toMatchObject({ code: "invalid_move" });
  const ended = await bb.variantAct(match, "end", randomUUID());
  expect(ended.result).toBe("X");
  expect((await aa.replay(match.matchId, true)).moves).toEqual([
    { board: 4, cell: 2 },
  ]);
  expect(
    (await aa.extras()).achievements.some(
      (v) => v.code === "first_ultimate_win",
    ),
  ).toBe(true);
});
it("uses SQL server time for Blitz and returns validated timeout snapshots over HTTP", async () => {
  const made = await aa.variantCreate("blitz-v1", randomUUID());
  let match: SignatureMatch = await bb.variantJoin(made.invite, randomUUID());
  await new Promise((resolve) => setTimeout(resolve, 1100));
  match = await aa.variantAct(match, "move", randomUUID(), 0);
  expect(match.clock!.X).toBeLessThan(59000);
  expect(match.clock!.O).toBe(60000);
  const db = new Client({ connectionString: process.env.NEXO_INTEGRATION_DB });
  await db.connect();
  try {
    await db.query(
      "update public.signature_matches set turn_started_at=clock_timestamp()-interval '61 seconds' where id=$1",
      [match.matchId],
    );
  } finally {
    await db.end();
  }
  const expired = decodeSignature(await bb.variantFetch(match.matchId));
  expect(expired.phase).toBe("timeout");
  expect(expired.result).toBe("X");
  expect(expired.clock!.O).toBe(0);
});
it("verifies the current daily proof and palette ownership through the actual function", async () => {
  const day = new Date().toISOString().slice(0, 10),
    p = dailyPuzzle(day);
  let game = puzzleStart(p);
  while (game.status === "playing")
    game = playPuzzle(p, game, analyzeClassic(game).bestMoves[0]);
  await aa.solve(day, p.id, game.moves);
  await aa.solve(day, p.id, game.moves);
  await aa.cosmetic("cyan");
  const extras = await aa.extras();
  expect(extras.cosmetic).toBe("cyan");
  expect(
    extras.achievements.filter((v) => v.code === "puzzle_solver"),
  ).toHaveLength(1);
  await expect(bb.cosmetic("cyan")).rejects.toMatchObject({
    code: "cosmetic_locked",
  });
});
it.runIf(process.env.NEXO_LOAD_PROBE === "1")(
  "records an opt-in local HTTP latency probe",
  async () => {
    const duration: number[] = [],
      count = 40,
      concurrency = 5,
      start = performance.now();
    let next = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        for (;;) {
          const index = next++;
          if (index >= count) return;
          const begin = performance.now();
          await (index % 2 === 0 ? aa : bb).queue("status");
          duration.push(performance.now() - begin);
        }
      }),
    );
    duration.sort((a, b) => a - b);
    expect(duration).toHaveLength(count);
    console.log(
      JSON.stringify({
        probe: "local-authenticated-http",
        requests: count,
        concurrency,
        p50_ms: Math.round(duration[Math.ceil(count * 0.5) - 1]),
        p95_ms: Math.round(duration[Math.ceil(count * 0.95) - 1]),
        elapsed_ms: Math.round(performance.now() - start),
      }),
    );
  },
);
it("deletes a real Auth account and removes its private profile/telemetry", async () => {
  await bb.deleteAccount();
  expect((await b.auth.getSession()).data.session).toBeNull();
  const user = await admin.auth.admin.getUserById(users[1]);
  expect(user.error).not.toBeNull();
  expect(
    (await admin.from("profiles").select("id").eq("id", users[1])).data,
  ).toEqual([]);
  expect(
    (
      await admin
        .from("player_achievements")
        .select("code")
        .eq("player_id", users[1])
    ).data,
  ).toEqual([]);
});
