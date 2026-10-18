import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, AppState, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  arenaReducer,
  createArenaPersistence,
  createArenaState,
  newLocalId,
  colors as palettes,
  type Palette,
  type ArenaAction,
  type ArenaState,
  type NativePreferences,
} from "@nexo/shared";
import type { SessionAction, Status } from "@nexo/engine";

const persistence = createArenaPersistence(AsyncStorage);
type Context = {
  state: ArenaState;
  ready: boolean;
  active: boolean;
  storageError: string | null;
  colors: Palette;
  reducedMotion: boolean;
  dispatchSession(action: SessionAction): void;
  preferences(patch: Partial<NativePreferences>): void;
  clearHistory(): void;
  play(index: number, actor: "human" | "ai"): Status | null;
};
const ArenaContext = createContext<Context | null>(null);
export function ArenaProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(createArenaState);
  const current = useRef(state);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [active, setActive] = useState(AppState.currentState === "active");
  const [systemReduced, setSystemReduced] = useState(false);
  const systemTheme = useColorScheme();
  const dispatch = useCallback((action: ArenaAction) => {
    // Update synchronously so repeated touches cannot play two turns before rendering.
    const next = arenaReducer(current.current, action);
    current.current = next;
    setState(next);
  }, []);
  useEffect(() => {
    let alive = true;
    persistence
      .load()
      .then((saved) => {
        if (alive) dispatch({ type: "restore", state: saved });
      })
      .catch(() => {
        if (alive)
          setStorageError(
            "Saved data could not be loaded. You can still play.",
          );
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [dispatch]);
  useEffect(() => {
    if (!ready) return;
    persistence
      .save(state)
      .then(() => setStorageError(null))
      .catch(() =>
        setStorageError("Changes could not be saved on this device."),
      );
  }, [state, ready]);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduced);
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setSystemReduced,
    );
    const app = AppState.addEventListener("change", (status) => {
      setActive(status === "active");
      if (status !== "active" && ready)
        persistence
          .save(current.current)
          .catch(() =>
            setStorageError("Changes could not be saved on this device."),
          );
    });
    return () => {
      motion.remove();
      app.remove();
    };
  }, [ready]);
  const dispatchSession = useCallback(
    (action: SessionAction) => {
      if (!ready) return;
      // Ignore stale timer/touch moves; the engine remains the sole validator.
      try {
        dispatch({
          type: "session",
          action,
          id: newLocalId(),
          now: Date.now(),
        });
      } catch {
        /* Stale move after navigation or a rapid touch. */
      }
    },
    [dispatch, ready],
  );
  const play = useCallback(
    (index: number, actor: "human" | "ai"): Status | null => {
      if (!ready || !active) return null;
      const session = current.current.session;
      if (
        session.config.mode === "ai" &&
        (session.game.turn === session.config.humanMark) !== (actor === "human")
      )
        return null;
      try {
        dispatch({
          type: "session",
          action: { type: "move", index },
          id: newLocalId(),
          now: Date.now(),
        });
        return current.current.session.game.status;
      } catch {
        return null;
      }
    },
    [ready, active, dispatch],
  );
  const colors =
    palettes[
      state.preferences.theme === "system"
        ? systemTheme === "light"
          ? "light"
          : "dark"
        : state.preferences.theme
    ];
  return (
    <ArenaContext.Provider
      value={{
        state,
        ready,
        active,
        storageError,
        colors,
        play,
        reducedMotion: systemReduced || state.preferences.reducedMotion,
        dispatchSession,
        preferences: (patch) => dispatch({ type: "preferences", patch }),
        clearHistory: () => dispatch({ type: "clearHistory" }),
      }}
    >
      {children}
    </ArenaContext.Provider>
  );
}
export function useArena() {
  const value = useContext(ArenaContext);
  if (!value) throw new Error("ArenaProvider missing");
  return value;
}
