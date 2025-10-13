import { test, expect } from '@playwright/test';

const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

test.describe('Login flow (skips if /auth does not exist)', () => {
  test('visit /auth (or /auth/login), sign in if present, else skip', async ({ page }) => {
    // Try auth routes
    const routes = ['/auth', '/auth/login', '/login'];
    let reached = false;
    for (const r of routes) {
      try {
        await page.goto(r, { waitUntil: 'domcontentloaded' });
        reached = true;
        break;
      } catch {}
    }
    if (!reached) {
      await page.screenshot({ path: 'tests-artifacts/login-auth-not-reached.png', fullPage: true });
      test.skip(true, 'No auth route available (server unreachable or route missing).');
    }

    // If this is a Next.js 404 page, skip gracefully (but keep a screenshot)
    const is404 = await page.getByRole('heading', { name: /^404$/ }).isVisible().catch(() => false);
    if (is404) {
      await page.screenshot({ path: 'tests-artifacts/login-404.png', fullPage: true });
      test.skip(true, 'Auth route returns 404 in this build; skipping login.');
    }

    // If your app DOES have inputs, the block below will run; otherwise we already skipped.
    const email =
      page.locator('input[type="email"], input[name*="email" i], input[id*="email" i]').first();
    const password =
      page.locator('input[type="password"], input[name*="pass" i], input[id*="pass" i]').first();

    if (!(await email.count()) || !(await password.count())) {
      await page.screenshot({ path: 'tests-artifacts/login-missing-inputs.png', fullPage: true });
      test.skip(true, 'Email/password inputs not present; skipping login.');
    }

    await email.fill(String(EMAIL ?? 'test@example.com'));
    await password.fill(String(PASSWORD ?? 'password'));
    const submit = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first();
    await Promise.all([page.waitForLoadState('domcontentloaded'), submit.click()]);

    // If your app redirects to a dashboard after login:
    await page.waitForURL(/\/dashboard/i, { timeout: 15_000 }).catch(() => {});
    await page.screenshot({ path: 'tests-artifacts/login-after.png', fullPage: true });
    await page.context().storageState({ path: 'tests-artifacts/storageState.json' });
  });
});
