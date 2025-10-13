import { test, expect } from '@playwright/test';
import { openNavIfCollapsed, waitForAppIdle } from './utils';

test('Profile page renders (screenshot)', async ({ page }) => {
  await page.goto('/profile', { waitUntil: 'domcontentloaded' });
  await waitForAppIdle(page, { selector: 'main, nav' });
  await openNavIfCollapsed(page);
  await waitForAppIdle(page);
  const is404 = await page.getByRole('heading', { name: /^404$/ }).isVisible().catch(() => false);
  expect.soft(is404).toBeFalsy();
  await page.screenshot({ path: 'tests-artifacts/05-profile.png', fullPage: true });
});
