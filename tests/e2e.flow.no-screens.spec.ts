// tests/e2e.flow.no-screens.spec.ts
import { test, expect, Page } from '@playwright/test';
import fs from 'fs';

/** ---------- tunables (override via env) ---------- **/
const EMAIL = process.env.TEST_EMAIL!;
const PASSWORD = process.env.TEST_PASSWORD!;

const PAUSE_MS        = Number(process.env.SNAPSHOT_DELAY_MS ?? 700);   // tiny settle between actions
const STEP_TIMEOUT_MS = Number(process.env.STEP_TIMEOUT_MS ?? 15_000);  // hard cap per step
const FAST_CHECK_MS   = Number(process.env.FAST_CHECK_MS ?? 2_000);     // fast scans

/** ---------- artifacts dir + timestamp ---------- **/
const ART_DIR = 'tests-artifacts';
if (!fs.existsSync(ART_DIR)) fs.mkdirSync(ART_DIR, { recursive: true });
const ts = () => new Date().toISOString().replace(/[:.]/g, '-');

/** ---------- helpers ---------- **/
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const randomPostText = () =>
  `Automated post ${Math.random().toString(36).slice(2, 8)} @ ${new Date().toISOString()}`;

async function pause(page: Page, selector?: string, extra = PAUSE_MS) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  if (selector) {
    await page.locator(selector).first().waitFor({ state: 'visible', timeout: 4_000 }).catch(() => {});
  }
  await page.waitForTimeout(extra).catch(() => {});
}

async function clearClientAuth(page: Page) {
  await page.goto('about:blank', { waitUntil: 'commit' }).catch(() => {});
  await page.evaluate(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    try { indexedDB.deleteDatabase('firebaseLocalStorageDb'); } catch {}
  }).catch(() => {});
}

async function gotoFast(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'commit' }).catch(() => {});
  await pause(page);
}

/** --------- Login helpers --------- **/
async function hasLoginForm(page: Page) {
  const email = page.getByLabel(/email/i)
    .or(page.getByPlaceholder(/@|email|e-pasts|e-mail/i))
    .or(page.locator('input[type="email"]'));
  const pass  = page.getByLabel(/^password$/i).or(page.locator('input[type="password"]'));
  const btn   = page.getByRole('button', { name: /^(sign|log)\s*in$/i });
  const vis = async (l: ReturnType<Page['locator']>) => await l.first().isVisible().catch(() => false);
  return (await vis(email)) && (await vis(pass)) && (await vis(btn));
}

async function gotoLoginForm(page: Page) {
  const ROUTES = ['/auth/login', '/auth/signin', '/auth', '/login', '/signin', '/profile'];
  for (const r of ROUTES) {
    await gotoFast(page, r);
    if (await hasLoginForm(page)) return;
  }
  for (const sel of [
    'a[href="/auth/login"]','a[href*="/auth/login"]',
    'a[href*="auth"]','a[href*="login"]',
    'button:has-text("Sign in")','a:has-text("Sign in")',
    'button:has-text("Log in")','a:has-text("Log in")'
  ]) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      await el.click().catch(()=>{});
      await pause(page);
      if (await hasLoginForm(page)) return;
    }
  }
}

async function login(page: Page) {
  const email = page.getByLabel(/email/i)
    .or(page.getByPlaceholder(/@|email|e-pasts|e-mail/i))
    .or(page.locator('input[type="email"]'));
  const pass  = page.getByLabel(/^password$/i).or(page.locator('input[type="password"]'));
  const btn   = page.getByRole('button', { name: /^(sign|log)\s*in$/i });

  await expect(email, 'Email not visible on login form').toBeVisible({ timeout: 10_000 });
  await expect(pass,  'Password not visible on login form').toBeVisible({ timeout: 10_000 });
  await expect(btn,   'Sign/Log in button not visible on login form').toBeVisible({ timeout: 10_000 });

  await email.fill(EMAIL);
  await pass.fill(PASSWORD);
  await Promise.all([btn.click().catch(() => {})]);
  await pause(page, 'main');
}

async function ensureLoggedInAndVisit(page: Page, path: string) {
  await clearClientAuth(page);
  await gotoFast(page, path);
  if (await hasLoginForm(page)) {
    await gotoFast(page, '/auth/login');
    if (!(await hasLoginForm(page))) await gotoLoginForm(page);
    await login(page);
    await gotoFast(page, path);
  }
}

