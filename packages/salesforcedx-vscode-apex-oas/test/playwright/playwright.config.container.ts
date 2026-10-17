/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

export default createContainerConfig({
  testDir: './specs',
  // ineligibleClass stays a dedicated container twin: it relies on the pre-seeded
  // PagedResult.cls fixture class (no org push needed), a genuinely different mechanism
  // from the headless twin's dynamically-created-and-pushed class. mixedFrameworksClass and
  // restResourceNoHttpMethod are unified with desktop — they branch on `isContainer` from
  // ../fixtures instead of a dedicated *.container.spec.ts file.
  testMatch: [
    'container/ineligibleClass.container.spec.ts',
    'mixedFrameworksClass.headless.spec.ts',
    'restResourceNoHttpMethod.headless.spec.ts'
  ]
});
