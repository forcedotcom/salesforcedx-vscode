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
          // Remaining container-only specs: coreOutputChannel (real behavioral differences — the
          // container's full extension set changes which initializeMetadataSupport branch fires,
          // and it skips the desktop-only activation-gate command), seededWorkspace (no headless
          // twin), and workspaceContextOrgSwitch (a production-command proxy for an API the
          // container's extension set can't load a test fixture for — see its own header comment).
          // configList is unified with desktop — it branches on `isContainer` from ../fixtures
          // instead of a dedicated *.container.spec.ts file.
          testMatch: ['container/**/*.container.spec.ts', 'configList.headless.spec.ts']
        }
      ]
    : []
});
