/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { WorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common';

// Conditionally export the appropriate language client based on platform
// Use dynamic imports to avoid bundling Node.js-specific code in web mode
export const createLanguageClient = async (
  serverPath: string,
  initializationOptions: { workspaceType: WorkspaceType }
) => {
  if (process.env.ESBUILD_PLATFORM === 'web') {
    const { createLanguageClient: createWebLanguageClient } = await import('./web.js');
    return createWebLanguageClient(serverPath, initializationOptions);
  } else {
    const { createLanguageClient: createNodeLanguageClient } = await import('./node.js');
    return createNodeLanguageClient(serverPath, initializationOptions);
  }
};
