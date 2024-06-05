/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger, LoggerLevel } from '@salesforce/core';
import v8 from 'node:v8';
import { clearInterval } from 'node:timers';

const INTERVAL_DEFAULT = 500;
const INTERVAL_MIN = 100;
const INTERVAL_MAX = 10_000;

export class NullHeapMonitor implements Disposable {
  checkHeapSize(): void {}
  startMonitoring(): void {}
  stopMonitoring(): void {}
  [Symbol.dispose](): void {}
}

/**
 * Class responsible for monitoring heap memory usage.
 */
export class HeapMonitor implements Disposable {
  private static instance: HeapMonitor | NullHeapMonitor;
  private logger: Logger;
  private intervalId?: NodeJS.Timeout;
  private isMonitoring: boolean;
  private interval: number;

  /**
   * Private constructor to enforce singleton pattern.
   */
  private constructor() {
    this.logger = Logger.childFromRoot('heap-monitor', {
      tag: 'heap-monitor'
    });
    this.isMonitoring = false;
    // Check for SF_HEAP_MONITOR_INTERVAL environment variable
    this.interval = INTERVAL_DEFAULT; // default value
    const envInterval = process.env.SF_HEAP_MONITOR_INTERVAL;
    if (envInterval && Number.isInteger(Number(envInterval))) {
      this.interval = Number(envInterval);
    }
    if (this.interval < INTERVAL_MIN || this.interval > INTERVAL_MAX) {
      this.logger.warn(
        `Interval if ${this.interval} found in SF_HEAP_MONITOR_INTERVAL must be between: ${INTERVAL_MIN} and ${INTERVAL_MAX}. Using default of ${INTERVAL_DEFAULT}`
      );
      this.interval = INTERVAL_DEFAULT;
    }
  }

  /**
   * Returns the singleton instance of HeapMonitor.
   * @returns The singleton instance.
   */
  public static getInstance(): HeapMonitor | NullHeapMonitor {
    if (!HeapMonitor.instance) {
      if (Logger.getRoot().shouldLog(LoggerLevel.DEBUG)) {
        HeapMonitor.instance = new HeapMonitor();
      } else {
        HeapMonitor.instance = new NullHeapMonitor();
      }
    }
    return HeapMonitor.instance;
  }

  /**
   * Checks the current heap size and logs the details.
   * @param [applicationArea] - Optional application area to be included in the log.
   */
  public checkHeapSize(applicationArea?: string): void {
    if (!this.logger.shouldLog(LoggerLevel.DEBUG)) {
      return;
    }
    const heapStats = v8.getHeapStatistics();
    const heapSpaceStats = v8.getHeapSpaceStatistics();

    const memoryUsage = process.memoryUsage();

    const logRecord: { [name: string]: string | number } = {
      msg: 'Memory usage',
      applicationArea,
      rss: Number(memoryUsage.rss),
      heapTotal: Number(memoryUsage.heapTotal),
      heapUsed: Number(memoryUsage.heapUsed),
      external: Number(memoryUsage.external)
    };

    // Convert heapStats properties to numbers and add to logRecord
    for (const [key, value] of Object.entries(heapStats)) {
      logRecord[key] = Number(value);
    }

    // Flatten heapSpaces into individual properties
    heapSpaceStats.forEach((space) => {
      logRecord[`${space.space_name}_total`] = Number(space.space_size);
      logRecord[`${space.space_name}_used`] = Number(space.space_used_size);
      logRecord[`${space.space_name}_available`] = Number(
        space.space_available_size
      );
    });

    this.logger.debug(logRecord);
  }

  /**
   * Starts monitoring the heap memory usage at regular intervals.
   * WARNING: Monitoring is done on a schedule interval, which must stopped/cleared
   * or the monitor will continue to run. The symptom of this will be a node process
   * that seems to be hanging.
   *
   * One must call stopMonitoring or capture the instance in a scope with the
   * Typescript "using"
   * @example
   * ```typescript
   * async function main() {
   *   await using(HeapMonitor.getInstance(), async (heapMonitor) => {
   *     heapMonitor.startMonitoring();
   *
   *     // Simulate some work
   *     await new Promise(resolve => setTimeout(resolve, 2000));
   *
   *     // No need to explicitly call dispose, it will be called automatically
   *   });
   * }
   *
   * main().catch(console.error);
   * ```
   **/
  public startMonitoring(): void {
    if (!this.isMonitoring) {
      this.isMonitoring = true;
      if (!this.logger.shouldLog(LoggerLevel.DEBUG)) {
        return;
      }

      this.checkHeapSize();
      this.intervalId = setInterval(() => this.checkHeapSize(), this.interval);
    }
  }

  /**
   * Stops monitoring the heap memory usage.
   *
   * WARNING: It is imperative that a heap monitor be stopped
   * before the node process exits.
   *
   * See @{link startMonitoring}
   */
  public stopMonitoring(): void {
    if (this.isMonitoring) {
      this.isMonitoring = false;
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = undefined;
      }
    }
  }

  /**
   * dispose method that will be called when instance of HeapMonitor
   * is captured by Typescript "using" keyword.
   *
   * See {@link startMonitoring}
   */
  [Symbol.dispose](): void {
    this.stopMonitoring();
    this.logger.debug('HeapMonitor disposed');
    HeapMonitor.instance = null;
  }
}
