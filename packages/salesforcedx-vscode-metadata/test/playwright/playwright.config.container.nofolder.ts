/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

// A THIRD workspace shape, distinct from ./specs/container (DX project) and ./specs/container-noproject
// (a non-project folder): these specs need NO folder open at all. The orchestrator re-seeds coder.json
// to an empty query (no folder key) + restarts in a distinct phase (test:container:nofolder). Keeping
// them out of the other testDirs means they never run against a shape where a folder is open.
export default createContainerConfig({ testDir: './specs/container-nofolder' });
