/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig } from '@playwright/test';
import { createDesktopConfig } from '@salesforce/playwright-vscode-ext';

const serializedSpecs = [
  '**/traceFlagsCrud.headless.spec.ts',
  '**/traceFlagsForOtherUser.headless.spec.ts',
  '**/logRetrieval.headless.spec.ts'
];

const baseConfig = createDesktopConfig();
const desktopProject = baseConfig.projects?.[0];

export default defineConfig({
  ...baseConfig,
  projects: desktopProject
    ? [
        {
          ...desktopProject,
          name: 'desktop-electron',
          testIgnore: serializedSpecs
        },
        // these depend on exclusive access to org trace flags so they can't run in parallel
        {
          ...desktopProject,
          name: 'desktop-electron-serialized-trace',
          testMatch: serializedSpecs,
          workers: 1,
          fullyParallel: false
        }
      ]
    : []
});
