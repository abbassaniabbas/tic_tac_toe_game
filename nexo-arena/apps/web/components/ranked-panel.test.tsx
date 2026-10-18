import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { AccountProvider } from "@nexo/online/react";
import { createGame } from "@nexo/engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OnlinePanel } from "./online-panel";
const x = "11111111-1111-4111-8111-111111111111",
  o = "22222222-2222-4222-8222-222222222222";
let root: Root, element: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
});
async function click(text: string) {
  const button = Array.from(element.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  expect(button, `Missing ${text}`).toBeTruthy();
  await act(async () => button!.click());
}
async function until(text: string) {
  await act(async () => {
    await vi.waitFor(() => expect(element.textContent).toContain(text));
  });
}
function fixture() {
  const profile = {
    id: x,
    handle: "ada_test",
    display_name: "Ada",
    locale: "en",
    region: "NG",
    leaderboard_visible: false,
  };
  const rating = {
    season: "classic-open-v1",
    value: 1500,
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    provisional: true,
  };
  let match = {
    matchId: o,
    revision: 1,
    rulesVersion: "classic-v1",
    game: createGame(),
    players: { X: x, O: o },
    playerNames: { X: "Ada", O: "Bayo" },
    phase: "active",
    result: null as string | null,
    createdAt: "2026-10-10T10:00:00Z",
    updatedAt: "2026-10-10T10:00:00Z",
    expiresAt: "2026-10-10T10:10:00Z",
    competition: "ranked",
    season: "classic-open-v1",
    ratingStatus: "pending",
    ratingChanges: null as unknown,
  };
  const idle = {
    ticket: null as string | null,
    status: "idle",
    joinedAt: null as string | null,
    expiresAt: null as string | null,
    match: null as unknown,
    rating,
  };
  let queue = { ...idle };
  const update = vi.fn((patch: Record<string, unknown>) => {
    Object.assign(profile, patch);
    return { eq: async () => ({ error: null }) };
  });
  const invoke = vi.fn(
    async (_name: string, { body }: { body: Record<string, unknown> }) => {
      if (body.action === "queue") {
        if (body.operation === "enter")
          queue = {
            ...idle,
            status: "waiting",
            ticket: body.ticket as string,
            joinedAt: match.createdAt,
            expiresAt: match.expiresAt,
          };
        if (body.operation === "cancel")
          queue = { ...idle, status: "cancelled", ticket: queue.ticket };
        return { data: { queue }, error: null };
      }
      if (["history", "rooms", "leaderboard"].includes(String(body.action)))
        return { data: { data: [] }, error: null };
      if (body.action === "end")
        match = {
          ...match,
          revision: 2,
          phase: "forfeited",
          result: "O",
          ratingStatus: "settled",
          ratingChanges: {
            X: { before: 1500, after: 1484, delta: -16 },
            O: { before: 1500, after: 1516, delta: 16 },
          },
        };
      return { data: { match }, error: null };
    },
  );
  const channel = { on: () => channel, subscribe: () => channel };
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: x } } },
        error: null,
      }),
      getUser: async () => ({ data: { user: { id: x } }, error: null }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    functions: { invoke },
    from: () => ({
      select: () => ({
        single: async () => ({ data: { ...profile }, error: null }),
      }),
      update,
    }),
    channel: () => channel,
    removeChannel: async () => ({}),
  } as unknown as SupabaseClient;
  return {
    client,
    invoke,
    update,
    pair: () => {
      queue = { ...queue, status: "matched", match };
    },
  };
}
it("renders real queue values, cancellation and an empty global leaderboard", async () => {
  const f = fixture();
  await act(async () =>
    root.render(
      <AccountProvider client={f.client}>
        <OnlinePanel />
      </AccountProvider>,
    ),
  );
  await until("0/10 placements");
  await until("No eligible players yet.");
  await click("Find ranked match");
  await until("Searching for an opponent…");
  await click("Cancel search");
  await until("Find ranked match");
  expect(
    f.invoke.mock.calls.some(([, o]) => o.body.operation === "cancel"),
  ).toBe(true);
});
it("opens an accepted ranked match and displays server-settled resignation Elo", async () => {
  const f = fixture();
  await act(async () =>
    root.render(
      <AccountProvider client={f.client}>
        <OnlinePanel />
      </AccountProvider>,
    ),
  );
  await until("0/10 placements");
  await click("Find ranked match");
  f.pair();
  await click("Refresh ranked play");
  await click("Open ranked match →");
  await until("Ranked Classic · untimed");
  await click("Resign match");
  await click("Confirm resignation");
  await until("Elo 1500 → 1484 (-16)");
  expect(element.querySelectorAll('[data-testid="board"]')).toHaveLength(1);
});
it("makes public leaderboard visibility an explicit profile opt-in", async () => {
  const f = fixture();
  await act(async () =>
    root.render(
      <AccountProvider client={f.client}>
        <OnlinePanel />
      </AccountProvider>,
    ),
  );
  await until("Welcome, Ada.");
  await click("Edit profile");
  const checkbox = element.querySelector(
    'input[type="checkbox"]',
  ) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  await act(async () => checkbox.click());
  await click("Save profile");
  expect(f.update.mock.calls[0][0]).toMatchObject({
    leaderboard_visible: true,
  });
  await until("Profile saved.");
});
