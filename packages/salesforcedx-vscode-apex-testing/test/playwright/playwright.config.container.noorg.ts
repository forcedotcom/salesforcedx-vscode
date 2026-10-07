/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig } from '@playwright/test';
import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

// Separate testDir from the standard container suite: this spec requires the NO-ORG boot shape (the
// standard DX project open but no org authenticated), which the orchestrator sets up in a distinct
// final phase (re-boot the container org-less + re-swap + restart). Restricting testMatch to just
// noOrgVisibility.headless.spec.ts means it never runs against the org-authed phase (where its
// "org-gated commands hidden" assertions would fail because the org IS connected).
const baseConfig = createContainerConfig({ testDir: './specs' });
const chromiumProject = baseConfig.projects?.[0];

export default defineConfig({
  ...baseConfig,
  projects: chromiumProject ? [{ ...chromiumProject, testMatch: ['noOrgVisibility.headless.spec.ts'] }] : []
});
