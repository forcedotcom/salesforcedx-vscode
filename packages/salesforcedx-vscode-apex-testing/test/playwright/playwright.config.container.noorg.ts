/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

// Separate testDir from the standard container suite: these specs require the NO-ORG boot shape (the
// standard DX project open but no org authenticated), which the orchestrator sets up in a distinct
// final phase (re-boot the container org-less + re-swap + restart). Keeping them out of ./specs/container
// means they never run against the org-authed phase (where their "org-gated commands hidden" assertions
// would fail because the org IS connected).
export default createContainerConfig({ testDir: './specs/container-noorg' });
