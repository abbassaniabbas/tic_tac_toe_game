import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createUltimate,
  playUltimate,
  createGame,
  playMove,
  dailyPuzzle,
  puzzleStart,
  playPuzzle,
  replayPosition,
  validateReplay,
  type UltimateMove,
  type SignatureRule,
  type ReplayRecord,
  type GameState,
  type UltimateState,
} from "@nexo/engine";
import { useAccount } from "./react";
import {
  displayedClocks,
  type SignatureMatch,
  type Extras,
  type Cosmetic,
} from "./signature";
export interface StudioStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
export const STUDIO_KEY = "nexo.studio.v1";
interface LocalStudio {
  version: 1;
  ultimateMoves: UltimateMove[];
  records: ReplayRecord[];
  puzzleDay: string;
  puzzleMoves: number[];
  palette: "blue" | "slate";
}
const today = () => new Date().toISOString().slice(0, 10);
function fresh(): LocalStudio {
  const day = today();
  return {
    version: 1,
    ultimateMoves: [],
    records: [],
    puzzleDay: day,
    puzzleMoves: [...dailyPuzzle(day).seed],
    palette: "blue",
  };
}
export function decodeStudio(raw: string | null): LocalStudio {
  const fallback = fresh();
  if (!raw) return fallback;
  const v = JSON.parse(raw) as LocalStudio;
  if (
    v.version !== 1 ||
    !Array.isArray(v.ultimateMoves) ||
    v.ultimateMoves.length > 81 ||
    !Array.isArray(v.records) ||
    v.records.length > 50 ||
    !["blue", "slate"].includes(v.palette)
  )
    throw new Error("Invalid Studio save");
  v.ultimateMoves.reduce((g, m) => playUltimate(g, m), createUltimate());
  const records = v.records.map((r) => ({
    ...validateReplay(r),
    source: "local" as const,
  }));
  if (v.puzzleDay === fallback.puzzleDay) {
    const puzzle = dailyPuzzle(v.puzzleDay);
    if (
      !Array.isArray(v.puzzleMoves) ||
      JSON.stringify(v.puzzleMoves.slice(0, puzzle.seed.length)) !==
        JSON.stringify(puzzle.seed)
    )
      throw new Error("Invalid puzzle save");
    let game = puzzleStart(puzzle),
      i = puzzle.seed.length;
    while (i < v.puzzleMoves.length) {
      game = playPuzzle(puzzle, game, v.puzzleMoves[i]);
      if (
        JSON.stringify(game.moves) !==
        JSON.stringify(v.puzzleMoves.slice(0, game.moves.length))
      )
        throw new Error("Invalid puzzle save");
      i = game.moves.length;
    }
  } else {
    v.puzzleDay = fallback.puzzleDay;
    v.puzzleMoves = fallback.puzzleMoves;
  }
  return { ...v, records };
}
export async function appendLocalReplay(
  storage: StudioStorage,
  record: ReplayRecord,
) {
  const state = decodeStudio(await storage.getItem(STUDIO_KEY));
  const local = { ...validateReplay(record), source: "local" as const };
  if (!state.records.some((r) => r.id === record.id))
    state.records = [local, ...state.records].slice(0, 50);
  await storage.setItem(STUDIO_KEY, JSON.stringify(state));
}
export function useStudio(
  storage: StudioStorage,
  newId: () => string,
  initialInvite = "",
) {
  const { api, user } = useAccount();
  const userId = user?.id;
  const [local, setLocal] = useState(fresh),
    current = useRef(local),
    [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null),
    [message, setMessage] = useState("");
  const [day, setDay] = useState(today),
    [extras, setExtras] = useState<Extras | null>(null),
    [online, setOnline] = useState<SignatureMatch[]>([]),
    [classic, setClassic] = useState<ReplayRecord[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null),
    [invite, setInvite] = useState(initialInvite),
    [created, setCreated] = useState(""),
    [pending, setPending] = useState(false),
    lock = useRef(false),
    epoch = useRef(0),
    createTicket = useRef<{ rule: SignatureRule; id: string } | null>(null);
  const [replay, setReplay] = useState<ReplayRecord | null>(null),
    [step, setStep] = useState(0),
    [branch, setBranch] = useState<GameState | UltimateState | null>(null);
  const writes = useRef(Promise.resolve());
  const change = useCallback((f: (v: LocalStudio) => LocalStudio) => {
    const next = f(current.current);
    current.current = next;
    setLocal(next);
  }, []);
  useEffect(() => {
    let alive = true;
    storage
      .getItem(STUDIO_KEY)
      .then((raw) => {
        if (alive) {
          const state = decodeStudio(raw);
          current.current = state;
          setLocal(state);
        }
      })
      .catch(() => {
        if (alive)
          setError(
            "Saved Studio data could not be loaded. You can still play.",
          );
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [storage]);
  useEffect(() => {
    if (ready) {
      const raw = JSON.stringify(local);
      writes.current = writes.current
        .catch(() => undefined)
        .then(() => storage.setItem(STUDIO_KEY, raw))
        .catch(() => setError("Studio changes could not be saved."));
    }
  }, [local, ready, storage]);
  useEffect(() => {
    const timer = setInterval(() => setDay(today()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (ready && current.current.puzzleDay !== day)
      change((v) => ({
        ...v,
        puzzleDay: day,
        puzzleMoves: [...dailyPuzzle(day).seed],
      }));
  }, [day, ready, change]);
  const reload = useCallback(async () => {
    if (!api || !userId) return;
    const version = epoch.current;
    const [e, v, c] = await Promise.all([
      api.extras(),
      api.variantHistory(),
      api.history(),
    ]);
    if (version === epoch.current) {
      setExtras(e);
      setOnline(v);
      setClassic(
        c.map((m) => ({
          id: m.matchId,
          rule: "classic-v1",
          first: m.game.first,
          moves: m.game.moves,
          result: m.result,
          source: "server",
        })),
      );
    }
  }, [api, userId]);
  useEffect(() => {
    const identityEpoch = ++epoch.current;
    setExtras(null);
    setOnline([]);
    setClassic([]);
    setMatchId(null);
    setCreated("");
    createTicket.current = null;
    lock.current = false;
    setPending(false);
    setReplay((r) => (r?.source === "server" ? null : r));
    if (api && userId)
      void reload().catch(() => {
        if (identityEpoch === epoch.current)
          setError("Online Studio could not be loaded. Refresh to retry.");
      });
    return () => {
      epoch.current = identityEpoch + 1;
    };
  }, [api, userId, reload]);
  const run = async (action: (alive: () => boolean) => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    setMessage("");
    const version = epoch.current;
    try {
      await action(() => version === epoch.current);
    } catch (e) {
      if (version === epoch.current)
        setError(e instanceof Error ? e.message : "The request failed.");
    } finally {
      if (version === epoch.current) {
        lock.current = false;
        setPending(false);
      }
    }
  };
  const ultimate = useMemo(
    () =>
      local.ultimateMoves.reduce(
        (g, m) => playUltimate(g, m),
        createUltimate(),
      ),
    [local.ultimateMoves],
  );
  const puzzle = dailyPuzzle(day),
    puzzleGame = useMemo(
      () =>
        local.puzzleDay === day
          ? local.puzzleMoves.reduce((g, m) => playMove(g, m), createGame())
          : puzzleStart(dailyPuzzle(day)),
      [local.puzzleMoves, local.puzzleDay, day],
    );
  function ultimateMove(move: UltimateMove) {
    if (!ready) return;
    try {
      const g = current.current.ultimateMoves.reduce(
          (s, m) => playUltimate(s, m),
          createUltimate(),
        ),
        next = playUltimate(g, move);
      change((v) => ({
        ...v,
        ultimateMoves: [...next.moves],
        records:
          next.status === "playing"
            ? v.records
            : [
                {
                  id: newId(),
                  rule: "ultimate-v1" as const,
                  first: next.first,
                  moves: next.moves,
                  result: next.winner ?? ("draw" as const),
                  source: "local" as const,
                },
                ...v.records,
              ].slice(0, 50),
      }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid move");
    }
  }
  function puzzleMove(square: number) {
    if (!ready) return;
    try {
      const p = dailyPuzzle(day),
        game =
          current.current.puzzleDay === day
            ? current.current.puzzleMoves.reduce(
                (g, m) => playMove(g, m),
                createGame(),
              )
            : puzzleStart(p),
        next = playPuzzle(p, game, square);
      change((v) => ({ ...v, puzzleDay: day, puzzleMoves: [...next.moves] }));
      setMessage("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid move");
    }
  }
  const records: ReplayRecord[] = [
    ...local.records,
    ...classic,
    ...online
      .filter((m) => m.game.moves.length > 0)
      .map((m) => ({
        id: m.matchId,
        rule: m.rulesVersion,
        first: m.game.first,
        moves: m.game.moves,
        result: m.result,
        source: "server" as const,
      })),
  ];
  const position = replay ? (branch ?? replayPosition(replay, step)) : null;
  function navigate(next: number) {
    setStep(next);
    setBranch(null);
  }
  const color: Cosmetic = extras?.cosmetic ?? local.palette;
  return {
    ready,
    error,
    message,
    ultimate,
    ultimateMove,
    resetUltimate: () => change((v) => ({ ...v, ultimateMoves: [] })),
    puzzle,
    day,
    puzzleGame,
    puzzleMove,
    resetPuzzle: () => {
      change((v) => ({ ...v, puzzleDay: day, puzzleMoves: [...puzzle.seed] }));
      setMessage("");
    },
    hint: () =>
      setMessage(
        "Try square " +
          (importHint(puzzleGame) + 1) +
          ". Hints are allowed for verified solves.",
      ),
    pending,
    online,
    extras,
    invite,
    setInvite,
    created,
    matchId,
    setMatchId,
    records,
    replay,
    step,
    position,
    navigate,
    selectReplay: (r: ReplayRecord) => {
      if (r.source === "local") {
        setReplay(validateReplay(r));
        navigate(0);
      } else
        void run(async (alive) => {
          const next = await api!.replay(r.id, r.rule !== "classic-v1");
          if (!alive()) return;
          setReplay(next);
          navigate(0);
        });
    },
    branchMove: (move: number | UltimateMove) => {
      if (!position) return;
      try {
        setBranch(
          "boards" in position
            ? playUltimate(position, move as UltimateMove)
            : playMove(position, move as number),
        );
      } catch {}
    },
    branching: !!branch,
    resetBranch: () => setBranch(null),
    refresh: () => run(reload),
    create: (rule: SignatureRule) =>
      run(async (alive) => {
        if (!api || !userId)
          throw new Error("Sign in through Online to create a room.");
        if (createTicket.current?.rule !== rule)
          createTicket.current = { rule, id: newId() };
        const response = await api.variantCreate(
          rule,
          createTicket.current!.id,
        );
        if (!alive()) return;
        setCreated(response.invite);
        setMatchId(response.match.matchId);
        createTicket.current = null;
        await reload();
      }),
    join: () =>
      run(async (alive) => {
        if (!api || !userId) throw new Error("Sign in through Online to join.");
        let token = invite.trim();
        try {
          token = new URL(token).searchParams.get("studioInvite") ?? token;
        } catch {}
        const m = await api.variantJoin(token, newId());
        if (!alive()) return;
        setMatchId(m.matchId);
        await reload();
      }),
    verify: () =>
      run(async (alive) => {
        if (!api || !userId)
          throw new Error("Sign in through Online to verify this solve.");
        await api.solve(day, puzzle.id, puzzleGame.moves);
        if (!alive()) return;
        setMessage("Daily solve verified.");
        await reload();
      }),
    color,
    setColor: (c: Cosmetic) =>
      run(async () => {
        if (api && userId) {
          await api.cosmetic(c);
          await reload();
        } else {
          if (c !== "blue" && c !== "slate")
            throw new Error("This palette needs a verified achievement.");
          change((v) => ({ ...v, palette: c }));
        }
      }),
  };
}
import { analyzeClassic } from "@nexo/engine";
const importHint = (g: GameState) => analyzeClassic(g).bestMoves[0] ?? 0;
export function useSignatureMatch(id: string | null, enabled = true) {
  const { api, user } = useAccount();
  const userId = user?.id;
  const [match, setMatch] = useState<SignatureMatch | null>(null),
    current = useRef<SignatureMatch | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [synced, setSynced] = useState(false),
    busy = useRef(false),
    version = useRef(0),
    anchor = useRef({ server: 0, received: 0 }),
    [now, setNow] = useState(0);
  const accept = useCallback((m: SignatureMatch) => {
    const old = current.current;
    if (
      old &&
      (old.revision > m.revision ||
        (old.revision === m.revision &&
          Date.parse(old.serverNow) > Date.parse(m.serverNow)))
    )
      return;
    current.current = m;
    setMatch(m);
    anchor.current = {
      server: Date.parse(m.serverNow),
      received: performance.now(),
    };
    setNow(anchor.current.server);
    setSynced(true);
    setError(null);
  }, []);
  const refresh = useCallback(async () => {
    if (!api || !id || !userId || !enabled) return;
    const epoch = version.current;
    try {
      const m = await api.variantFetch(id);
      if (epoch === version.current) accept(m);
    } catch (e) {
      if (epoch === version.current) {
        setSynced(false);
        setError(
          e instanceof Error ? e.message : "Reconnect to restore this match.",
        );
      }
    }
  }, [api, id, userId, enabled, accept]);
  useEffect(() => {
    const epoch = ++version.current;
    current.current = null;
    setMatch(null);
    setSynced(false);
    busy.current = false;
    setPending(false);
    if (!api || !id || !userId || !enabled) return;
    void refresh();
    const pull = () => {
      if (epoch === version.current) void refresh();
    };
    const stop = api.subscribe(id, pull, pull, "signature_matches");
    const poll = setInterval(() => {
      if (
        !current.current ||
        ["waiting", "active"].includes(current.current.phase)
      )
        pull();
    }, 1000);
    const tick = setInterval(() => {
      if (current.current?.clock && current.current.phase === "active")
        setNow(
          anchor.current.server + performance.now() - anchor.current.received,
        );
    }, 250);
    return () => {
      version.current = epoch + 1;
      clearInterval(poll);
      clearInterval(tick);
      stop();
    };
  }, [api, id, userId, enabled, refresh]);
  const act = async (
    operation: "move" | "end",
    requestId: string,
    move?: number | UltimateMove,
  ) => {
    if (!api || !current.current || !enabled || !synced || busy.current) return;
    busy.current = true;
    setPending(true);
    const epoch = version.current;
    try {
      const next = await api.variantAct(
        current.current,
        operation,
        requestId,
        move,
      );
      if (epoch === version.current) accept(next);
    } catch (e) {
      if (epoch === version.current) {
        setError(e instanceof Error ? e.message : "Move failed.");
        await refresh();
      }
    } finally {
      if (epoch === version.current) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  return {
    match,
    pending,
    error,
    synced,
    act,
    refresh,
    clocks: match ? displayedClocks(match, now) : null,
  };
}
