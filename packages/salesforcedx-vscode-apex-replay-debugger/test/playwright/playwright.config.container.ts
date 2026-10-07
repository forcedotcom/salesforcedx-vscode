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
          // promptForLogFile stays a separate twin: desktop writes launch.json via workspaceDir (no
          // host fs access in the container), so it reads a pre-seeded fixture file instead. The rest
          // are unified with desktop — they branch on `isContainer` from ../fixtures instead of
          // duplicating a *.container.spec.ts file.
          testMatch: [
            'container/promptForLogFile.container.spec.ts',
            'apexReplayDebugger.desktop.spec.ts',
            'apexReplayDebuggerVariables.desktop.spec.ts',
            'checkpoints.desktop.spec.ts',
            'debugAnonymousApex.desktop.spec.ts',
            'debugApexTests.desktop.spec.ts',
            'errorPaths.desktop.spec.ts'
          ]
        }
      ]
    : []
});
