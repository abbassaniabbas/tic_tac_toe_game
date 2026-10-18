import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { AccountProvider } from "@nexo/online/react";
import {
  dailyPuzzle,
  puzzleStart,
  playPuzzle,
  analyzeClassic,
} from "@nexo/engine";
import { STUDIO_KEY } from "../../../packages/online/src/studio";
import { Studio } from "./studio";
let root: Root, element: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
});

afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
});
async function mount() {
  await act(async () =>
    root.render(
      <AccountProvider client={null}>
        <Studio />
      </AccountProvider>,
    ),
  );
  await act(async () => {
    await vi.waitFor(() =>
      expect(element.textContent).toContain("Nine boards. One win."),
    );
  });
}
async function click(text: string) {
  const button = Array.from(element.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  );
  expect(button, `Missing ${text}`).toBeTruthy();
  await act(async () => button!.click());
}
async function square(n: number) {
  const button = element.querySelector(
    `[aria-label="Square ${n + 1}, empty"]`,
  ) as HTMLButtonElement;
  expect(button).toBeTruthy();
  await act(async () => button.click());
}
it("routes a local Ultimate move to the next required board and saves it", async () => {
  await mount();
  await square(2);
  expect(element.textContent).toContain("O to move");
  expect(element.textContent).toContain("Play in board 3.");
  expect(JSON.parse(localStorage.getItem(STUDIO_KEY)!).ultimateMoves).toEqual([
    { board: 0, cell: 2 },
  ]);
  await click("New Ultimate game");
  expect(element.textContent).toContain("X to move");
});
it("solves the daily puzzle offline against deterministic replies", async () => {
  await mount();
  await click("Daily puzzle");
  const p = dailyPuzzle(new Date().toISOString().slice(0, 10));
  let game = puzzleStart(p);
  while (game.status === "playing") {
    const n = analyzeClassic(game).bestMoves[0];
    await square(n);
    game = playPuzzle(p, game, n);
  }
  expect(element.textContent).toContain("Puzzle solved.");
  const verify = Array.from(element.querySelectorAll("button")).find(
    (b) => b.textContent === "Verify daily solve",
  );
  expect(verify?.disabled).toBe(true);
});
it("branches a replay without changing its accepted local moves", async () => {
  const day = new Date().toISOString().slice(0, 10);
  localStorage.setItem(
    STUDIO_KEY,
    JSON.stringify({
      version: 1,
      ultimateMoves: [],
      records: [
        {
          id: "example",
          rule: "classic-v1",
          first: "X",
          moves: [0, 3, 1, 4, 2],
          result: "X",
          source: "local",
        },
      ],
      puzzleDay: day,
      puzzleMoves: dailyPuzzle(day).seed,
      palette: "blue",
    }),
  );
  await mount();
  await click("Replay Lab");
  await click("Local · classic · 5 moves · X");
  await square(4);
  expect(element.textContent).toContain("SANDBOX BRANCH");
  await click("Next");
  expect(element.textContent).toContain("MOVE 1/5");
  expect(element.textContent).toContain("Perfect play:");
  expect(
    JSON.parse(localStorage.getItem(STUDIO_KEY)!).records[0].moves,
  ).toEqual([0, 3, 1, 4, 2]);
});
it("offers offline palettes while keeping verified cosmetics locked", async () => {
  await mount();
  await click("Collection");
  await click("Silver");
  expect(element.querySelector(".studio")?.getAttribute("style")).toContain(
    "#a1a5b4",
  );
  const violet = Array.from(element.querySelectorAll("button")).find((b) =>
    b.textContent?.startsWith("Victory violet"),
  );
  expect(violet?.disabled).toBe(true);
});