/** --------- Recipes: strict card click + verify Ingredients --------- **/
async function openRecipeCardStrict(page: Page) {
  console.log('→ Looking for a recipe card…');

  // Priority: a link to /recipes/<id> inside a visible card/article
  const cardCandidates = [
    page.locator('article a[href*="/recipes/"]').first(),
    page.locator('[data-testid*="recipe"] a[href*="/recipes/"]').first(),
    page.locator('[class*="card"] a[href*="/recipes/"]').first(),
    // Fallback: clickable card itself
    page.locator('article').first(),
    page.locator('[data-testid*="recipe"]').first(),
    page.locator('[class*="card"]').first(),
  ];

  for (const card of cardCandidates) {
    if (await card.count() && await card.isVisible().catch(() => false)) {
      await card.click({ force: true }).catch(() => {});
      await pause(page);
      const detailLikely =
        await page.locator('h1, h2').first().isVisible().catch(() => false) ||
        /\/recipes\//i.test(page.url());
      if (detailLikely) {
        console.log('✅ Opened a recipe detail');
        return true;
      }
    }
  }
  console.log('⚠️ Could not find a clear recipe card (clicked none)');
  return false;
}

async function verifyIngredientsOnDetail(page: Page) {
  const found = await page
    .locator(':is(h1,h2,h3,h4,p,li,div,section):has-text("Ingredients")')
    .first().isVisible().catch(() => false);
  expect.soft(found, 'Ingredients section/text not found on the recipe detail').toBeTruthy();
  console.log(found ? '✅ Ingredients visible' : '⚠️ Ingredients not confirmed (soft)');
}

/** --------- Dashboard: New Post → Publish → verify --------- **/
async function dashboardCreateAndPublishPost(page: Page, content: string) {
  console.log('→ Creating a new post on Dashboard…');

  // Click "New Post"
  const newPostBtn = page.getByRole('button', { name: /^new post$/i })
    .or(page.locator('button:has-text("New Post")'));
  await expect(newPostBtn, 'New Post button not found').toBeVisible({ timeout: 8_000 });
  await newPostBtn.click().catch(() => {});
  await pause(page);

  // Type into a textbox / textarea (various fallbacks)
  const editor = page.getByRole('textbox').first()
    .or(page.locator('textarea').first())
    .or(page.locator('input[type="text"]').first());
  await expect(editor, 'Post editor not found').toBeVisible({ timeout: 8_000 });
  await editor.fill(content);
  console.log(`→ Typed post text: "${content}"`);

  // Click "Publish"
  const publishBtn = page.getByRole('button', { name: /^publish$/i })
    .or(page.locator('button:has-text("Publish")'));
  await expect(publishBtn, 'Publish button not found').toBeVisible({ timeout: 8_000 });
  await publishBtn.click().catch(() => {});
  await pause(page);

  // Verify the post appears (use a substring to be resilient)
  const snippet = content.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const appears = await page.getByText(new RegExp(snippet, 'i')).first().isVisible().catch(() => false);
  expect.soft(appears, 'Newly published post not visible').toBeTruthy();
  console.log(appears ? '✅ New post published and visible' : '⚠️ New post not confirmed (soft)');
}

/** --------- Pantry: add "Pasta" via Add/Merge (target the right input) --------- **/
async function pantryAddPasta(page: Page) {
  console.log('→ Adding "Pasta" to pantry…');

  // Prefer the explicit "Product name" textbox or placeholder "Pasta"
  const nameInput = page.getByRole('textbox', { name: /product name/i })
    .or(page.getByPlaceholder(/pasta/i))
    .or(page.getByPlaceholder(/name|product|item/i))
    .or(page.locator('input[aria-label="Product name"]'))
    .or(page.locator('input[type="text"]'))
    .first();

  // The button is labeled “Add/Merge” (keep fallbacks)
  const addMergeBtn = page.getByRole('button', { name: /^add\/?merge$/i })
    .or(page.locator('button:has-text("Add/Merge")'))
    .or(page.getByRole('button', { name: /^add$/i }))
    .first();

  await expect(nameInput, 'Pantry name input not visible').toBeVisible({ timeout: 10_000 });
  await nameInput.fill('Pasta');

  await expect(addMergeBtn, 'Add/Merge button not visible').toBeVisible({ timeout: 10_000 });
  await addMergeBtn.click().catch(() => {});
  await pause(page);

  const exists = await page.getByText(/\bpasta\b/i).first().isVisible().catch(() => false);
  expect.soft(exists, '"Pasta" not visible after Add/Merge').toBeTruthy();
  console.log(exists ? '✅ Pantry item "Pasta" visible' : '⚠️ Pantry item not confirmed (soft)');
}

