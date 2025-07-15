/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Utility class for timing operations across the extension
 *
 * These utilities replace the previous process.hrtime() usage with
 * globalThis.performance.now() for better cross-platform compatibility
 * and more intuitive time values.
 */
export class TimingUtils {
  private static readonly MAX_ELAPSED_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get the current high-resolution timestamp
   * @returns Current timestamp in milliseconds
   */
  public static getCurrentTime(): number {
    // Fallback to Date.now() if performance.now() is not available
    if (typeof globalThis.performance?.now === 'function') {
      return globalThis.performance.now();
    }

    console.warn('globalThis.performance.now() not available, falling back to Date.now()');
    return Date.now();
  }

  /**
   * Calculate elapsed time from a start timestamp
   * @param startTime The start timestamp (from getCurrentTime())
   * @returns Elapsed time in milliseconds, or 0 if invalid
   */
  public static getElapsedTime(startTime: number): number {
    if (typeof startTime !== 'number' || isNaN(startTime) || startTime < 0) {
      console.warn('Invalid start time provided to getElapsedTime:', startTime);
      return 0;
    }

    const elapsed = TimingUtils.getCurrentTime() - startTime;

    // Sanity check: elapsed time should be positive and reasonable
    if (elapsed < 0) {
      console.warn('Negative elapsed time detected:', elapsed);
      return 0;
    }

    // Cap at 24 hours to prevent unreasonable values
    if (elapsed > TimingUtils.MAX_ELAPSED_MS) {
      console.warn('Suspiciously large elapsed time:', elapsed);
      return TimingUtils.MAX_ELAPSED_MS;
    }

    return elapsed;
  }

  /**
   * Safely get elapsed time, with fallback to 0 if start time is undefined
   * @param startTime The start timestamp (optional)
   * @returns Elapsed time in milliseconds, or 0 if startTime is undefined/invalid
   */
  public static getElapsedTimeOrZero(startTime?: number): number {
    if (startTime === undefined || startTime === null) {
      return 0;
    }

    return TimingUtils.getElapsedTime(startTime);
  }
}
