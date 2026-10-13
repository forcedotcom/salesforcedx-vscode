/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createHeadlessServer, createTestWorkspace, setupSignalHandlers } from '@salesforce/playwright-vscode-ext';

import { seedOutlineWorkspace } from '../fixtures/outlineWorkspace';

const APEX_LANGUAGE_SERVER_EXTENSION_ID = 'salesforce.apex-language-server-extension';

const main = async (): Promise<void> => {
  const folderPath = await createTestWorkspace();
  await seedOutlineWorkspace(folderPath);
  await createHeadlessServer({
    extensionName: 'Apex',
    callerDirname: __dirname,
    skipExtensionDevelopmentPath: true,
    extensionIds: [{ id: APEX_LANGUAGE_SERVER_EXTENSION_ID }],
    folderPath
  });
};

if (require.main === module) {
  void main();
  setupSignalHandlers();
}
