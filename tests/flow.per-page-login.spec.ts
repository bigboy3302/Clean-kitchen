import { test, expect, Page } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL!;
const PASSWORD = process.env.TEST_PASSWORD!;

const SNAP_DELAY = Number(process.env.SNAPSHOT_DELAY_MS ?? 1500);

// ---------- helpers ----------
async function settle(page: Page, selector?: string, extraWait = SNAP_DELAY) {
  await page.waitForLoadState('domcontentloaded');
  if (selector) {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  }
  await page.waitForTimeout(extraWait);
}

async function clearClientAuth(page: Page) {
  await page.goto('about:blank');
  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    try { indexedDB.deleteDatabase('firebaseLocalStorageDb'); } catch {}
  });
}

/** Close the “Everything fresh” toast if it’s visible. */
async function dismissFreshToast(page: Page) {
  const toast = page.getByText(/everything fresh/i);
  if (await toast.first().isVisible().catch(() => false)) {
    const close = page.getByRole('button', { name: /close/i }).or(page.getByText(/^close$/i));
    if (await close.first().isVisible().catch(() => false)) {
      await close.first().click().catch(() => {});
    }
  }
}

/** Slowly scroll top→bottom to trigger lazy content; then return to top. */
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

/** Ensure we are on the login form (email+password+Sign in). */
async function gotoLogin(page: Page) {
  for (const path of ['/auth', '/profile', '/login', '/signin']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const email = page.getByPlaceholder(/you@email\.com/i).or(page.locator('input[type="email"]'));
    const pass  = page.getByLabel(/^password$/i).or(page.locator('input[type="password"]'));
    const btn   = page.getByRole('button', { name: /^sign in$/i });
    if (
      await email.first().isVisible().catch(() => false) &&
      await pass.first().isVisible().catch(() => false) &&
      await btn.first().isVisible().catch(() => false)
    ) return;
  }
  // last resort: still take whatever is on screen for debugging
}

/** Perform a login using your UI; land wherever the app sends you (usually Recipes). */
async function performLogin(page: Page) {
  const email = page.getByPlaceholder(/you@email\.com/i).or(page.locator('input[type="email"]'));
  const pass  = page.getByLabel(/^password$/i).or(page.locator('input[type="password"]'));
  const btn   = page.getByRole('button', { name: /^sign in$/i });

  await expect(email).toBeVisible({ timeout: 20_000 });
  await expect(pass).toBeVisible();
  await expect(btn).toBeVisible();

  await settle(page, 'form'); // tiny pause so inputs mount fully
  await email.fill(EMAIL);
  await pass.fill(PASSWORD);

  await Promise.all([
    btn.click(),
    page.waitForURL(/\/(recipes|dashboard|)$/i, { timeout: 30_000 }).catch(() => {}),
  ]);
  await settle(page, 'main');
}

/** Fresh login for a target page, wait for a heading, scroll through, snap. */
async function loginThenSnap(page: Page, targetPath: string, headingRegex: RegExp, outPath: string) {
  await clearClientAuth(page);
  await page.goto(targetPath, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await gotoLogin(page);
  await page.screenshot({ path: outPath.replace(/\/\d+-/, '/tmp-'), fullPage: true }).catch(() => {}); // optional pre-login diag
  await performLogin(page);
  // ensure we are on the desired page (app might land on /recipes)
  await page.goto(targetPath, { waitUntil: 'domcontentloaded' }).catch(() => {});
  // close toast/overlays and wait for heading
  await dismissFreshToast(page);
  const heading = page.getByRole('heading', { name: headingRegex });
  await heading.first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  await settle(page, 'main');
  await scrollThrough(page);
  await dismissFreshToast(page);
  await page.screenshot({ path: outPath, fullPage: true });
}

// ---------- the test ----------
test('login fresh for each page and take full-page screenshots', async ({ page }) => {
  test.setTimeout(360_000);

  // 01) LOGIN PAGE (guarantee actual login form in the shot)
  await clearClientAuth(page);
  await gotoLogin(page);
  await settle(page, 'form', 1000);
  await page.screenshot({ path: 'tests-artifacts/01-login.png', fullPage: true });

  // 02) RECIPES after login
  await performLogin(page);
  if (!(await page.getByRole('heading', { name: /recipes/i }).first().isVisible().catch(() => false))) {
    await page.goto('/recipes', { waitUntil: 'domcontentloaded' }).catch(() => {});
  }
  await dismissFreshToast(page);
  await settle(page, 'main');
  await scrollThrough(page);
  await page.screenshot({ path: 'tests-artifacts/02-recipes.png', fullPage: true });

  // 03) DASHBOARD
  await loginThenSnap(page, '/dashboard', /dashboard|preparing your dashboard/i, 'tests-artifacts/03-dashboard.png');

  // 04) PANTRY
  await loginThenSnap(page, '/pantry', /pantry/i, 'tests-artifacts/04-pantry.png');

  // 05) FITNESS
  await loginThenSnap(page, '/fitness', /fitness/i, 'tests-artifacts/05-fitness.png');

  // 06) PROFILE  (cover both "Profile" and "Account" as possible headings)
  await loginThenSnap(page, '/profile', /profile|account/i, 'tests-artifacts/06-profile.png');
});
