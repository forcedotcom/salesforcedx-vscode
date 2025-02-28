/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { basename } from 'path';
import { telemetryService } from '../telemetry';

export const getJsonCandidate = (str: string): string | null => {
  const firstCurly = str.indexOf('{');
  const lastCurly = str.lastIndexOf('}');
  const firstSquare = str.indexOf('[');
  const lastSquare = str.lastIndexOf(']');

  // Detect the correct JSON structure (object vs. array)
  const isObject = firstCurly !== -1 && lastCurly !== -1 && firstCurly < lastCurly;
  const isArray = firstSquare !== -1 && lastSquare !== -1 && firstSquare < lastSquare;

  let jsonCandidate: string | null = null;

  if (isObject && isArray) {
    // If both are present, pick the one that appears first
    jsonCandidate =
      firstCurly < firstSquare ? str.slice(firstCurly, lastCurly + 1) : str.slice(firstSquare, lastSquare + 1);
  } else if (isObject) {
    jsonCandidate = str.slice(firstCurly, lastCurly + 1);
  } else if (isArray) {
    jsonCandidate = str.slice(firstSquare, lastSquare + 1);
  }
  return jsonCandidate;
};

export const identifyJsonTypeInString = (str: string): 'object' | 'array' | 'primitive' | 'none' => {
  str = str.trim(); // Remove leading/trailing whitespace

  const jsonCandidate: string | null = getJsonCandidate(str);

  // Check if the JSON candidate is a valid object or array
  if (jsonCandidate) {
    const stack: string[] = [];
    for (let i = 0; i < jsonCandidate.length; i++) {
      const char = jsonCandidate[i];
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        const last = stack.pop();
        if ((char === '}' && last !== '{') || (char === ']' && last !== '[')) {
          return 'none';
        }
      } else if (char === '"' && (i === 0 || jsonCandidate[i - 1] !== '\\')) {
        // Skip over strings
        i++;
        while (i < jsonCandidate.length && (jsonCandidate[i] !== '"' || jsonCandidate[i - 1] === '\\')) {
          i++;
        }
      }
    }

    if (stack.length === 0) {
      if (jsonCandidate.startsWith('{') && jsonCandidate.endsWith('}')) {
        return 'object';
      } else if (jsonCandidate.startsWith('[') && jsonCandidate.endsWith(']')) {
        return 'array';
      }
    }
  }

  // Check if the entire string is a valid JSON primitive
  if (
    /^"([^"\\]|\\.)*"$/.test(str) || // String
    /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(str) || // Number
    /^(true|false|null)$/.test(str)
  ) {
    // Boolean or null
    return 'primitive';
  }

  return 'none';
};

export const extractJson = <T = any>(str: string): T => {
  str = str.trim(); // Remove leading/trailing whitespace

  const jsonCandidate: string | null = getJsonCandidate(str);
  const jsonType = identifyJsonTypeInString(str);

  if (!jsonCandidate || jsonType === 'none' || jsonType === 'primitive') {
    throw new Error(`The string "${str}" does not contain an array or object.`);
  }
  // Try parsing the detected JSON structure
  return JSON.parse(jsonCandidate) as T; // Cast to generic type
};

export const isNullOrUndefined = (object: any): object is null | undefined => {
  return object === null || object === undefined;
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
  extractJson
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

/**
 * Returns elements that are in setA but not in setB.
 * @param setA
 * @param setB
 * @returns
 */
export const difference = <T>(setA: Set<T>, setB: Set<T>): Set<T> => {
  return new Set([...setA].filter(x => !setB.has(x)));
};
