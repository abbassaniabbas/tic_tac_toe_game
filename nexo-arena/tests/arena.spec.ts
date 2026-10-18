import { test, expect, type Page } from '@playwright/test';

async function localGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /LOCAL 2 PLAYER/ }).click();
  await page.getByRole('button', { name: 'Enter the arena', exact: true }).click();
}
const square = (page: Page, index: number) => page.getByRole('button', { name: `Square ${index}, empty`, exact: true });
test('local win, terminal guard, scores, rematch, and restart', async ({ page }) => {
  await localGame(page);
  for (const index of [1,4,2,5,3]) await square(page, index).click();
  await expect(page.getByRole('heading', { name: 'X takes the game.' })).toBeVisible();
  await expect(page.getByTestId('score-X')).toHaveText('1');
  await square(page, 9).dispatchEvent('click');
  await expect(square(page, 9)).toHaveAttribute('aria-disabled','true');
  await expect(page.getByRole('button', { name: 'Undo move' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rematch', exact: true }).click();
  await expect(page.getByTestId('score-X')).toHaveText('1');
  await expect(page.getByRole('button', { name: /Square \d, empty/ })).toHaveCount(9);
  await square(page, 1).click();
  await page.getByRole('button', { name: 'Restart round' }).click();
  await expect(page.getByRole('button', { name: /Square \d, empty/ })).toHaveCount(9);
  await expect(page.getByTestId('score-X')).toHaveText('1');
});
test('local draw and undo restore turn ownership', async ({ page }) => {
  await localGame(page);
  await square(page, 1).click(); await page.getByRole('button', { name: 'Undo move' }).click();
  await expect(page.getByRole('heading', { name: 'X, your move.' })).toBeVisible();
  for (const index of [1,2,3,5,4,6,8,7,9]) await square(page, index).click();
  await expect(page.getByRole('heading', { name: 'Perfectly matched.' })).toBeVisible();
  await expect(page.getByTestId('score-draws')).toHaveText('1');
});
test('choose O, AI first, hard AI, undo and new game', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Hard', exact: true }).click();
  await page.getByRole('button', { name: 'O', exact: true }).click();
  await page.getByLabel('First move').selectOption('X');
  await page.getByRole('button', { name: 'Enter the arena', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Square 5, X' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo move' })).toBeDisabled();
  await square(page, 1).click();
  await expect(page.getByRole('button', { name: /Square \d, X/ })).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo move' }).click();
  await expect(page.getByRole('button', { name: /Square \d, X/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Square \d, O/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'New game', exact: true }).click();
  await page.getByRole('button', { name: /LOCAL 2 PLAYER/ }).click();
  await page.getByLabel('First move').selectOption('O');
  await page.getByRole('button', { name: 'Enter the arena', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'O, your move.' })).toBeVisible();
});
test('keyboard board navigation, focus trap and preferences', async ({ page }) => {
  await localGame(page);
  await square(page, 5).focus();
  await page.keyboard.press('ArrowLeft'); await expect(square(page, 4)).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('button', { name: 'Square 4, X' })).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(square(page, 1)).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('button', { name: 'Square 1, O' })).toBeVisible();
  await page.getByRole('button', { name: 'Your preferences', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await page.getByRole('switch', { name: 'Reduce motion' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Your preferences', exact: true })).toBeFocused();
});
test('responsive board, score persistence and offline reload', async ({ page, context }) => {
  await localGame(page);
  const board = await page.getByTestId('board').boundingBox();
  expect(board!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const index of [1,4,2,5,3]) await square(page, index).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.getByRole('button', { name: 'Play now', exact: true }).first().click();
  await expect(page.getByTestId('score-X')).toHaveText('1');
  await context.setOffline(true); await page.reload();
  await page.getByRole('button', { name: 'Play now', exact: true }).first().click();
  await expect(page.getByTestId('board')).toBeVisible();
  await square(page, 5).click(); await expect(page.getByRole('button', { name: 'Square 5, X' })).toBeVisible();
  await expect(page.getByText('Offline. Your arena is still open.')).toBeVisible();
});
