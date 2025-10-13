import { test as base, expect } from '@playwright/test';
import fs from 'fs';

const statePath = 'tests-artifacts/storageState.json';

// Conditionally load storage state if it already exists
if (fs.existsSync(statePath)) {
  base.use({ storageState: statePath });
}

export const test = base;
export { expect };
