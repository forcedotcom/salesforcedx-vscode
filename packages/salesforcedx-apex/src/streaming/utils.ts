/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Readable } from 'node:stream';
import { isArray, isObject, isPrimitive } from '../narrowing';

export const pushArrayToStream = (array: unknown[], stream: Readable): void => {
  const chunkSize = 1000;
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    let jsonString = JSON.stringify(chunk);
    jsonString = jsonString.slice(1, -1); // remove '[' and ']'
    stream.push(jsonString);
    if (i + chunkSize < array.length) {
      stream.push(','); // add comma for all but the last chunk
    }
  }
};

export const getPrimitiveEntries = (obj: object): [string, unknown][] => {
  return Object.entries(obj).filter((entry) => isPrimitive(entry[1]));
};

export const getComplexEntries = (obj: object): [string, unknown][] => {
  return Object.entries(obj).filter((entry) => !isPrimitive(entry[1]));
};

export const getObjectEntries = (obj: object): [string, object][] => {
  return Object.entries(obj).filter(
    (entry) => isObject(entry[1]) && !isArray(obj)
  );
};

export const getArrayEntries = (obj: object): [string, unknown[]][] => {
  return Object.entries(obj).filter((entry) => isArray(entry[1]));
};

export const determineType = (
  value: unknown | unknown[]
): string | string[] => {
  if (Array.isArray(value)) {
    return value.map((val) => typeof val);
  } else {
    return typeof value;
  }
};
