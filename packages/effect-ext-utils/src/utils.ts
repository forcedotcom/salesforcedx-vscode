/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const getJsonCandidate = (str: string): string | undefined => {
  const firstCurly = str.indexOf('{');
  const lastCurly = str.lastIndexOf('}');
  const firstSquare = str.indexOf('[');
  const lastSquare = str.lastIndexOf(']');

  // Detect the correct JSON structure (object vs. array)
  const isObject = firstCurly !== -1 && lastCurly !== -1 && firstCurly < lastCurly;
  const isArray = firstSquare !== -1 && lastSquare !== -1 && firstSquare < lastSquare;

  if (isObject && isArray) {
    // If both are present, pick the one that appears first
    return firstCurly < firstSquare ? str.slice(firstCurly, lastCurly + 1) : str.slice(firstSquare, lastSquare + 1);
  } else if (isObject) {
    return str.slice(firstCurly, lastCurly + 1);
  } else if (isArray) {
    return str.slice(firstSquare, lastSquare + 1);
  }
  return undefined;
};

type ParseState = {
  readonly stack: readonly string[];
  readonly inString: boolean;
  readonly escaped: boolean;
  readonly balanced: boolean;
};

const isBalancedBrackets = (candidate: string): boolean => {
  const final = Array.from(candidate).reduce<ParseState>(
    (state, char) => {
      if (!state.balanced) return state;
      if (state.inString) {
        if (state.escaped) return { ...state, escaped: false };
        if (char === '\\') return { ...state, escaped: true };
        if (char === '"') return { ...state, inString: false };
        return state;
      }
      if (char === '"') return { ...state, inString: true };
      if (char === '{' || char === '[') return { ...state, stack: [...state.stack, char] };
      if (char === '}' || char === ']') {
        const last = state.stack.at(-1);
        const matches = (char === '}' && last === '{') || (char === ']' && last === '[');
        if (!matches) return { ...state, balanced: false };
        return { ...state, stack: state.stack.slice(0, -1) };
      }
      return state;
    },
    { stack: [], inString: false, escaped: false, balanced: true }
  );
  return final.balanced && final.stack.length === 0;
};

export const identifyJsonTypeInString = (str: string): 'object' | 'array' | 'primitive' | 'none' => {
  const jsonCandidate = getJsonCandidate(str.trim()); // Remove leading/trailing whitespace

  // Check if the JSON candidate is a valid object or array
  if (jsonCandidate && isBalancedBrackets(jsonCandidate)) {
    if (jsonCandidate.startsWith('{') && jsonCandidate.endsWith('}')) return 'object';
    if (jsonCandidate.startsWith('[') && jsonCandidate.endsWith(']')) return 'array';
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

export const extractJson = <T = unknown>(str: string): T => {
  const trimmedString = str.trim(); // Remove leading/trailing whitespace

  const jsonCandidate = getJsonCandidate(trimmedString);
  const jsonType = identifyJsonTypeInString(trimmedString);

  if (!jsonCandidate || jsonType === 'none' || jsonType === 'primitive') {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error(`The string "${trimmedString}" does not contain an array or object.`);
  }
  // Try parsing the detected JSON structure
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return JSON.parse(jsonCandidate) as T; // Cast to generic type
};

export const stripAnsiInJson = (str: string, hasJson: boolean): string => (str && hasJson ? stripAnsi(str) : str);

export const stripAnsi = (str: string): string => (str ? str.replaceAll(ansiRegex(), '') : str);

export const getMessageFromError = (err: unknown): string => {
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
