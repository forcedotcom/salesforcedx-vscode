/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createContainerConfig } from '@salesforce/playwright-vscode-ext';

export default createContainerConfig({
  testDir: './specs',
  // Unified with desktop — these branch on `isContainer` from ../fixtures instead of duplicating a
  // *.container.spec.ts file.
  testMatch: [
    'apexReplayDebugger.desktop.spec.ts',
    'apexReplayDebuggerVariables.desktop.spec.ts',
    'checkpoints.desktop.spec.ts',
    'debugAnonymousApex.desktop.spec.ts',
    'debugApexTests.desktop.spec.ts',
    'errorPaths.desktop.spec.ts',
    'promptForLogFile.desktop.spec.ts'
  ]
});
