/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


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
  const jsonCandidate: string | null = getJsonCandidate(str.trim()); // Remove leading/trailing whitespace

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
  const trimmedString = str.trim(); // Remove leading/trailing whitespace

  const jsonCandidate: string | null = getJsonCandidate(trimmedString);
  const jsonType = identifyJsonTypeInString(trimmedString);

  if (!jsonCandidate || jsonType === 'none' || jsonType === 'primitive') {
    throw new Error(`The string "${trimmedString}" does not contain an array or object.`);
  }
  // Try parsing the detected JSON structure
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return JSON.parse(jsonCandidate) as T; // Cast to generic type
};


export const stripAnsiInJson = (str: string, hasJson: boolean): string => (str && hasJson ? stripAnsi(str) : str);

export const stripAnsi = (str: string): string => (str ? str.replaceAll(ansiRegex(), '') : str);

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

const ansiRegex = ({ onlyFirst = false } = {}): RegExp => {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
  ].join('|');

  return new RegExp(pattern, onlyFirst ? undefined : 'g');
};

/**
 * Used to remove column/line from org Apex compilations errors.
 * @param error
 * @returns
 */
