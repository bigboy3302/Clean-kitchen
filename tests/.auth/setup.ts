import { test as setup, expect } from '@playwright/test';

setup('ensure storageState exists', async ({ page }) => {
  // If storageState is missing, log in once by importing the login test or doing a quick inline login.
  // For now we only rely on the login.spec.ts run to generate it.
  await page.context().tracing.stop(); // no-op; placeholder
});
