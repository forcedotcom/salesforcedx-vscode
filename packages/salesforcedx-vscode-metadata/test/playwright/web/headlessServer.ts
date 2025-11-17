/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createHeadlessServer, setupSignalHandlers } from 'salesforcedx-vscode-playwright';

setupSignalHandlers();

if (require.main === module) {
  void createHeadlessServer({ extensionName: 'Metadata' });
}
