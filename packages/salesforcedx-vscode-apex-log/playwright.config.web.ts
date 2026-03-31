/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig } from '@playwright/test';
import { createWebConfig } from '@salesforce/playwright-vscode-ext';

const serializedSpecs = [
  '**/traceFlagsCrud.headless.spec.ts',
  '**/traceFlagsForOtherUser.headless.spec.ts',
  '**/logRetrieval.headless.spec.ts'
];

const baseConfig = createWebConfig();
const chromiumProject = baseConfig.projects?.[0];

export default defineConfig({
  ...baseConfig,
  projects: chromiumProject
    ? [
        {
          ...chromiumProject,
          name: 'chromium',
          testIgnore: serializedSpecs
        },
        {
          ...chromiumProject,
          name: 'chromium-serialized-trace',
          testMatch: serializedSpecs,
          workers: 1,
          fullyParallel: false
        }
      ]
    : []
});
