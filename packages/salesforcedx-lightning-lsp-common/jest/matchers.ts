/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isAbsolute } from 'node:path';
import * as vscode from 'vscode';

declare global {
  namespace jest {
    interface Matchers<R> {
      toExist(): R;
      toBeAbsolutePath(): R;
      toEndWith(suffix: string): R;
    }
  }
}

expect.extend({
  toExist: async (path: string) => {
    let pass: boolean;
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(path));
      pass = true;
    } catch {
      pass = false;
    }
    return pass
      ? { message: () => `expected ${path} not to exist`, pass: true }
      : { message: () => `expected ${path} to exist`, pass: false };
  },
  toBeAbsolutePath: (path: string) => {
    const pass = isAbsolute(path);
    return pass
      ? { message: () => `expected ${path} not to be absolute`, pass: true }
      : { message: () => `expected ${path} to be absolute`, pass: false };
  },
  toEndWith: (path: string, suffix: string) => {
    const pass = path.endsWith(suffix);
    return pass
      ? { message: () => `expected ${path} not to end with ${suffix}`, pass: true }
      : { message: () => `expected ${path} to end with ${suffix}`, pass: false };
  }
});