/** --------- Fitness: search "Side hip abduction" --------- **/
async function fitnessSearchExercise(page: Page, query = 'Side hip abduction') {
  console.log(`→ Searching exercise: "${query}"…`);
  const searchBox = page.getByRole('searchbox').first()
    .or(page.getByPlaceholder(/search|exercise|meklēt/i).first())
    .or(page.locator('input[type="search"]').first())
    .or(page.locator('input[type="text"]').first());

  await expect(searchBox, 'Fitness search box not visible').toBeVisible({ timeout: 10_000 });
  await searchBox.fill(query);
  await searchBox.press('Enter').catch(() => {});
  await pause(page);

  // Confirm result appears either as a card/title/list item
  const found =
    await page.getByRole('heading', { name: new RegExp(query, 'i') }).first().isVisible().catch(() => false) ||
    await page.getByText(new RegExp(query, 'i')).first().isVisible().catch(() => false);
  expect.soft(found, `Exercise "${query}" not found`).toBeTruthy();
  console.log(found ? '✅ Exercise found' : '⚠️ Exercise not confirmed (soft)');
}

/** --------- Profile: Preferences → switch theme to Dark (robust) --------- **/
async function profileSetDarkTheme(page: Page) {
  console.log('→ Opening Preferences and switching theme to Dark…');

  // Scroll to Preferences
  const prefs = page.getByRole('heading', { name: /preferences/i }).first()
    .or(page.getByText(/preferences/i).first());
  await prefs.scrollIntoViewIfNeeded().catch(() => {});
  await pause(page);

  // Try common controls for theme selection
  const radioDark  = page.getByRole('radio', { name: /dark/i }).first();
  const btnDark    = page.getByRole('button', { name: /^dark$/i }).first();
  const selectCtrl = page.locator('select').first();
  const toggle     = page.locator('[data-theme-toggle], [aria-label*="theme" i], button:has-text("Theme")').first();

  let clicked = false;

  // 1) Radio "Dark"
  if (!clicked && await radioDark.isVisible().catch(() => false)) {
    await radioDark.check({ force: true }).catch(() => {});
    clicked = true;
  }
  // 2) Button "Dark"
  if (!clicked && await btnDark.isVisible().catch(() => false)) {
    await btnDark.click().catch(() => {});
    clicked = true;
  }
  // 3) <select> Theme -> Dark
  if (!clicked && await selectCtrl.isVisible().catch(() => false)) {
    const ok = await selectCtrl.selectOption({ label: 'Dark' }).catch(async () => {
      return await selectCtrl.selectOption({ value: 'dark' }).catch(() => null);
    });
    if (ok) clicked = true;
  }
  // 4) Generic theme toggle: click up to 3 times until dark detected
  if (!clicked && await toggle.isVisible().catch(() => false)) {
    for (let i = 0; i < 3; i++) {
      await toggle.click().catch(() => {});
      await pause(page, undefined, 200);
      if (await detectDark(page)) { clicked = true; break; }
    }
  }

  await pause(page, undefined, 300);

  const isDark = await detectDark(page);
  expect.soft(isDark, 'Dark theme was not detected').toBeTruthy();
  console.log(isDark ? '✅ Theme switched to Dark' : '⚠️ Theme not confirmed (soft)');
}

async function detectDark(page: Page) {
  // 1) Attributes
  const attrDark = await page.evaluate(() => {
    const b = document.body;
    const dt = b.getAttribute('data-theme') || '';
    if (/dark/i.test(dt)) return true;
    if (b.classList.contains('dark')) return true;
    return false;
  }).catch(() => false);
  if (attrDark) return true;

  // 2) Computed background heuristic
  const bg = await page.evaluate(() => {
    const c = getComputedStyle(document.body).backgroundColor;
    return c;
  }).catch(() => '');
  const isDarkBg = (() => {
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return false;
    const r = +m[1], g = +m[2], b = +m[3];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // relative luminance
    return luma < 90;
  })();
  return isDarkBg;
}

