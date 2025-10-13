// tests/auth.setup.ts
import { test, expect } from '@playwright/test';

// Make this setup extra forgiving
test.setTimeout(180_000);
test.slow();

const EMAIL = process.env.TEST_EMAIL!;
const PASSWORD = process.env.TEST_PASSWORD!;

// App-specific cues we can wait for after login:
const POST_LOGIN_SELECTORS = [
  // you showed a "Preparing your dashboard..." state previously
  'text=/Preparing your dashboard/i',
  // typical nav links/buttons visible after auth
  'a:has-text("Pantry")',
  'a:has-text("Fitness")',
  'a:has-text("Profile")',
  'a:has-text("Dashboard")',
  'nav',
  'main'
];

test('Auth setup: show login page, sign in, save storageState', async ({ page }) => {
  // 1) Go straight to login page (adjust if your path differs)
  await page.goto('/auth', { waitUntil: 'domcontentloaded' }).catch(() => {});
  // Fallbacks in case /auth isn’t direct:
  if (!(await page.getByPlaceholder(/you@email\.com/i).count())) {
    const candidates = ['/login', '/signin', '/'];
    for (const c of candidates) {
      await page.goto(c, { waitUntil: 'domcontentloaded' }).catch(() => {});
      // Click visible “Sign in / Log in” if present
      const trigger = page.getByRole('link', { name: /sign ?in|log ?in/i }).or(
        page.getByRole('button', { name: /sign ?in|log ?in/i })
      );
      if (await trigger.count()) {
        await trigger.first().click().catch(() => {});
        break;
      }
    }
  }

  // 2) Screenshot of the LOGIN PAGE (proof step 1)
  await page.waitForLoadState('domcontentloaded');
  await page.screenshot({ path: 'tests-artifacts/00-login-page.png', fullPage: true });

  // 3) Fill the form using your exact UI (from your screenshot)
  const email = page.getByPlaceholder(/you@email\.com/i).or(page.locator('input[type="email"]'));
  const password = page.getByLabel(/^password$/i).or(page.locator('input[type="password"]'));
  const submit = page.getByRole('button', { name: /^sign in$/i });

  await expect(email, 'Email input not found on login page').toBeVisible({ timeout: 20_000 });
  await expect(password, 'Password input not found on login page').toBeVisible({ timeout: 20_000 });
  await expect(submit, 'Sign in button not found on login page').toBeVisible({ timeout: 20_000 });

  await email.fill(EMAIL);
  await password.fill(PASSWORD);

  // 4) Submit and wait for any concrete post-login cue
  await Promise.all([
    submit.click(),
    // don't use networkidle; wait for URL change OR any post-login selector
    page.waitForURL(/\/(dashboard|profile|pantry|fitness|)$/i, { timeout: 30_000 }).catch(() => {})
  ]);

  // Also poll for specific UI that indicates we're in:
  let loggedIn = false;
  const start = Date.now();
  while (!loggedIn && Date.now() - start < 30_000) {
    for (const sel of POST_LOGIN_SELECTORS) {
      const loc = page.locator(sel);
      if (await loc.first().isVisible().catch(() => false)) {
        loggedIn = true;
        break;
      }
    }
    if (!loggedIn) await page.waitForTimeout(250);
  }

  // If still not logged in, check for an error message on the login form
  if (!loggedIn) {
    const errorToast = page.getByText(/invalid|error|wrong|failed/i);
    const stillOnSubmit = await submit.isVisible().catch(() => false);
    if (await errorToast.count()) {
      await page.screenshot({ path: 'tests-artifacts/01-after-login.png', fullPage: true });
      throw new Error('Login failed (error message visible). Check TEST_EMAIL / TEST_PASSWORD.');
    }
    if (stillOnSubmit) {
      await page.screenshot({ path: 'tests-artifacts/01-after-login.png', fullPage: true });
      throw new Error('Still on the login form after clicking Sign in — credentials may be wrong.');
    }
  }

  // Small settle to let UI render fully (no networkidle)
  await page.waitForTimeout(1200);

  // 5) Screenshot AFTER LOGIN (proof step 2)
  await page.screenshot({ path: 'tests-artifacts/01-after-login.png', fullPage: true });

  // 6) Save session for the rest of the suite
  await page.context().storageState({ path: 'tests-artifacts/storageState.json' });
});
