/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Jest on macOS resolves symlinks so workspace paths under /var/folders appear
// as /private/var/folders. Strip the /private prefix so URIs match VS Code's view.
// Also normalize /users/ to /Users/ case mismatch that can occur in stack traces.
export const normalizeJestFsPath = (fsPath: string): string => {
  if (process.platform !== 'darwin') {
    return fsPath;
  }
  return fsPath.replace(/^\/private\//, '/').replace(/^\/users\//, '/Users/');
};
