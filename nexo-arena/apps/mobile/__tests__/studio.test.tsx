import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccountProvider } from "@nexo/online/react";
import {
  dailyPuzzle,
  puzzleStart,
  playPuzzle,
  analyzeClassic,
} from "@nexo/engine";
import StudioScreen from "../app/(tabs)/studio";
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../lib/arena-provider", () => ({
  useArena: () => {
    const shared = require("@nexo/shared");
    return {
      active: true,
      ready: true,
      colors: shared.colors.dark,
      reducedMotion: true,
      state: {
        ...shared.createArenaState(),
        history: [
          {
            id: "classic-history",
            completedAt: 1,
            config: {
              mode: "local",
              difficulty: "hard",
              humanMark: "X",
              firstMark: "X",
            },
            moves: [0, 3, 1, 4, 2],
            winner: "X",
            status: "won",
          },
        ],
      },
    };
  },
}));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useFocusEffect: (callback: () => void) =>
    require("react").useEffect(callback, [callback]),
  router: { push: jest.fn(), replace: jest.fn() },
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
}));
jest.mock("../lib/online", () => ({
  invitationLink: (token: string) => token,
}));
beforeEach(async () => {
  await AsyncStorage.clear();
});
function mount() {
  return render(
    <AccountProvider client={null}>
      <StudioScreen />
    </AccountProvider>,
  );
}
it("plays and persists native Ultimate routing with accessible board selection", async () => {
  const screen = mount();
  await waitFor(() =>
    expect(screen.getByText("Nine boards. One win.")).toBeTruthy(),
  );
  fireEvent.press(screen.getByTestId("square-2"));
  await waitFor(() => expect(screen.getByText("BOARD 3")).toBeTruthy());
  expect(screen.getByText("O to move")).toBeTruthy();
  await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
  fireEvent.press(screen.getByRole("button", { name: "New Ultimate game" }));
  expect(screen.getByText("X to move")).toBeTruthy();
});
it("solves a native daily puzzle offline without awarding a server achievement", async () => {
  const screen = mount();
  await waitFor(() =>
    expect(screen.getByText("Nine boards. One win.")).toBeTruthy(),
  );
  fireEvent.press(screen.getByRole("button", { name: "Daily puzzle" }));
  const p = dailyPuzzle(new Date().toISOString().slice(0, 10));
  let game = puzzleStart(p);
  while (game.status === "playing") {
    const square = analyzeClassic(game).bestMoves[0];
    await act(async () =>
      fireEvent.press(screen.getByTestId(`square-${square}`)),
    );
    game = playPuzzle(p, game, square);
  }
  expect(screen.getByText("Puzzle solved.")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Verify daily solve" }).props
      .accessibilityState.disabled,
  ).toBe(true);
});
it("opens existing native Classic history in Replay Lab and isolates branches", async () => {
  const screen = mount();
  await waitFor(() =>
    expect(screen.getByText("Nine boards. One win.")).toBeTruthy(),
  );
  fireEvent.press(screen.getByRole("button", { name: "Replay Lab" }));
  fireEvent.press(
    screen.getByRole("button", { name: "Local · classic · 5 moves · X" }),
  );
  fireEvent.press(screen.getByTestId("square-4"));
  expect(screen.getByText(/SANDBOX BRANCH/)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText(/MOVE 1\/5/)).toBeTruthy();
  expect(screen.getByText(/Perfect play:/)).toBeTruthy();
});
