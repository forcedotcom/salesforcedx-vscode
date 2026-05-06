/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Jest on macOS resolves symlinks so workspace paths under /var/folders appear
// as /private/var/folders. Strip the /private prefix so URIs match VS Code's view.
export const normalizeJestFsPath = (fsPath: string): string =>
  process.platform === 'darwin' ? fsPath.replace(/^\/private\//, '/') : fsPath;
