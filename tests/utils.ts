import { Page } from '@playwright/test';

const DEFAULT_DELAY = Number(process.env.SNAPSHOT_DELAY_MS ?? 2000);

export async function waitForAppIdle(
  page: Page,
  opts: { selector?: string; delayMs?: number } = {}
) {
  const { selector, delayMs = DEFAULT_DELAY } = opts;
  await page.waitForLoadState('domcontentloaded');
  if (selector) {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 20_000 });
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  if (delayMs > 0) await page.waitForTimeout(delayMs);
}

export async function openNavIfCollapsed(page: Page) {
  const openBtn = page.getByRole('button', { name: /open navigation/i });
  if (await openBtn.count()) await openBtn.first().click().catch(() => {});
}
