/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AnyJson } from '@salesforce/ts-types';

/**
 * Method to save a file on disk.
 *
 * @param filePath path where to
 * @param fileContent file contents
 */
export function createFile(filePath: string, fileContent: AnyJson): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.closeSync(fs.openSync(filePath, 'w'));

  const writeStream = fs.createWriteStream(filePath);
  writeStream.write(fileContent);
}
