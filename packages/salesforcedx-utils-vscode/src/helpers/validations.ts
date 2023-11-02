/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export function isInteger(value: string | undefined): boolean {
  return (
    value !== undefined &&
    !/\D/.test(value) &&
    Number.isSafeInteger(Number.parseInt(value))
  );
}

export function isIntegerInRange(
  value: string | undefined,
  range: [number, number]
): boolean {
  return (
    value !== undefined &&
    isInteger(value) &&
    Number.parseInt(value) >= range[0] &&
    Number.parseInt(value) <= range[1]
  );
}

export function isAlphaNumString(value: string | undefined): boolean {
  return value !== undefined && value !== '' && !/\W/.test(value);
}

export function isRecordIdFormat(value: string = '', prefix: string): boolean {
  return (
    isAlphaNumString(value) &&
    value.startsWith(prefix) &&
    (value.length === 15 || value.length === 18)
  );
}

export function isAlphaNumSpaceString(value: string | undefined): boolean {
  return value !== undefined && /^\w+( *\w*)*$/.test(value);
}
