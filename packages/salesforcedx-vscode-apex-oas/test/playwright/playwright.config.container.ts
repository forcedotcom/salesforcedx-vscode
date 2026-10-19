/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

export default createContainerConfig({
  testDir: './specs',
  // Unified with desktop — these branch on `isContainer` from ../fixtures/oasSharedTest instead of a
  // dedicated *.container.spec.ts file. The other specs need the A4V LLM service, so they stay out.
  testMatch: [
    'ineligibleClass.headless.spec.ts',
    'mixedFrameworksClass.headless.spec.ts',
    'restResourceNoHttpMethod.headless.spec.ts'
  ]
});
