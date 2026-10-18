import { test, expect } from "@playwright/test";
test("privacy, support and browser deletion paths work with the offline shell", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy & your data" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Public leaderboard visibility starts off/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Support", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "How can we help?" }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "How can we help?" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Delete account", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Delete your NEXO Arena account" }),
  ).toBeVisible();
  if (process.env.NEXO_EXPECT_ONLINE === "1")
    await expect(
      page.getByRole("button", { name: "Send sign-in code" }),
    ).toBeVisible();
  else await expect(page.getByText(/Online play is unavailable/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
