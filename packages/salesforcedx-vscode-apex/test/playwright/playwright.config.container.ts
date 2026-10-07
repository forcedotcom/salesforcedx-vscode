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
          // apexLspRestart stays a dedicated container twin: it drops the desktop matrix's clean-DB
          // variant entirely (needs disk access the container's browser-driven spec doesn't have)
          // and uses a fundamentally different no-op-restart detection mechanism (container latency
          // makes the desktop twin's transient-button check unreliable — see its own header comment).
          // apexLsp, apexLspHover, and apexSnippets are unified with desktop — they branch on
          // `isContainer` from ../fixtures instead of a dedicated *.container.spec.ts file.
          testMatch: [
            'container/apexLspRestart.container.spec.ts',
            'apexLsp.desktop.spec.ts',
            'apexLspHover.desktop.spec.ts',
            'apexSnippets.desktop.spec.ts'
          ]
        }
      ]
    : []
});
