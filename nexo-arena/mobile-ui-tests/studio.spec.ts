import { test, expect } from "@playwright/test";
import {
  dailyPuzzle,
  puzzleStart,
  playPuzzle,
  analyzeClassic,
} from "../packages/game-engine/src/index";
test("native Studio routes Ultimate, restores it and solves the daily puzzle", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("tab", { name: "Studio" }).click();
  await expect(page.getByText("Nine boards. One win.")).toBeVisible();
  await page.getByTestId("square-2").click();
  await expect(page.getByText("BOARD 3", { exact: true })).toBeVisible();
  await expect(page.getByText("O to move", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("O to move", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Daily puzzle", exact: true }).click();
  const p = dailyPuzzle(new Date().toISOString().slice(0, 10));
  let game = puzzleStart(p);
  while (game.status === "playing") {
    const square = analyzeClassic(game).bestMoves[0];
    await page.getByTestId(`square-${square}`).click();
    game = playPuzzle(p, game, square);
  }
  await expect(page.getByText("Puzzle solved.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verify daily solve" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
