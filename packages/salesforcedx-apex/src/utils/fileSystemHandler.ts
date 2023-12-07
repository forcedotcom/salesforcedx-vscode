/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { AnyJson } from '@salesforce/ts-types';

export function ensureDirectoryExists(filePath: string): void {
  if (fs.existsSync(filePath)) {
    return;
  }
  ensureDirectoryExists(path.dirname(filePath));
  fs.mkdirSync(filePath);
}

export function ensureFileExists(filePath: string): void {
  ensureDirectoryExists(path.dirname(filePath));
  fs.closeSync(fs.openSync(filePath, 'w'));
}

/**
 * Method to save a file on disk.
 *
 * @param filePath path where to
 * @param fileContent file contents
 */
export function createFile(filePath: string, fileContent: AnyJson): void {
  ensureFileExists(filePath);

  const writeStream = fs.createWriteStream(filePath);
  writeStream.write(fileContent);
}

function streamPromise(stream: fs.WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('end', () => {
      resolve();
    });
    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Method to save multiple files on disk
 * @param fileMap key = filePath, value = file contents
 */
export async function createFiles(
  fileMap: { path: string; content: string }[]
): Promise<void> {
  const writePromises = fileMap.map((file) => {
    ensureFileExists(file.path);
    const writeStream = fs.createWriteStream(file.path);
    writeStream.write(file.content);
    return streamPromise(writeStream);
  });

  await Promise.all(writePromises);
}
