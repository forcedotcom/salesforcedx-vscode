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
            'lwcCustomComponentsIndex.headless.spec.ts',
            'lwcGenerateComponent.headless.spec.ts',
            'lwcLspAutocompletion.headless.spec.ts',
            'lwcLspGoToDefinitionHtml.headless.spec.ts',
            'lwcLspGoToDefinitionJs.headless.spec.ts',
            'lwcLspHover.headless.spec.ts',
            'lwcLspIndexing.headless.spec.ts',
            'lwcLspSfdxTypings.headless.spec.ts',
            'lwcRename.headless.spec.ts',
            'lwcSnippets.headless.spec.ts'
          ]
        }
      ]
    : []
});
