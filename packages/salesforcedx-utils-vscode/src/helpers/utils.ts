/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename } from 'path';
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

  // let nativePath = realpathSync.native(filePath);
  // Above is the original assigned nativePath value.
  // We found that filePath is the correct path and the stale name issue
  // no longer exists.
  let nativePath = filePath;
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
  if (filePath !== nativePath && filePath.toLowerCase() === nativePath.toLowerCase()) {
    telemetryService.sendEventData('FilePathCaseMismatch', {
      originalPath: basename(filePath),
      nativePath: basename(nativePath)
    });
  }
  return nativePath;
};

export const flushFilePaths = (filePaths: string[]): string[] => {
  for (let i = 0; i < filePaths.length; i++) {
    filePaths[i] = flushFilePath(filePaths[i]);
  }

  return filePaths;
};

export const asyncFilter = async <T>(arr: T[], callback: (value: T, index: number, array: T[]) => unknown) => {
  const results = await Promise.all(arr.map(callback));

  return arr.filter((_v, index) => results[index]);
};

export const fileUtils = {
  flushFilePaths,
  flushFilePath,
  extractJsonObject
};

export const stripAnsiInJson = (str: string, hasJson: boolean): string => {
  return str && hasJson ? stripAnsi(str) : str;
};

export const stripAnsi = (str: string): string => {
  return str ? str.replaceAll(ansiRegex(), '') : str;
};

export const getMessageFromError = (err: any): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err) {
    return `Unexpected error: ${JSON.stringify(err)}`;
  }
  return 'Unknown error';
};

/*
Copied from https://github.com/sindresorhus/strip-ansi/blob/master/index.js

MIT License
Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without
limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE
OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

export const ansiRegex = ({ onlyFirst = false } = {}): RegExp => {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
  ].join('|');

  return new RegExp(pattern, onlyFirst ? undefined : 'g');
};
