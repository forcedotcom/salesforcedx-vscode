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
          testMatch: [
            'container/testExplorer.container.spec.ts',
            'container/testExplorerRun.container.spec.ts',
            'container/inWorkspaceFilter.container.spec.ts',
            'container/orgOnlyClassRetrieve.container.spec.ts',
            'apexTestSuite.headless.spec.ts',
            'apexTestSuiteDelete.headless.spec.ts',
            'clearApexTestResults.headless.spec.ts',
            'codeCoverageColorizer.headless.spec.ts',
            'runApexTestsCodeLens.headless.spec.ts',
            'runApexTestsCommandPalette.headless.spec.ts',
            'runApexTestsFailAndFix.headless.spec.ts',
            'staleTestResultsRestoration.headless.spec.ts'
          ]
        }
      ]
    : []
});
