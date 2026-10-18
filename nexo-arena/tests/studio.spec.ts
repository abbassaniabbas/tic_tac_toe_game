import { test, expect, type Page } from "@playwright/test";
import {
  dailyPuzzle,
  puzzleStart,
  playPuzzle,
  analyzeClassic,
} from "../packages/game-engine/src/index";

async function studio(page: Page) {
  await page.getByRole("button", { name: "Explore Studio →" }).click();
  await expect(page.getByText("Nine boards. One win.")).toBeVisible();
  return page.getByRole("dialog");
}
test("Studio Ultimate routes, persists and solves the daily puzzle offline", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const dialog = await studio(page);
  await dialog
    .getByRole("button", { name: "Square 3, empty", exact: true })
    .click();
  await expect(dialog.getByText("O to move", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("Play in board 3.", { exact: false }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await studio(page);
  await expect(dialog.getByText("O to move", { exact: true })).toBeVisible();
  await context.setOffline(true);
  await dialog
    .getByRole("button", { name: "Daily puzzle", exact: true })
    .click();
  const p = dailyPuzzle(new Date().toISOString().slice(0, 10));
  let game = puzzleStart(p);
  while (game.status === "playing") {
    const square = analyzeClassic(game).bestMoves[0];
    await dialog
      .getByRole("button", { name: `Square ${square + 1}, empty`, exact: true })
      .click();
    game = playPuzzle(p, game, square);
  }
  await expect(
    dialog.getByText("Puzzle solved.", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Verify daily solve" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("Replay Lab branches a completed Classic game without modifying its saved moves", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /LOCAL 2 PLAYER/ }).click();
  await page
    .getByRole("button", { name: "Enter the arena", exact: true })
    .click();
  for (const n of [1, 4, 2, 5, 3])
    await page
      .getByRole("button", { name: `Square ${n}, empty`, exact: true })
      .click();
  await expect(
    page.getByRole("heading", { name: "X takes the game." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to lobby", exact: true })
    .click();
  const dialog = await studio(page);
  await dialog.getByRole("button", { name: "Replay Lab", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Local · classic · 5 moves · X" })
    .click();
  await dialog
    .getByRole("button", { name: "Square 5, empty", exact: true })
    .click();
  await expect(dialog.getByText(/SANDBOX BRANCH/)).toBeVisible();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByText(/MOVE 1\/5/)).toBeVisible();
  await expect(dialog.getByText(/Perfect play:/)).toBeVisible();
  const moves = await page.evaluate(
    () => JSON.parse(localStorage.getItem("nexo.studio.v1")!).records[0].moves,
  );
  expect(moves).toEqual([0, 3, 1, 4, 2]);
});
