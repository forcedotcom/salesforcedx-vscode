/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as DateTime from 'effect/DateTime';
import * as Option from 'effect/Option';

export const MILLISECONDS_PER_MINUTE = 60_000;

export function getCurrentTime(): number {
  return DateTime.unsafeNow().pipe(DateTime.toEpochMillis);
}

/**
 * Returns the formatted date and time given the milliseconds in numbers or UTC formatted string
 * @param startTime start time in millisecond numbers or UTC format string
 * @param format either 'ISO' or 'locale'. Defaults to 'locale' to keep backward compatible.
 * @returns formatted date and time
 */
export function formatStartTime(startTime: string | number | undefined, format: 'ISO' | 'locale' = 'locale'): string {
  if (!startTime) {
    return '';
  }

  const timestamp = typeof startTime === 'string' ? Date.parse(startTime) : startTime;
  if (format === 'ISO') {
    return DateTime.unsafeMake(timestamp).pipe(DateTime.formatIso);
  }

  return DateTime.make(timestamp).pipe(
    Option.match({
      onNone: () => 'Invalid Date Invalid Date',
      onSome: value => {
        const date = DateTime.toDateUtc(value);
        return `${date.toDateString()} ${date.toLocaleTimeString()}`;
      }
    })
  );
}

export function msToSecond(timestamp: string | number): string {
  return ((timestamp as number) / 1000).toFixed(2);
}
