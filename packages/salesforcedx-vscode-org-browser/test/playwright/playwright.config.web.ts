/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig } from '@playwright/test';
import { createWebConfig } from '@salesforce/playwright-vscode-ext';

// Also ignore container specs: this per-package testIgnore overrides createWebConfig's, so it must
// re-list the container exclusion or web would run *.container.spec.ts (which need code-server).
export default defineConfig({
  ...createWebConfig({ testDir: './specs' }),
  testIgnore: ['**/*.desktop.spec.ts', '**/*.container.spec.ts']
});
