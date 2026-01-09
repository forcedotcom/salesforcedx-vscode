/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { WorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common';
import { createLanguageClient as createNodeLanguageClient } from './node';
import { createLanguageClient as createWebLanguageClient } from './web';

// Conditionally export the appropriate language client based on platform
export const createLanguageClient = (serverPath: string, initializationOptions: { workspaceType: WorkspaceType }) =>
  process.env.ESBUILD_PLATFORM === 'web'
    ? createWebLanguageClient(serverPath, initializationOptions)
    : createNodeLanguageClient(serverPath, initializationOptions);
