/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileSystemDataProvider } from './providers/fileSystemDataProvider';

interface StabilityConfig {
  maxWaitTime: number;
  checkInterval: number;
  stableChecks: number;
  lastFileCount: number;
  stableCount: number;
  startTime: number;
}

interface ReinitializationSchedulerOptions {
  /** Maximum time to wait for stability (default: 30 seconds) */
  maxWaitTime?: number;
  /** Interval between stability checks (default: 500ms) */
  checkInterval?: number;
  /** Number of consecutive stable checks required (default: 3) */
  stableChecks?: number;
}

/**
 * Creates a setTimeout timer that doesn't keep the process alive in test environments.
 * Uses .unref() to allow the process to exit even when the timer is active (important for tests).
 * In production, the LSP connection keeps the process alive, so this is safe.
 */
const createUnrefTimer = (callback: () => void, delay: number): ReturnType<typeof setTimeout> => {
  const timer = setTimeout(callback, delay);
  // In Node.js, setTimeout returns a NodeJS.Timeout object with unref()
  // In browser environments, it returns a number, so we check before calling
  // Use .unref() to prevent timers from keeping the process alive (important for tests)
  // In production, the LSP connection (connection.listen()) keeps the process alive,
  // so the timer won't cause premature exit even with .unref()
  if (typeof timer === 'object' && 'unref' in timer) {
    timer.unref();
  }
  return timer;
};

/**
 * Schedules re-initialization of language server components after waiting
 * for file loading to stabilize. Uses dynamic waiting based on file count changes.
 */
export const scheduleReinitialization = (
  fileSystemProvider: FileSystemDataProvider,
  reinitializationCallback: () => Promise<void> | void,
  options: ReinitializationSchedulerOptions = {}
): void => {
  const config: StabilityConfig = {
    maxWaitTime: options.maxWaitTime ?? 30_000, // 30 seconds max wait
    checkInterval: options.checkInterval ?? 500, // Check every 500ms
    stableChecks: options.stableChecks ?? 3, // Need 3 consecutive stable checks (1.5 seconds)
    lastFileCount: 0,
    stableCount: 0,
    startTime: Date.now()
  };

  // Start the stability check
  createUnrefTimer(() => checkStability(config, fileSystemProvider, reinitializationCallback), config.checkInterval);
};

/**
 * Checks if file loading has stabilized and triggers re-initialization when ready
 */
const checkStability = (
  config: StabilityConfig,
  fileSystemProvider: FileSystemDataProvider,
  reinitializationCallback: () => Promise<void> | void
): void => {
  const currentFileCount = fileSystemProvider.getAllFileUris().length;
  const elapsed = Date.now() - config.startTime;

  // If file count is stable for required consecutive checks, proceed with re-initialization
  if (currentFileCount === config.lastFileCount && currentFileCount > 0) {
    config.stableCount++;
    if (config.stableCount >= config.stableChecks) {
      void reinitializationCallback();
      return;
    }
  } else {
    config.stableCount = 0; // Reset stability counter if file count changed
  }

  config.lastFileCount = currentFileCount;

  // Continue checking if we haven't exceeded max wait time
  if (elapsed < config.maxWaitTime) {
    createUnrefTimer(() => checkStability(config, fileSystemProvider, reinitializationCallback), config.checkInterval);
  } else {
    // Max wait time exceeded, proceed anyway
    void reinitializationCallback();
  }
};
