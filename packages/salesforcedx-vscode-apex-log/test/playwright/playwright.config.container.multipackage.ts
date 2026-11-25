/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

// A workspace shape distinct from the dx-project phase (single-package DX project) and
// ./specs/container-noproject (a non-project folder): these specs need a multi-`packageDirectories`
// project open so the output-directory picker lists BOTH package dirs' `classes` folders. The
// orchestrator re-seeds coder.json to the container-multipackage mount + restarts in a distinct phase
// (test:container:multipackage). The specs are shared with desktop (they branch on `isContainer`); the
// dx-project config's testMatch leaves them out so they never run against a single-package shape where
// the "both dirs appear" assertion would fail.
export default createContainerConfig({
  testDir: './specs',
  testMatch: ['apexGenerateClassMultiPackageDirs.headless.spec.ts']
});
