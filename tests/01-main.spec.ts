import { test, expect } from '@playwright/test';
import { openNavIfCollapsed, waitForAppIdle } from './utils';

test('Main page renders (screenshot)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForAppIdle(page, { selector: 'main, nav' });
  await openNavIfCollapsed(page);
  await waitForAppIdle(page);
  const is404 = await page.getByRole('heading', { name: /^404$/ }).isVisible().catch(() => false);
  expect.soft(is404).toBeFalsy();
  await page.screenshot({ path: 'tests-artifacts/01-main.png', fullPage: true });
});
