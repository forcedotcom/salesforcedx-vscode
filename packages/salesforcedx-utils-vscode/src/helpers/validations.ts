/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const isInteger = (value: string | undefined): boolean => {
  return value !== undefined && !/\D/.test(value) && Number.isSafeInteger(Number.parseInt(value, 10));
};

export const isIntegerInRange = (value: string | undefined, range: [number, number]): boolean => {
  return (
    value !== undefined &&
    isInteger(value) &&
    Number.parseInt(value, 10) >= range[0] &&
    Number.parseInt(value, 10) <= range[1]
  );
};

export const isAlphaNumString = (value: string | undefined): boolean => {
  return value !== undefined && value !== '' && !/\W/.test(value);
};

export const isRecordIdFormat = (value: string = '', prefix: string): boolean => {
  return isAlphaNumString(value) && value.startsWith(prefix) && (value.length === 15 || value.length === 18);
};

export const isAlphaNumSpaceString = (value: string | undefined): boolean => {
  return value !== undefined && /^\w+( *\w*)*$/.test(value);
};
