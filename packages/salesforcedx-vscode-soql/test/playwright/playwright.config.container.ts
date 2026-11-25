/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

export default createContainerConfig({
  testDir: './specs',
  // Both specs are unified with desktop/web — they branch on `isContainer` from ../fixtures
  // instead of a dedicated *.container.spec.ts file.
  testMatch: ['soql-run-query.spec.ts', 'soql-query-plan.spec.ts']
});