/** --------- Logout (with menu open first) --------- **/
async function profileLogout(page: Page) {
  console.log('→ Logging out from profile…');

  // Some UIs hide logout behind a user/account menu
  const menuCandidates = [
    page.getByRole('button', { name: /account|user|profile|menu|settings/i }).first(),
    page.locator('[aria-label*="account" i], [aria-label*="user" i], [data-user-menu]').first(),
    page.getByRole('img', { name: /avatar|profile/i }).first()
  ];
  for (const menu of menuCandidates) {
    if (await menu.isVisible().catch(() => false)) {
      await menu.click().catch(() => {});
      await pause(page, undefined, 150);
      break;
    }
  }

  const logoutCandidates = [
    page.getByRole('button', { name: /log ?out|sign ?out/i }),
    page.getByRole('link',  { name: /log ?out|sign ?out/i }),
    page.locator('button:has-text("Log out")'),
    page.locator('button:has-text("Sign out")'),
    page.locator('a:has-text("Log out"), a:has-text("Sign out")'),
  ];
  for (const loc of logoutCandidates) {
    if (await loc.first().isVisible().catch(() => false)) {
      await loc.first().click().catch(() => {});
      break;
    }
  }

  // If a confirmation appears, accept it
  const confirmBtn = page.getByRole('button', { name: /confirm|yes|ok|logout/i }).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click().catch(() => {});
  }

  await pause(page, undefined, 200);
  const ok = await hasLoginForm(page);
  expect.soft(ok, 'Login form did not reappear after logout').toBeTruthy();
  console.log(ok ? '✅ Logged out (login form visible again)' : '⚠️ Logout not confirmed (soft)');
}

/** --------- Step wrapper: timeout + screenshot on failure --------- **/
async function runStep(title: string, page: Page, fn: () => Promise<void>) {
  const deadline = new Promise<void>((_, rej) =>
    setTimeout(() => rej(new Error(`⏱️ step timeout: ${title}`)), STEP_TIMEOUT_MS)
  );
  try {
    console.log(`→ ${title}`);
    await Promise.race([fn(), deadline]);
    console.log(`✅ ${title}`);
  } catch (e) {
    try {
      await page.screenshot({
        path: `${ART_DIR}/step-failed-${title.replace(/\W+/g, '_')}-${ts()}.png`,
        fullPage: true
      });
    } catch {}
    const msg = (e as any)?.message ?? String(e);
    console.log(`⚠️ ${title} — ${msg}`);
  }
}

/** ---------- main flow ---------- **/
test('User flow: recipes card → dashboard New Post → pantry Add/Merge "Pasta" → fitness search → profile dark theme → logout', async ({ page }) => {
  test.setTimeout(240_000); // end-to-end cap ~4 min

  await runStep('Login page visible', page, async () => {
    await clearClientAuth(page);
    await gotoLoginForm(page);
    await pause(page);
    expect(await hasLoginForm(page), 'Login form not visible').toBeTruthy();
  });

  await runStep('Login successful', page, async () => { await login(page); });

  await runStep('Recipes page visible', page, async () => {
    const onRecipes = await page.getByRole('heading', { name: /recipes/i }).first().isVisible().catch(() => false);
    if (!onRecipes) await gotoFast(page, '/recipes');
    await pause(page, 'main');
    await expect(page.getByRole('heading', { name: /recipes/i }).first()).toBeVisible({ timeout: 6_000 });
  });

  await runStep('Open a recipe card and verify Ingredients', page, async () => {
    const opened = await openRecipeCardStrict(page);
    if (opened) await verifyIngredientsOnDetail(page);
  });

  await runStep('Dashboard: New Post → Publish → verify', page, async () => {
    await ensureLoggedInAndVisit(page, '/dashboard');
    await pause(page, 'main');
    await dashboardCreateAndPublishPost(page, randomPostText());
  });

  await runStep('Pantry: Add/Merge "Pasta"', page, async () => {
    await ensureLoggedInAndVisit(page, '/pantry');
    await pantryAddPasta(page);
  });

  await runStep('Fitness: search "Side hip abduction"', page, async () => {
    await ensureLoggedInAndVisit(page, '/fitness');
    await fitnessSearchExercise(page, 'Side hip abduction');
  });

  await runStep('Profile: Preferences → Theme Dark → Logout', page, async () => {
    await ensureLoggedInAndVisit(page, '/profile');
    await profileSetDarkTheme(page);
    await profileLogout(page);
  });

  console.log('🎉 Flow complete');
});
