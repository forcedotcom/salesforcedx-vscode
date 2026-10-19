/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

export default createContainerConfig({
  testDir: './specs',
  // Remaining container-only twins under specs/container/ (NOT container-noorg/-noproject/
  // -multipackage — those need the re-seeded workspace shape from their own phase config).
  // executeAnonymous stays a separate twin: it exercises a genuinely different scenario in
  // container mode (command-palette execution + marker round-trips vs CodeLens-driven flow), not
  // just a setup/screenshot difference.
  //
  // The rest are unified with desktop/web — they branch on `isContainer` from ../fixtures
  // instead of duplicating a *.container.spec.ts file.
  testMatch: [
    'container/**/*.container.spec.ts',
    'apexGenerateClass.headless.spec.ts',
    'apexTestClassCreate.headless.spec.ts',
    'autoCollection.headless.spec.ts',
    'createApexTrigger.headless.spec.ts',
    'logRetrieval.headless.spec.ts',
    'traceFlagExpiry.headless.spec.ts',
    'traceFlagsCrud.headless.spec.ts'
  ]
});
