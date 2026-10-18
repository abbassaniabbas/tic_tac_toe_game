import { test, expect } from "@playwright/test";
test("online entry matches the build configuration and keeps guest play available", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Online", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Play together" });
  if (process.env.NEXO_EXPECT_ONLINE === "1") {
    await expect(
      dialog.getByRole("textbox", { name: "Email", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Send sign-in code" }),
    ).toBeVisible();
  } else
    await expect(dialog.getByText(/Online play is unavailable/)).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await page
    .getByRole("button", { name: "Enter the arena", exact: true })
    .click();
  await expect(page.getByTestId("board")).toBeVisible();
  expect(errors).toEqual([]);
});
test("static root invitation links open online play without an auth redirect", async ({
  page,
}) => {
  await page.goto(`/?invite=${"a".repeat(48)}`);
  await expect(
    page.getByRole("dialog", { name: "Play together" }),
  ).toBeVisible();
  if (process.env.NEXO_EXPECT_ONLINE === "1")
    await expect(
      page.getByRole("button", { name: "Send sign-in code" }),
    ).toBeVisible();
  else await expect(page.getByText(/Online play is unavailable/)).toBeVisible();
});
