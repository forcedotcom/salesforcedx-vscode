/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export function getYYYYMMddHHmmssDateFormat(localUTCDate: Date): string {
  const month2Digit = makeDoubleDigit(localUTCDate.getMonth() + 1);
  const date2Digit = makeDoubleDigit(localUTCDate.getDate());
  const hour2Digit = makeDoubleDigit(localUTCDate.getHours());
  const mins2Digit = makeDoubleDigit(localUTCDate.getMinutes());
  const sec2Digit = makeDoubleDigit(localUTCDate.getSeconds());

  return `${localUTCDate.getFullYear()}${month2Digit}${date2Digit}${hour2Digit}${mins2Digit}${sec2Digit}`;
}

export function makeDoubleDigit(currentDigit: number): string {
  return ('0' + currentDigit).slice(-2);
}

export const optionYYYYMMddHHmmss = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
};

export const optionHHmm = {
  hour: '2-digit',
  minute: '2-digit'
};

export const optionMMddYYYY = {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric'
};
