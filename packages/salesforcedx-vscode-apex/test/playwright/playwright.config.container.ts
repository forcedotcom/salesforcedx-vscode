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
          // All four are unified with desktop — they branch on `isContainer` from ../fixtures instead
          // of a dedicated *.container.spec.ts file. apexLspRestart keeps its clean-DB disk checks by
          // reading the host side of the fixture bind mount (sharedWorkspaceDirTest).
          testMatch: [
            'apexLspRestart.desktop.spec.ts',
            'apexLsp.desktop.spec.ts',
            'apexLspHover.desktop.spec.ts',
            'apexSnippets.desktop.spec.ts'
          ]
        }
      ]
    : []
});
