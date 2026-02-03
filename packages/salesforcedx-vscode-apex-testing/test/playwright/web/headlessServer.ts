/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createHeadlessServer, setupSignalHandlers } from '@salesforce/playwright-vscode-ext';

if (require.main === module) {
  void createHeadlessServer({ extensionName: 'Apex Testing', callerDirname: __dirname });
  setupSignalHandlers();
}
