/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  detectWorkspaceHelper as detectWorkspaceHelperCore,
  LspFileSystemAccessor,
  type WorkspaceType
} from '@salesforce/salesforcedx-lightning-lsp-common';

const toLspFs = (accessor: LspFileSystemAccessor) => ({
  fileExists: (filePath: string): Promise<boolean> => accessor.fileExists(filePath),
  readFileContent: (filePath: string): Promise<string | undefined> => accessor.getFileContent(filePath)
});

export const detectWorkspaceHelper = (
  root: string,
  fileSystemAccessor: LspFileSystemAccessor
): Promise<WorkspaceType> => detectWorkspaceHelperCore(root, toLspFs(fileSystemAccessor));
