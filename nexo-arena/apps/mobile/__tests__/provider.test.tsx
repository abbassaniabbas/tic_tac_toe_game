import React from "react";
import { AppState, AccessibilityInfo } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ArenaProvider, useArena } from "../lib/arena-provider";
import { createArenaState } from "@nexo/shared";
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ArenaProvider>{children}</ArenaProvider>
);
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  Object.defineProperty(AppState, "currentState", {
    value: "active",
    configurable: true,
  });
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());
it("guards rapid AI-turn taps and saves the current board", async () => {
  const { result, unmount } = renderHook(useArena, { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => {
    expect(result.current.play(0, "human")).toBe("playing");
    expect(result.current.play(1, "human")).toBeNull();
  });
  expect(result.current.state.session.game.moves).toEqual([0]);
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
  await waitFor(async () => {
    const raw = await AsyncStorage.getItem("nexo-native-v1");
    expect(JSON.parse(raw!).session.game.moves).toEqual([0]);
  });
  unmount();
});
it("hydrates preferences and pending AI turns without losing the session", async () => {
  const state = createArenaState("restore");
  state.preferences.theme = "light";
  state.preferences.playerName = "Ada";
  await AsyncStorage.setItem("nexo-native-v1", JSON.stringify(state));
  const { result, unmount } = renderHook(useArena, { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.state.matchId).toBe("restore");
  expect(result.current.state.preferences.playerName).toBe("Ada");
  expect(result.current.colors.background).toBe("#f4f5f8");
  unmount();
});
