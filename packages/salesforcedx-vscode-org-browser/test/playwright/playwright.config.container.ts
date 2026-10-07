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
          // orgBrowser (no twin), orgBrowserCustomObject/CustomTab/FolderedReport, and
          // orgBrowserTextFilterDreamhouse stay separate: each either has no desktop twin, or drops
          // the desktop twin's retrieve/overwrite/editor-open coverage in favor of switching the
          // shared session's default org to an out-of-band Dreamhouse org (a genuinely different,
          // no-desktop-equivalent mechanism) — not just a setup/screenshot difference. The rest are
          // unified with desktop — they branch on `isContainer` from ../fixtures instead of
          // duplicating a *.container.spec.ts file.
          testMatch: [
            'container/orgBrowser.container.spec.ts',
            'container/orgBrowserCustomObject.container.spec.ts',
            'container/orgBrowserCustomTab.container.spec.ts',
            'container/orgBrowserFolderedReport.container.spec.ts',
            'container/orgBrowserTextFilterDreamhouse.container.spec.ts',
            'orgBrowser.describe.scratch.spec.ts',
            'orgBrowser.filterToggle.headless.spec.ts',
            'orgBrowser.textFilter.headless.spec.ts'
          ]
        }
      ]
    : []
});
