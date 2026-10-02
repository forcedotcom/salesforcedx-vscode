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
          // orgPicker and orgPickers stay separate twins: each exercises a genuinely different
          // scenario in container mode (multi-org-surfacing feasibility spike; reduced picker
          // coverage that omits the desktop twin's destructive real-logout steps), not just a
          // setup/screenshot difference. The rest are unified with desktop — they branch on
          // `isContainer` from ../fixtures instead of duplicating a *.container.spec.ts file.
          testMatch: [
            'container/orgPicker.container.spec.ts',
            'container/orgPickers.container.spec.ts',
            'aliasList.desktop.spec.ts',
            'orgCommands.desktop.spec.ts',
            'orgDeleteCommandVisibility.desktop.spec.ts',
            'orgDisplay.desktop.spec.ts',
            'orgLoginAccessToken.desktop.spec.ts',
            'orgOpen.desktop.spec.ts'
          ]
        }
      ]
    : []
});
