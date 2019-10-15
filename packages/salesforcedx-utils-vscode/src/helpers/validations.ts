/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export function isInteger(value: string | undefined): boolean {
  return value !== undefined && Number.isSafeInteger(Number.parseInt(value));
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
  return value !== undefined && !/\W/.test(value);
}
