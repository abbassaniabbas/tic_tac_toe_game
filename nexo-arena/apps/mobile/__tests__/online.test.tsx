import React from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  AccountProvider,
  useOnlineMatch,
  useMatchmaking,
  useSignatureMatch,
} from "@nexo/online/react";
import { createGame, playMove } from "@nexo/engine";
import type { OnlineMatch, SignatureMatch } from "@nexo/online";
import { OnlineLobby } from "../components/online-lobby";
import { RankedPanel } from "../components/ranked-panel";
jest.mock("../lib/arena-provider", () => ({
  useArena: () => ({
    colors: require("@nexo/shared").colors.dark,
    reducedMotion: true,
    active: true,
  }),
}));
jest.mock("../lib/online", () => ({
  invitationLink: (token: string) => token,
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (callback: () => void) =>
    require("react").useEffect(callback, [callback]),
}));
const userId = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const match: OnlineMatch = {
  matchId: other,
  revision: 1,
  rulesVersion: "classic-v1",
  game: createGame(),
  players: { X: userId, O: other },
  playerNames: { X: "Ada", O: "Bayo" },
  phase: "active",
  result: null,
  createdAt: "2026-10-10T10:00:00Z",
  updatedAt: "2026-10-10T10:00:00Z",
  expiresAt: "2026-10-10T10:10:00Z",
};
function fixture(signedIn = true) {
  const user = { id: userId, email: "ada@example.invalid" } as User;
  const session = signedIn ? { user } : null;
  const signInWithOtp = jest.fn().mockResolvedValue({ error: null });
  const verifyOtp = jest.fn().mockResolvedValue({ error: null });
  const callbacks: { change: () => void; status: (value: string) => void }[] =
    [];
  const invoke = jest
    .fn()
    .mockImplementation(
      async (_name: string, { body }: { body: { action: string } }) => ({
        data:
          body.action === "history" || body.action === "rooms"
            ? { data: [] }
            : { match },
        error: null,
      }),
    );
  const removeChannel = jest.fn().mockResolvedValue({});
  const client = {
    auth: {
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signInWithOtp,
      verifyOtp,
    },
    from: () => ({
      select: () => ({
        single: async () => ({
          data: {
            id: userId,
            handle: "ada",
            display_name: "Ada",
            locale: "en",
            region: "NG",
          },
          error: null,
        }),
      }),
    }),
    functions: { invoke },
    channel: () => {
      let change = () => {};
      const channel = {
        on: (_event: string, _filter: unknown, callback: () => void) => {
          change = callback;
          return channel;
        },
        subscribe: (status: (value: string) => void) => {
          callbacks.push({ change, status });
          status("SUBSCRIBED");
          return channel;
        },
      };
      return channel;
    },
    removeChannel,
  } as unknown as SupabaseClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AccountProvider client={client}>{children}</AccountProvider>
  );
  return {
    client,
    wrapper,
    invoke,
    removeChannel,
    callbacks,
    signInWithOtp,
    verifyOtp,
  };
}
it("keeps offline play available when no backend is configured", () => {
  const screen = render(
    <AccountProvider client={null}>
      <OnlineLobby />
    </AccountProvider>,
  );
  expect(screen.getByText(/Online play is unavailable/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Play offline →" })).toBeTruthy();
});
it.each(["123456", "12345678"])(
  "requests and verifies a %s email code through the account service",
  async (code) => {
    const f = fixture(false);
    const screen = render(<OnlineLobby />, { wrapper: f.wrapper });
    await waitFor(() => expect(screen.getByLabelText("Email")).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText("Email"), "ada@example.invalid");
    fireEvent.press(screen.getByRole("button", { name: "Send sign-in code" }));
    await waitFor(() =>
      expect(f.signInWithOtp).toHaveBeenCalledWith({
        email: "ada@example.invalid",
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Sign-in code")).toBeTruthy(),
    );
    fireEvent.changeText(screen.getByLabelText("Sign-in code"), code);
    fireEvent.press(screen.getByRole("button", { name: "Verify code" }));
    await waitFor(() =>
      expect(f.verifyOtp).toHaveBeenCalledWith({
        email: "ada@example.invalid",
        token: code,
        type: "email",
      }),
    );
  },
);
it("stops subscriptions on background/navigation and ignores late callbacks", async () => {
  const f = fixture();
  const hook = renderHook<
    ReturnType<typeof useOnlineMatch>,
    { enabled: boolean }
  >(({ enabled }) => useOnlineMatch(match.matchId, enabled), {
    initialProps: { enabled: true },
    wrapper: f.wrapper,
  });
  await waitFor(() => expect(hook.result.current.match?.revision).toBe(1));
  const old = f.callbacks[0];
  hook.rerender({ enabled: false });
  expect(f.removeChannel).toHaveBeenCalledTimes(1);
  const count = f.invoke.mock.calls.length;
  act(() => {
    old.change();
    old.status("SUBSCRIBED");
  });
  expect(f.invoke.mock.calls.length).toBe(count);
  let finish: (response: unknown) => void = () => {};
  f.invoke.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  hook.rerender({ enabled: true });
  expect(hook.result.current.synchronized).toBe(false);
  const before = f.invoke.mock.calls.length;
  await act(async () => {
    await hook.result.current.act(
      "move",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      0,
    );
  });
  expect(f.invoke.mock.calls.length).toBe(before);
  await act(async () => finish({ data: { match }, error: null }));
  await waitFor(() => expect(hook.result.current.synchronized).toBe(true));
  await waitFor(() => expect(f.callbacks).toHaveLength(2));
  hook.unmount();
  expect(f.removeChannel).toHaveBeenCalledTimes(2);
});
it("blocks rapid online taps until the server accepts the move", async () => {
  const f = fixture();
  const hook = renderHook(() => useOnlineMatch(match.matchId), {
    wrapper: f.wrapper,
  });
  await waitFor(() => expect(hook.result.current.match).not.toBeNull());
  let finish: (response: unknown) => void = () => {};
  f.invoke.mockImplementation(
    (_name: string, { body }: { body: { action: string } }) =>
      body.action === "move"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve({ data: { match }, error: null }),
  );
  act(() => {
    void hook.result.current.act(
      "move",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      0,
    );
    void hook.result.current.act(
      "move",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      1,
    );
  });
  expect(
    f.invoke.mock.calls.filter(([, options]) => options.body.action === "move"),
  ).toHaveLength(1);
  expect(hook.result.current.match?.game.moves).toEqual([]);
  await act(async () =>
    finish({
      data: { match: { ...match, revision: 2, game: playMove(match.game, 0) } },
      error: null,
    }),
  );
  await waitFor(() => expect(hook.result.current.pending).toBe(false));
  expect(hook.result.current.match?.game.moves).toEqual([0]);
  hook.unmount();
});

it("pauses Blitz subscriptions in the background and requires a fresh server clock on resume", async () => {
  const f = fixture();
  const blitz: SignatureMatch = {
    ...match,
    rulesVersion: "blitz-v1",
    serverNow: match.createdAt,
    clock: { X: 60000, O: 60000, startedAt: match.createdAt },
  };
  f.invoke.mockResolvedValue({ data: { match: blitz }, error: null });
  const hook = renderHook(
    ({ enabled }: { enabled: boolean }) =>
      useSignatureMatch(blitz.matchId, enabled),
    {
      initialProps: { enabled: true },
      wrapper: f.wrapper,
    },
  );
  await waitFor(() => expect(hook.result.current.synced).toBe(true));
  expect(hook.result.current.clocks).toEqual({ X: 60000, O: 60000 });
  const old = f.callbacks[0];
  hook.rerender({ enabled: false });
  expect(f.removeChannel).toHaveBeenCalledTimes(1);
  const count = f.invoke.mock.calls.length;
  act(() => {
    old.change();
    old.status("SUBSCRIBED");
  });
  expect(f.invoke.mock.calls.length).toBe(count);
  let finish: (response: unknown) => void = () => {};
  f.invoke.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  hook.rerender({ enabled: true });
  expect(hook.result.current.synced).toBe(false);
  const before = f.invoke.mock.calls.length;
  await act(async () =>
    hook.result.current.act("move", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", 0),
  );
  expect(f.invoke.mock.calls.length).toBe(before);
  await act(async () =>
    finish({
      data: { match: { ...blitz, serverNow: "2026-10-10T10:00:10Z" } },
      error: null,
    }),
  );
  await waitFor(() => expect(hook.result.current.synced).toBe(true));
  expect(hook.result.current.clocks).toEqual({ X: 50000, O: 60000 });
  expect(hook.result.current.match?.game.moves).toEqual([]);
  hook.unmount();
  expect(f.removeChannel).toHaveBeenCalledTimes(2);
});

const rankedRating = {
  season: "classic-open-v1",
  value: 1500,
  games: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  provisional: true,
};
const rankedIdle = {
  ticket: null,
  status: "idle",
  joinedAt: null,
  expiresAt: null,
  match: null,
  rating: rankedRating,
};
const rankedWaiting = {
  ...rankedIdle,
  ticket: other,
  status: "waiting",
  joinedAt: match.createdAt,
  expiresAt: match.expiresAt,
};
function rankedFixture() {
  const f = fixture();
  f.invoke.mockImplementation(
    async (
      _name: string,
      {
        body,
      }: { body: { action: string; operation?: string; ticket?: string } },
    ) => ({
      data:
        body.action === "leaderboard"
          ? { data: [] }
          : {
              queue:
                body.operation === "enter"
                  ? { ...rankedWaiting, ticket: body.ticket }
                  : body.operation === "cancel"
                    ? {
                        ...rankedIdle,
                        status: "cancelled",
                        ticket: body.ticket,
                      }
                    : rankedIdle,
            },
      error: null,
    }),
  );
  return f;
}
it("shows the native ranked rating, search, cancellation and honest empty leaderboard", async () => {
  const f = rankedFixture();
  const screen = render(<RankedPanel />, { wrapper: f.wrapper });
  await waitFor(() => expect(screen.getByText("1500 Elo")).toBeTruthy());
  expect(screen.getByText("No eligible players yet.")).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Find ranked match" }));
  await waitFor(() =>
    expect(screen.getByText("Searching for an opponent…")).toBeTruthy(),
  );
  fireEvent.press(screen.getByRole("button", { name: "Cancel search" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Find ranked match" }),
    ).toBeTruthy(),
  );
});
it("cancels an unmatched ticket on background and ignores its late response", async () => {
  const f = rankedFixture();
  const hook = renderHook(
    ({ enabled }: { enabled: boolean }) => useMatchmaking(enabled),
    { initialProps: { enabled: true }, wrapper: f.wrapper },
  );
  await waitFor(() => expect(hook.result.current.queue?.status).toBe("idle"));
  await act(async () => {
    await hook.result.current.enter(other);
  });
  hook.rerender({ enabled: false });
  await waitFor(() =>
    expect(
      f.invoke.mock.calls.some(
        ([, o]) => o.body.operation === "cancel" && o.body.ticket === other,
      ),
    ).toBe(true),
  );
  expect(hook.result.current.queue).toBeNull();
  hook.unmount();
});
it("blocks duplicate search taps and cancels an enter response received after unmount", async () => {
  const f = rankedFixture();
  const hook = renderHook(() => useMatchmaking(), { wrapper: f.wrapper });
  await waitFor(() => expect(hook.result.current.queue).not.toBeNull());
  let finish: (value: unknown) => void = () => {};
  f.invoke.mockImplementation(
    (_n: string, { body }: { body: { operation: string } }) =>
      body.operation === "enter"
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve({ data: { queue: rankedIdle }, error: null }),
  );
  act(() => {
    void hook.result.current.enter(other);
    void hook.result.current.enter(userId);
  });
  expect(
    f.invoke.mock.calls.filter(([, o]) => o.body.operation === "enter"),
  ).toHaveLength(1);
  hook.unmount();
  await act(async () =>
    finish({ data: { queue: rankedWaiting }, error: null }),
  );
  expect(
    f.invoke.mock.calls.filter(
      ([, o]) => o.body.operation === "cancel" && o.body.ticket === other,
    ).length,
  ).toBeGreaterThanOrEqual(1);
});
it("retries an ambiguous search with the same ticket instead of duplicating it", async () => {
  const f = rankedFixture();
  const hook = renderHook(() => useMatchmaking(), { wrapper: f.wrapper });
  await waitFor(() => expect(hook.result.current.queue).not.toBeNull());
  f.invoke.mockResolvedValueOnce({
    data: null,
    error: { context: { json: async () => ({ error: "network" }) } },
  });
  await act(async () => {
    await hook.result.current.enter(other);
  });
  expect(hook.result.current.error).not.toBeNull();
  await act(async () => {
    await hook.result.current.enter(userId);
  });
  const enters = f.invoke.mock.calls.filter(
    ([, o]) => o.body.operation === "enter",
  );
  expect(enters.map(([, o]) => o.body.ticket)).toEqual([other, other]);
  hook.unmount();
});
it("restores an accepted ranked match instead of creating another search", async () => {
  const f = rankedFixture();
  f.invoke.mockResolvedValue({
    data: {
      queue: {
        ...rankedWaiting,
        status: "matched",
        match: {
          ...match,
          competition: "ranked",
          season: "classic-open-v1",
          ratingStatus: "pending",
          ratingChanges: null,
        },
      },
    },
    error: null,
  });
  const hook = renderHook(() => useMatchmaking(), { wrapper: f.wrapper });
  await waitFor(() =>
    expect(hook.result.current.queue?.status).toBe("matched"),
  );
  await act(async () => {
    await hook.result.current.enter(userId);
  });
  expect(
    f.invoke.mock.calls.filter(([, o]) => o.body.operation === "enter"),
  ).toHaveLength(0);
  hook.unmount();
  expect(
    f.invoke.mock.calls.filter(([, o]) => o.body.operation === "cancel"),
  ).toHaveLength(0);
});
