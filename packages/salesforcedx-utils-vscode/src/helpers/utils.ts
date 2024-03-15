/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { realpathSync, lstatSync } from 'fs';
import { basename, resolve, dirname } from 'path';
import { telemetryService } from '../telemetry';

export const isNullOrUndefined = (object: any): object is null | undefined => {
  return object === null || object === undefined;
};

export const extractJsonObject = (str: string): any => {
  const isJsonString = str.indexOf('{') !== -1 && str.lastIndexOf('}') !== -1;
  let jsonString;
  if (isJsonString) {
    jsonString = str.substring(str.indexOf('{'), str.lastIndexOf('}') + 1);
    return JSON.parse(jsonString);
  }
  throw new Error(`The string "${str}" is not a valid JSON string.`);
};

// There's a bug in VS Code where, after a file has been renamed,
// the URI that VS Code passes to the command is stale and is the
// original URI.  See https://github.com/microsoft/vscode/issues/152993.
//
// To get around this, fs.realpathSync.native() is called to get the
// URI with the actual file name.

export const flushFilePath = (filePath: string): string => {
  if (filePath === '') {
    return filePath;
  }

  let nativePath = isSymbolicLink(filePath)? filePath: realpathSync.native(filePath);
  if (/^win32/.test(process.platform)) {
    // The file path on Windows is in the form of "c:\Users\User Name\foo.cls".
    // When called, fs.realpathSync.native() is returning the file path back as
    // "C:\Users\User Name\foo.cls", and the capitalization of the drive letter
    // causes problems further down stream.  To fix this, we'll use the path
    // returned from fs.realpathSync.native() and then change the first character
    // to lower case.
    nativePath = nativePath.charAt(0).toLowerCase() + nativePath.slice(1);
  }

  // check if the native path is the same case insensitive and then case sensitive
  // so that condition can be reported via telemetry
  if (
    filePath !== nativePath &&
    filePath.toLowerCase() === nativePath.toLowerCase()
  ) {
    telemetryService.sendEventData('FilePathCaseMismatch', {
      originalPath: basename(filePath),
      nativePath: basename(nativePath)
    });
  }
  return nativePath;
};

export const isSymbolicLink = (path: string) => {
  try {
    let currentPath = resolve(path);
    // track down the path until it is a root path
    while(currentPath !== dirname(currentPath)) {
      const stats = lstatSync(currentPath);
      const isLink = stats.isSymbolicLink();
      if (isLink) return true;
      currentPath = dirname(currentPath);
    }
    return false;
  } catch (err) {
      throw new Error('The path does not exist');
  }
};

export const flushFilePaths = (filePaths: string[]): string[] => {
  for (let i = 0; i < filePaths.length; i++) {
    filePaths[i] = flushFilePath(filePaths[i]);
  }

  return filePaths;
};

export const asyncFilter = async <T>(
  arr: T[],
  callback: (value: T, index: number, array: T[]) => unknown
) => {
  const results = await Promise.all(arr.map(callback));

  return arr.filter((_v, index) => results[index]);
};

export const fileUtils = {
  flushFilePaths,
  flushFilePath,
  extractJsonObject
};
