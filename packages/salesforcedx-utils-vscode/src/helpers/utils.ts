/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';

export function isNullOrUndefined(object: any): object is null | undefined {
  return object === null || object === undefined;
}

export function extractJsonObject(str: string): any {
  const jsonString = str.substring(str.indexOf('{'), str.lastIndexOf('}') + 1);

  return JSON.parse(jsonString);
}

// There's a bug in VS Code where, after a file has been renamed,
// the URI that VS Code passes to the command is stale and is the
// original URI.  See https://github.com/microsoft/vscode/issues/152993.
//
// To get around this, fs.realpathSync.native() is called to get the
// URI with the actual file name.
export function flushFilePath(filePath: string): string {
  // filePath is in the format of "/Users/{user-name}/{path-to-apex-file.cls}"
  if (filePath === '') {
    return filePath;
  }

  let nativePath = fs.realpathSync.native(filePath);
  if (/^win32/.test(process.platform)) {
    // The file path on Windows is in the form of "c:\Users\User Name\foo.cls".
    // When called, fs.realpathSync.native() is returning the file path back as
    // "C:\Users\User Name\foo.cls", and the capitalization of the drive letter
    // causes problems further down stream.  To fix this, we'll use the path
    // returned from fs.realpathSync.native() and then change the first character
    // to lower case.
    nativePath = nativePath.charAt(0).toLowerCase() + nativePath.slice(1);
  }

  return nativePath;
}

export function flushFilePaths(filePaths: string[]): string[] {
  for (let i = 0; i < filePaths.length; i++) {
    filePaths[i] = flushFilePath(filePaths[i]);
  }

  return filePaths;
}

export async function asyncFilter<T>(
  arr: T[],
  callback: (value: T, index: number, array: T[]) => unknown
) {
  const results = await Promise.all(arr.map(callback));

  return arr.filter((_v, index) => results[index]);
}

export const fileUtils = {
  flushFilePaths,
  flushFilePath,
  extractJsonObject
};
