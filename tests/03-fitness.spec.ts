import { test, expect } from '@playwright/test';
import { openNavIfCollapsed, waitForAppIdle } from './utils';

test('Fitness page renders (screenshot)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForAppIdle(page, { selector: 'main, nav' });
  await openNavIfCollapsed(page);

  const link = page.getByRole('link', { name: /fitness|fitn(e|)ss/i });
  if (await link.count()) {
    await link.first().click();
  } else {
    await page.goto('/fitness', { waitUntil: 'domcontentloaded' });
  }

  await waitForAppIdle(page, { selector: 'main' });
  const is404 = await page.getByRole('heading', { name: /^404$/ }).isVisible().catch(() => false);
  expect.soft(is404).toBeFalsy();
  await page.screenshot({ path: 'tests-artifacts/03-fitness.png', fullPage: true });
});
