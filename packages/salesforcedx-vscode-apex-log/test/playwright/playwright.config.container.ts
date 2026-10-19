/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

export default createContainerConfig({
  testDir: './specs',
  // Every spec here is unified with desktop/web — it branches on `isContainer` from ../fixtures
  // instead of duplicating a *.container.spec.ts file. (The container-noorg/-noproject/-multipackage
  // specs need the re-seeded workspace shape from their own phase config.)
  testMatch: [
    'apexGenerateClass.headless.spec.ts',
    'apexTestClassCreate.headless.spec.ts',
    'autoCollection.headless.spec.ts',
    'createApexTrigger.headless.spec.ts',
    'executeAnonymous.headless.spec.ts',
    'logRetrieval.headless.spec.ts',
    'traceFlagExpiry.headless.spec.ts',
    'traceFlagsCrud.headless.spec.ts'
  ]
});
