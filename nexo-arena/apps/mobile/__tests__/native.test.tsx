import React from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
} from "@testing-library/react-native";
import { createGame, createSession, playMove } from "@nexo/engine";
import { Board } from "../components/board";
import { useAiTurn } from "../lib/ai-turn";
import { Options } from "../components/ui";
jest.mock("../lib/arena-provider", () => {
  const shared = require("@nexo/shared");
  return {
    useArena: () => ({
      colors: shared.colors.dark,
      reducedMotion: true,
      state: shared.createArenaState(),
    }),
  };
});
describe("native touch controls", () => {
  it("plays an empty square and blocks occupied squares", () => {
    const onMove = jest.fn();
    const game = playMove(createGame(), 0);
    const screen = render(<Board game={game} onMove={onMove} />);
    fireEvent.press(screen.getByTestId("square-0"));
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId("square-4"));
    expect(onMove).toHaveBeenCalledWith(4);
  });
  it("blocks touches on AI turns and finished boards", () => {
    const onMove = jest.fn();
    const screen = render(
      <Board game={createGame()} disabled onMove={onMove} />,
    );
    fireEvent.press(screen.getByTestId("square-4"));
    expect(onMove).not.toHaveBeenCalled();
    const game = [0, 3, 1, 4, 2].reduce((g, i) => playMove(g, i), createGame());
    screen.rerender(<Board game={game} onMove={onMove} />);
    fireEvent.press(screen.getByTestId("square-8"));
    expect(onMove).not.toHaveBeenCalled();
  });
  it("exposes settings choices with selected accessibility state", () => {
    const onChange = jest.fn();
    const screen = render(
      <Options
        label="THEME"
        values={["dark", "light"]}
        value="dark"
        onChange={onChange}
      />,
    );
    expect(
      screen.getByLabelText("THEME: dark").props.accessibilityState.selected,
    ).toBe(true);
    fireEvent.press(screen.getByLabelText("THEME: light"));
    expect(onChange).toHaveBeenCalledWith("light");
  });
});
describe("AI lifecycle", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  it("cancels when backgrounded or navigating away and resumes once", () => {
    const play = jest.fn();
    const session = createSession({
      ...createSession().config,
      firstMark: "O",
      difficulty: "hard",
    });
    const { rerender, unmount } = renderHook<void, { enabled: boolean }>(
      ({ enabled }) => useAiTurn(session, enabled, play),
      { initialProps: { enabled: true } },
    );
    act(() => jest.advanceTimersByTime(200));
    rerender({ enabled: false });
    act(() => jest.advanceTimersByTime(1000));
    expect(play).not.toHaveBeenCalled();
    rerender({ enabled: true });
    act(() => jest.advanceTimersByTime(500));
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith(4);
    unmount();
  });
  it("does not move in local mode, human turns, or terminal games", () => {
    const play = jest.fn();
    const session = createSession();
    const hook = renderHook(() => useAiTurn(session, true, play));
    act(() => jest.advanceTimersByTime(1000));
    expect(play).not.toHaveBeenCalled();
    hook.unmount();
  });
});
