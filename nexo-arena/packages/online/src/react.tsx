import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createOnlineApi, ArenaApiError } from "./client";
import { newerSnapshot, type OnlineMatch, type Profile } from "./model";
type Api = ReturnType<typeof createOnlineApi>;
interface Account {
  client: SupabaseClient | null;
  api: Api | null;
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  error: string | null;
  reloadProfile(): Promise<void>;
  signOut(): Promise<void>;
}
const AccountContext = createContext<Account | null>(null);
export function AccountProvider({
  client,
  children,
}: {
  client: SupabaseClient | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!client);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = useMemo(
    () => (client ? createOnlineApi(client) : null),
    [client],
  );
  const userId = user?.id;
  const profileEpoch = useRef(0);
  useEffect(() => {
    if (!client) {
      setUser(null);
      setProfile(null);
      setReady(true);
      return;
    }
    setReady(false);
    let alive = true;
    let revision = 0;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      revision++;
      if (alive) {
        setUser(session?.user ?? null);
        setProfile((current) =>
          current?.id === session?.user.id ? current : null,
        );
        setReady(true);
      }
    });
    const seen = revision;
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (alive && revision === seen) {
          if (error) setError("Could not restore your account. Sign in again.");
          setUser(data.session?.user ?? null);
          setReady(true);
        }
      })
      .catch(() => {
        if (alive && revision === seen) {
          setError("Could not restore your account.");
          setReady(true);
        }
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [client]);
  useEffect(() => {
    const version = ++profileEpoch.current;
    setProfile(null);
    if (!api || !userId) return;
    let alive = true;
    api
      .profile()
      .then((value) => {
        if (alive) {
          setProfile(value);
          setError(null);
        }
      })
      .catch(() => {
        if (alive) setError("Your profile could not be loaded. Try again.");
      });
    return () => {
      alive = false;
      profileEpoch.current = version + 1;
    };
  }, [api, userId]);
  const reloadProfile = useCallback(async () => {
    if (api && userId) {
      const version = profileEpoch.current;
      const next = await api.profile();
      if (version === profileEpoch.current) {
        setProfile(next);
        setError(null);
      }
    }
  }, [api, userId]);
  const signOut = useCallback(async () => {
    if (client) {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw new Error("Sign out failed. Please try again.");
      setUser(null);
      setProfile(null);
      setError(null);
    }
  }, [client]);
  return (
    <AccountContext.Provider
      value={{
        client,
        api,
        ready,
        user,
        profile,
        error,
        reloadProfile,
        signOut,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("AccountProvider missing");
  return value;
}
export function useOnlineMatch(matchId: string | null, enabled = true) {
  const { api, user } = useAccount();
  const [match, setMatch] = useState<OnlineMatch | null>(null);
  const [connection, setConnection] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [synchronized, setSynchronized] = useState(false);
  const synchronizedRef = useRef(false);
  const pendingRef = useRef(false);
  const epoch = useRef(0);
  const userId = user?.id;
  const refresh = useCallback(async () => {
    if (!api || !matchId || !userId) return;
    const version = epoch.current;
    try {
      const next = await api.fetchMatch(matchId);
      if (version !== epoch.current) return;
      setMatch((old) => newerSnapshot(old, next));
      synchronizedRef.current = true;
      setSynchronized(true);
      setError(null);
    } catch (e) {
      if (version === epoch.current) {
        setConnection("reconnecting");
        setError(
          e instanceof Error ? e.message : "Could not refresh the match.",
        );
      }
    }
  }, [api, matchId, userId]);
  useEffect(() => {
    setMatch(null);
  }, [matchId, userId]);
  useEffect(() => {
    epoch.current++;
    synchronizedRef.current = false;
    setSynchronized(false);
    pendingRef.current = false;
    setPending(false);
    setError(null);
    setConnection("connecting");
    if (!api || !matchId || !userId || !enabled) return;
    void refresh();
    const version = epoch.current;
    const pull = () => {
      if (version === epoch.current) void refresh();
    };
    const stop = api.subscribe(matchId, pull, (status) => {
      if (version !== epoch.current) return;
      if (status === "SUBSCRIBED") {
        setConnection("live");
        pull();
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status))
        setConnection("reconnecting");
    });
    // Polling closes gaps after missed events/reconnection; subscriptions are an accelerator.
    const interval = setInterval(pull, 5000);
    return () => {
      epoch.current = version + 1;
      stop();
      clearInterval(interval);
    };
  }, [api, matchId, userId, enabled, refresh]);
  const act = useCallback(
    async (kind: "move" | "end", requestId: string, square?: number) => {
      if (
        !api ||
        !match ||
        !enabled ||
        !synchronizedRef.current ||
        pendingRef.current
      )
        return;
      pendingRef.current = true;
      setPending(true);
      const version = epoch.current;
      try {
        const next =
          kind === "move"
            ? await api.move(match, square!, requestId)
            : await api.end(match, requestId);
        if (version === epoch.current) {
          setMatch((old) => newerSnapshot(old, next));
          setError(null);
        }
      } catch (e) {
        if (version === epoch.current) {
          setError(e instanceof Error ? e.message : "The request failed.");
          if (e instanceof ArenaApiError && e.code === "stale_revision")
            await refresh();
        }
      } finally {
        if (version === epoch.current) {
          pendingRef.current = false;
          setPending(false);
        }
      }
    },
    [api, match, enabled, refresh],
  );
  return { match, connection, error, pending, synchronized, refresh, act };
}

/** Foreground queue heartbeat. No optimistic pairing; the server owns each ticket. */
export function useMatchmaking(enabled = true) {
  const { api, user } = useAccount();
  const userId = user?.id;
  const [queue, setQueue] = useState<import("./model").QueueState | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<import("./model").QueueState | null>(null);
  const retryTicket = useRef<string | null>(null);
  const busy = useRef(false);
  const epoch = useRef(0);
  const command = useCallback(
    async (
      operation: "enter" | "poll" | "cancel" | "status",
      ticket?: string,
    ) => {
      if (!api || !userId || !enabled || busy.current) return;
      const version = epoch.current;
      busy.current = true;
      setPending(true);
      try {
        const next = await api.queue(operation, ticket);
        if (version !== epoch.current) {
          if (operation === "enter" && ticket)
            void api.queue("cancel", ticket).catch(() => undefined);
          return;
        }
        current.current = next;
        setQueue(next);
        setError(null);
        if (operation === "enter" || operation === "cancel")
          retryTicket.current = null;
      } catch (e) {
        if (version === epoch.current) {
          setError(
            e instanceof Error ? e.message : "Could not refresh matchmaking.",
          );
          if (
            e instanceof ArenaApiError &&
            ["queue_superseded", "queue_active"].includes(e.code)
          )
            retryTicket.current = null;
        }
      } finally {
        if (version === epoch.current) {
          busy.current = false;
          setPending(false);
        }
      }
    },
    [api, userId, enabled],
  );
  useEffect(() => {
    const version = ++epoch.current;
    busy.current = false;
    current.current = null;
    retryTicket.current = null;
    setQueue(null);
    setPending(false);
    setError(null);
    if (!api || !userId || !enabled) return;
    void command("status");
    const interval = setInterval(() => {
      const q = current.current;
      if (q?.status === "waiting" && q.ticket) void command("poll", q.ticket);
    }, 3000);
    return () => {
      epoch.current = version + 1;
      clearInterval(interval);
      const ticket =
        current.current?.status === "waiting"
          ? current.current.ticket
          : retryTicket.current;
      if (ticket) void api.queue("cancel", ticket).catch(() => undefined);
    };
  }, [api, userId, enabled, command]);
  const enter = useCallback(
    (ticket: string) => {
      if (
        !current.current ||
        busy.current ||
        !enabled ||
        ["waiting", "matched"].includes(current.current.status)
      )
        return;
      retryTicket.current ??= ticket;
      return command("enter", retryTicket.current);
    },
    [command, enabled],
  );
  const cancel = useCallback(() => {
    const ticket =
      current.current?.status === "waiting"
        ? current.current.ticket
        : retryTicket.current;
    if (ticket) return command("cancel", ticket);
  }, [command]);
  return {
    queue,
    pending,
    error,
    enter,
    cancel,
    refresh: () => command("status"),
  };
}

export function useLeaderboard(region: string | null, enabled = true) {
  const { api, user } = useAccount();
  const userId = user?.id;
  const [entries, setEntries] = useState<
    import("./model").LeaderboardEntry[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    setEntries(null);
    setError(null);
    if (!api || !userId || !enabled) return;
    let alive = true;
    api
      .leaderboard(region)
      .then((value) => {
        if (alive) setEntries(value);
      })
      .catch((e) => {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Could not load the leaderboard.",
          );
      });
    return () => {
      alive = false;
    };
  }, [api, userId, region, enabled, revision]);
  return { entries, error, refresh: () => setRevision((v) => v + 1) };
}
export {
  useStudio,
  useSignatureMatch,
  appendLocalReplay,
  type StudioStorage,
} from "./studio";
