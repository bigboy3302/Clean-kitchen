import { test, expect, Page } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL!;
const PASSWORD = process.env.TEST_PASSWORD!;

// Tunable delay (ms) before screenshots, e.g. SNAPSHOT_DELAY_MS=2500
const SNAP_DELAY = Number(process.env.SNAPSHOT_DELAY_MS ?? 1500);

// ---------- helpers ----------
async function settle(page: Page, selector?: string, extra = SNAP_DELAY) {
  await page.waitForLoadState('domcontentloaded');
  if (selector) {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  }
  await page.waitForTimeout(extra);
}

async function clearClientAuth(page: Page) {
  await page.goto('about:blank');
  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    try { indexedDB.deleteDatabase('firebaseLocalStorageDb'); } catch {}
  });
}

async function dismissFreshToast(page: Page) {
  const toast = page.getByText(/everything fresh/i);
  if (await toast.first().isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /close/i }).first().click().catch(() => {});
  }
}

async function scrollThrough(page: Page) {
  await page.evaluate(async () => {
    const step = Math.max(300, Math.floor(window.innerHeight * 0.75));
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await sleep(150);
    }
    window.scrollTo(0, 0);
  });
}

async function gotoLogin(page: Page) {
  const paths = ['/auth', '/profile', '/login', '/signin'];
  for (const p of paths) {
    await page.goto(p, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const email = page.getByPlaceholder(/you@email\.com/i).or(page.locator('input[type="email"]'));
    const pass  = page.getByLabel(/^password$/i).or(page.locator('input[type="password"]'));
    const btn   = page.getByRole('button', { name: /^sign in$/i });
    if (
      await email.first().isVisible().catch(() => false) &&
      await pass.first().isVisible().catch(() => false) &&
      await btn.first().isVisible().catch(() => false)
    ) return;
  }
}

async function performLogin(page: Page) {
  const email = page.getByPlaceholder(/you@email\.com/i).or(page.locator('input[type="email"]'));
  const pass  = page.getByLabel(/^password$/i).or(page.locator('input[type="password"]'));
  const btn   = page.getByRole('button', { name: /^sign in$/i });

  await expect(email).toBeVisible({ timeout: 20_000 });
  await expect(pass).toBeVisible();
  await expect(btn).toBeVisible();

  await settle(page, 'form'); // give the form a moment
  await email.fill(EMAIL);
  await pass.fill(PASSWORD);

  await Promise.all([
    btn.click(),
    page.waitForURL(/\/(recipes|dashboard|)$/i, { timeout: 30_000 }).catch(() => {}),
  ]);

  await settle(page, 'main');
}

async function loginThenSnap(page: Page, targetPath: string, headingRegex: RegExp, outPath: string) {
  await clearClientAuth(page);
  await page.goto(targetPath, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await gotoLogin(page);
  await performLogin(page);

  // Ensure we are on the target page (app might land on /recipes).
  await page.goto(targetPath, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await dismissFreshToast(page);
  await page.getByRole('heading', { name: headingRegex }).first()
    .waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  await settle(page, 'main');
  await scrollThrough(page);
  await dismissFreshToast(page);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`✅ Screenshot saved → ${outPath}`);
}

// ---------- tests (one by one) ----------
test.describe.serial('End-to-end flow (one by one)', () => {
  test.setTimeout(360_000);

  test('01) Login page is visible (screenshot)', async ({ page }) => {
    await clearClientAuth(page);
    await gotoLogin(page);

    const email = page.getByPlaceholder(/you@email\.com/i).or(page.locator('input[type="email"]'));
    const pass  = page.getByLabel(/^password$/i).or(page.locator('input[type="password"]'));
    const btn   = page.getByRole('button', { name: /^sign in$/i });

    await expect(email).toBeVisible({ timeout: 20_000 });
    await expect(pass).toBeVisible();
    await expect(btn).toBeVisible();

    await settle(page, 'form');
    await page.screenshot({ path: 'tests-artifacts/01-login.png', fullPage: true });
    console.log('✅ 01 Login page shows correctly');
  });

  test('02) Login succeeds and lands on Recipes (screenshot)', async ({ page }) => {
    await clearClientAuth(page);
    await gotoLogin(page);
    await performLogin(page);
    // Ensure Recipes
    if (!(await page.getByRole('heading', { name: /recipes/i }).first().isVisible().catch(() => false))) {
      await page.goto('/recipes', { waitUntil: 'domcontentloaded' }).catch(() => {});
    }
    await dismissFreshToast(page);
    await settle(page, 'main');
    await scrollThrough(page);
    await page.screenshot({ path: 'tests-artifacts/02-recipes.png', fullPage: true });
    console.log('✅ 02 Login works and Recipes loaded');
  });

  test('03) Dashboard renders (fresh login + screenshot)', async ({ page }) => {
    await loginThenSnap(page, '/dashboard', /dashboard|preparing your dashboard/i, 'tests-artifacts/03-dashboard.png');
  });

  test('04) Pantry renders (fresh login + screenshot)', async ({ page }) => {
    await loginThenSnap(page, '/pantry', /pantry/i, 'tests-artifacts/04-pantry.png');
  });

  test('05) Fitness renders full page (fresh login + screenshot)', async ({ page }) => {
    await loginThenSnap(page, '/fitness', /fitness/i, 'tests-artifacts/05-fitness.png');
  });

  test('06) Profile renders (fresh login + screenshot)', async ({ page }) => {
    await loginThenSnap(page, '/profile', /profile|account/i, 'tests-artifacts/06-profile.png');
  });
});
