/*
 * Copyright (c) 2026, salesforce.com, inc.
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

const baseConfig = createWebConfig({ testDir: './specs' });
const chromiumProject = baseConfig.projects?.[0];

export default defineConfig({
  ...baseConfig,
  projects: chromiumProject
    ? [
        {
          ...chromiumProject,
          name: 'chromium',
          // container specs are code-server-only; exclude them here too (project testIgnore overrides
          // the factory's). Kept separate from serializedSpecs, which is reused as testMatch below.
          testIgnore: [...serializedSpecs, '**/*.container.spec.ts']
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
