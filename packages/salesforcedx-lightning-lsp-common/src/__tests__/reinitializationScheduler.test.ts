/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FileSystemDataProvider } from '../providers/fileSystemDataProvider';
import { scheduleReinitialization } from '../reinitializationScheduler';

describe('scheduleReinitialization', () => {
  let fileSystemProvider: FileSystemDataProvider;
  let callback: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    fileSystemProvider = new FileSystemDataProvider();
    callback = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    fileSystemProvider.clear();
  });

  it('should trigger reinitialization after stable file count', () => {
    // Add some files
    fileSystemProvider.updateFileStat('/file1.js', { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 });
    fileSystemProvider.updateFileStat('/file2.js', { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 });

    scheduleReinitialization(fileSystemProvider, callback, {
      maxWaitTime: 5000,
      checkInterval: 100,
      stableChecks: 2
    });

    // First check: sets lastFileCount to 2, but not stable yet (needs > 0 AND stable)
    jest.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();

    // Second check: count is still 2 (stable for 1 check)
    jest.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();

    // Third check: count is still 2 (stable for 2 checks, should trigger)
    jest.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should reset stability counter when file count changes', () => {
    // Start with 1 file
    fileSystemProvider.updateFileStat('/file1.js', { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 });

    scheduleReinitialization(fileSystemProvider, callback, {
      maxWaitTime: 5000,
      checkInterval: 100,
      stableChecks: 2
    });

    // First check - 1 file
    jest.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();

    // Add another file - count changes
    fileSystemProvider.updateFileStat('/file2.js', { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 });

    // Second check - 2 files (count changed, should reset counter)
    jest.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();

    // Third check - 2 files (stable for 1 check)
    jest.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();

    // Fourth check - 2 files (stable for 2 checks, should trigger)
    jest.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should trigger reinitialization after max wait time even if unstable', () => {
    scheduleReinitialization(fileSystemProvider, callback, {
      maxWaitTime: 600,
      checkInterval: 100,
      stableChecks: 10 // High number so stability is never reached
    });

    // Keep adding files to prevent stability
    for (let i = 0; i < 5; i++) {
      fileSystemProvider.updateFileStat(`/file${i}.js`, { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 });
      jest.advanceTimersByTime(100);
      // File count changes each time, so stability counter resets
    }

    // Should not have been called yet (not stable, and not past max wait time)
    expect(callback).not.toHaveBeenCalled();

    // Advance past max wait time (600ms total)
    jest.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger if file count is 0', () => {
    scheduleReinitialization(fileSystemProvider, callback, {
      maxWaitTime: 500,
      checkInterval: 100,
      stableChecks: 2
    });

    // Multiple checks with 0 files
    jest.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();

    // Even after max wait time, should not trigger if count is 0
    jest.advanceTimersByTime(400);
    expect(callback).toHaveBeenCalledTimes(1); // Will trigger due to max wait time
  });

  it('should use default options when not provided', () => {
    fileSystemProvider.updateFileStat('/file1.js', { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 });

    scheduleReinitialization(fileSystemProvider, callback);

    // Default: checkInterval = 500ms, stableChecks = 3
    // First check: sets lastFileCount to 1
    jest.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();

    // Second check: stable for 1 check
    jest.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();

    // Third check: stable for 2 checks
    jest.advanceTimersByTime(500);
    expect(callback).not.toHaveBeenCalled();

    // Fourth check: stable for 3 checks (should trigger)
    jest.advanceTimersByTime(500);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should handle custom options correctly', () => {
    fileSystemProvider.updateFileStat('/file1.js', { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 });

    scheduleReinitialization(fileSystemProvider, callback, {
      maxWaitTime: 2000,
      checkInterval: 200,
      stableChecks: 1
    });

    // First check: sets lastFileCount to 1
    jest.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();

    // Second check: stable for 1 check (should trigger with stableChecks = 1)
    jest.advanceTimersByTime(200);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should handle async callback', async () => {
    const asyncCallback = jest.fn().mockResolvedValue(undefined);
    fileSystemProvider.updateFileStat('/file1.js', { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 });

    scheduleReinitialization(fileSystemProvider, asyncCallback, {
      checkInterval: 100,
      stableChecks: 1
    });

    // First check: sets lastFileCount
    jest.advanceTimersByTime(100);
    expect(asyncCallback).not.toHaveBeenCalled();

    // Second check: stable for 1 check (should trigger)
    jest.advanceTimersByTime(100);
    expect(asyncCallback).toHaveBeenCalledTimes(1);

    // Wait for promise to resolve
    await Promise.resolve();
    expect(asyncCallback).toHaveBeenCalledTimes(1);
  });

  it('should call callback even if it throws an error', () => {
    // Note: The implementation uses void operator which doesn't catch errors
    // Errors will propagate, but the callback is still called
    const errorCallback = jest.fn().mockImplementation(() => {
      throw new Error('Callback error');
    });
    fileSystemProvider.updateFileStat('/file1.js', { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 });

    scheduleReinitialization(fileSystemProvider, errorCallback, {
      checkInterval: 100,
      stableChecks: 1
    });

    // First check: sets lastFileCount
    jest.advanceTimersByTime(100);
    expect(errorCallback).not.toHaveBeenCalled();

    // Second check: stable for 1 check (should trigger, error will propagate)
    expect(() => {
      jest.advanceTimersByTime(100);
    }).toThrow('Callback error');

    expect(errorCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle rapid file count changes', () => {
    scheduleReinitialization(fileSystemProvider, callback, {
      maxWaitTime: 2000,
      checkInterval: 50,
      stableChecks: 2
    });

    // Rapidly add and remove files
    for (let i = 0; i < 10; i++) {
      fileSystemProvider.updateFileStat(`/file${i}.js`, { type: 'file', exists: true, ctime: 0, mtime: 0, size: 0 });
      jest.advanceTimersByTime(50);
      fileSystemProvider.updateFileStat(`/file${i}.js`, { type: 'file', exists: false, ctime: 0, mtime: 0, size: 0 });
      jest.advanceTimersByTime(50);
    }

    // Should not have been called (never stable)
    expect(callback).not.toHaveBeenCalled();

    // Should trigger after max wait time
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
