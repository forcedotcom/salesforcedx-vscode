/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const MILLISECONDS_PER_MINUTE = 60000;

export function getCurrentTime(): number {
  return new Date().getTime();
}

/**
 * Returns the formatted date and time given the milliseconds in numbers or UTC formatted string
 * @param startTime start time in millisecond numbers or UTC format string
 * @param format either 'ISO' or 'locale'. Defaults to 'locale' to keep backward compatible.
 * @returns formatted date and time
 */
export function formatStartTime(
  startTime: string | number | undefined,
  format: 'ISO' | 'locale' = 'locale'
): string {
  if (!startTime) {
    return '';
  }

  const date = new Date(startTime);
  if (format === 'ISO') {
    return date.toISOString();
  }

  return `${date.toDateString()} ${date.toLocaleTimeString()}`;
}

export function msToSecond(timestamp: string | number): string {
  return ((timestamp as number) / 1000).toFixed(2);
}
