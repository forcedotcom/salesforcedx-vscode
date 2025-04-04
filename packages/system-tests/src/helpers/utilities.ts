/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 * Derived from https://github.com/Microsoft/vscode/blob/master/test/smoke/src/helpers/utilities.ts
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';

/**
 * Contains methods that are commonly used across test areas.
 */
export class Util {
  constructor() {
    // noop
  }

  public removeFile(filePath: string): void {
    try {
      fs.unlinkSync(`${filePath}`);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  }

  public rimraf(directory: string): Promise<void> {
    return fsPromises.rm(directory, { recursive: true, force: true });
  }
}

export function sanitize(name: string): string {
  return name.replace(/[&*:\/]/g, '');
}
