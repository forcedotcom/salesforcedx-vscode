/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

export default createContainerConfig({
  testDir: './specs',
  // All 4 Aura specs are unified with desktop — they branch on `isContainer` from
  // ../fixtures instead of a dedicated *.container.spec.ts file. spanRedaction and
  // telemetryOutput use their own dedicated (non-shared) desktop fixtures and have no
  // container coverage.
  testMatch: [
    'auraLspAutocompletion.desktop.spec.ts',
    'auraLspGoToDefinition.desktop.spec.ts',
    'auraRename.desktop.spec.ts',
    'auraTemplates.desktop.spec.ts'
  ]
});
