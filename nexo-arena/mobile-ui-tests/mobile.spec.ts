import { test, expect } from "@playwright/test";
test("native screens: local win, rematch, history, replay, persisted preferences", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Play now →" })).toBeVisible();
  await page.getByRole("radio", { name: "GAME MODE: local" }).click();
  await page.getByRole("button", { name: "Play now →" }).click();
  await page.context().setOffline(true);
  for (const i of [0, 3, 1, 4, 2])
    await page.getByTestId(`square-${i}`).click();
  await expect(page.getByText("Player X wins.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play again →" }).click();
  await expect(page.getByText("ROUND 02")).toBeVisible();
  await page.getByRole("button", { name: "Back to arena" }).click();
  await page.getByRole("tab", { name: "History" }).click();
  await page.getByRole("button", { name: "X won, local, view match" }).click();
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Next →" }).click();
  await expect(
    page.getByText("Final result: X won", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "← History" }).click();
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Privacy & data" }).click();
  await expect(
    page.getByText("Play without an account", { exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Player name" }).fill("Ada");
  await page.getByRole("radio", { name: "APPEARANCE: light" }).click();
  await page.context().setOffline(false);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Player name" })).toHaveValue(
    "Ada",
  );
  await page.getByRole("tab", { name: "Arena" }).click();
  await expect(page.getByText("YOUR ARENA, ADA")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("AI responds once, undo works, current round survives reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "DIFFICULTY: hard" }).click();
  await page.getByRole("button", { name: "Play now →" }).click();
  await page.getByTestId("square-0").click();
  await expect(page.getByTestId("square-4")).toHaveAttribute(
    "aria-label",
    "Row 2, column 2, O",
  );
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(page.getByTestId("square-0")).toHaveAttribute(
    "aria-label",
    "Row 1, column 1, empty",
  );
  await page.getByTestId("square-0").click();
  await expect(page.getByTestId("square-4")).toHaveAttribute(
    "aria-label",
    "Row 2, column 2, O",
  );
  await page.reload();
  await expect(page.getByTestId("square-0")).toHaveAttribute(
    "aria-label",
    "Row 1, column 1, X",
  );
  await expect(page.getByTestId("square-4")).toHaveAttribute(
    "aria-label",
    "Row 2, column 2, O",
  );
});

test("native online tab matches the build configuration and keeps guest play available", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("tab", { name: "Online" }).click();
  if (process.env.NEXO_EXPECT_ONLINE === "1") {
    await expect(
      page.getByRole("button", { name: "Send sign-in code" }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Arena" }).click();
  } else {
    await expect(page.getByText(/Online play is unavailable/)).toBeVisible();
    await page.getByRole("button", { name: "Play offline →" }).click();
  }
  await expect(page.getByRole("button", { name: "Play now →" })).toBeVisible();
  expect(errors).toEqual([]);
});
