/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig } from '@playwright/test';
import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

const baseConfig = createContainerConfig({ testDir: './specs' });
const chromiumProject = baseConfig.projects?.[0];

export default defineConfig({
  ...baseConfig,
  projects: chromiumProject
    ? [
        {
          ...chromiumProject,
          // debuggerStop is unified with desktop — it runs on `debuggerTest` from ../fixtures, which
          // resolves to desktopTest or containerTest by env, instead of a dedicated
          // *.container.spec.ts file. isvDebugBootstrap is desktop-only (native folder-picker
          // interaction) and has no container coverage.
          testMatch: ['debuggerStop.headless.spec.ts']
        }
      ]
    : []
});
