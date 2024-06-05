/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isArray, isObject, isPrimitive } from '../narrowing';

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
