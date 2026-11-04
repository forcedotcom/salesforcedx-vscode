/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

export default createContainerConfig({
  testDir: './specs',
  testMatch: [
    'apexTestSuite.headless.spec.ts',
    'apexTestSuiteDelete.headless.spec.ts',
    'clearApexTestResults.headless.spec.ts',
    'codeCoverageColorizer.headless.spec.ts',
    'inWorkspaceFilter.headless.spec.ts',
    'orgOnlyClassRetrieve.headless.spec.ts',
    'runApexTestsCodeLens.headless.spec.ts',
    'runApexTestsCommandPalette.headless.spec.ts',
    'runApexTestsFailAndFix.headless.spec.ts',
    'staleTestResultsRestoration.headless.spec.ts',
    'testExplorer.headless.spec.ts'
  ]
});
