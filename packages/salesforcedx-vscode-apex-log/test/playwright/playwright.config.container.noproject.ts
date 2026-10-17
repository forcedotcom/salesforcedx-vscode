/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

// Separate testDir from the standard container suite: these specs require the NON-project workspace
// shape (no sfdx-project.json open), which the orchestrator sets up in a distinct phase (re-seed
// coder.json to the container-noproject mount + restart). Keeping them out of ./specs/container means
// they never run against the DX-project phase (where their "commands hidden" assertions would fail).
export default createContainerConfig({ testDir: './specs/container-noproject' });
