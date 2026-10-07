/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig } from '@playwright/test';
import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

// Separate testDir from the standard container suite: this spec requires the NON-project workspace
// shape (no sfdx-project.json open), which the orchestrator sets up in a distinct phase (re-seed
// coder.json to the container-noproject mount + restart). Restricting testMatch to just
// noProjectVisibility.headless.spec.ts means it never runs against the DX-project phase (where its
// "commands hidden" assertions would fail).
const baseConfig = createContainerConfig({ testDir: './specs' });
const chromiumProject = baseConfig.projects?.[0];

export default defineConfig({
  ...baseConfig,
  projects: chromiumProject ? [{ ...chromiumProject, testMatch: ['noProjectVisibility.headless.spec.ts'] }] : []
});
