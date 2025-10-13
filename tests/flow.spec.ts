import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL!;
const PASSWORD = process.env.TEST_PASSWORD!;

async function settle(page, selector?: string, ms = Number(process.env.SNAPSHOT_DELAY_MS ?? 1200)) {
  await page.waitForLoadState('domcontentloaded');
  if (selector) {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  }
  await page.waitForTimeout(ms);
}

async function clearClientAuth(page) {
  await page.goto('about:blank');
  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    try { indexedDB.deleteDatabase('firebaseLocalStorageDb'); } catch {}
  });
}

async function isLoginVisible(page) {
  const email = page.getByPlaceholder(/you@email\.com/i).or(page.locator('input[type="email"]'));
  const pass  = page.getByLabel(/^password$/i).or(page.locator('input[type="password"]'));
  const btn   = page.getByRole('button', { name: /^sign in$/i });
  const ok =
    (await email.first().isVisible().catch(() => false)) &&
    (await pass.first().isVisible().catch(() => false)) &&
    (await btn.first().isVisible().catch(() => false));
  return ok;
}

async function isRecipesVisible(page) {
  return await page.getByRole('heading', { name: /recipes/i })
                   .first().isVisible().catch(() => false);
}

test('01 login -> 02 recipes -> 03 dashboard -> 04 pantry -> 05 fitness -> 06 profile (screenshots)', async ({ page }) => {
  test.setTimeout(240_000);

  // 0) Always start logged out (so we see a real login at least once)
  await clearClientAuth(page);

  // 1) Try to reach login directly; otherwise use a protected route to trigger it
  for (const path of ['/auth', '/profile', '/login', '/signin']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await settle(page);
    if (await isLoginVisible(page) || await isRecipesVisible(page)) break;
  }

  // 01) LOGIN PAGE screenshot (or whatever we see right now, for traceability)
  await page.screenshot({ path: 'tests-artifacts/01-login.png', fullPage: true });

  // 2) If login form is present → actually sign in. Otherwise, assume we’re already in.
  if (await isLoginVisible(page)) {
    const emailInput = page.getByPlaceholder(/you@email\.com/i).or(page.locator('input[type="email"]'));
    const passInput  = page.getByLabel(/^password$/i).or(page.locator('input[type="password"]'));
    const signInBtn  = page.getByRole('button', { name: /^sign in$/i });

    await emailInput.fill(EMAIL);
    await passInput.fill(PASSWORD);

    await Promise.all([
      signInBtn.click(),
      // your app typically lands on recipes after login
      page.waitForURL(/\/(recipes|dashboard|)$/i, { timeout: 30_000 }).catch(() => {}),
    ]);
  }

  // 02) RECIPES (post-login landing)
  if (!(await isRecipesVisible(page))) {
    // be explicit if we aren’t on it yet
    await page.goto('/recipes', { waitUntil: 'domcontentloaded' }).catch(() => {});
  }
  await settle(page, 'main');
  await page.screenshot({ path: 'tests-artifacts/02-recipes.png', fullPage: true });

  // 03) DASHBOARD
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(page, 'main'); // ok even if it shows “Preparing your dashboard…”
  await page.screenshot({ path: 'tests-artifacts/03-dashboard.png', fullPage: true });

  // 04) PANTRY
  await page.goto('/pantry', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(page, 'main');
  await page.screenshot({ path: 'tests-artifacts/04-pantry.png', fullPage: true });

  // 05) FITNESS
  await page.goto('/fitness', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(page, 'main');
  await page.screenshot({ path: 'tests-artifacts/05-fitness.png', fullPage: true });

  // 06) PROFILE
  await page.goto('/profile', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(page, 'main');
  await page.screenshot({ path: 'tests-artifacts/06-profile.png', fullPage: true });
});
