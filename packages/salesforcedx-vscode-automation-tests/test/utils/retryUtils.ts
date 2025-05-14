/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Duration, log } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core/miscellaneous';
import {
  getWorkbench,
  notificationIsPresentWithTimeout
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';

/**
 * Retry a notification check
 * TODO: Consider moving this to salesforcedx-vscode-test-tools
 * @param notificationPattern - The notification pattern to check
 * @param wait - The wait time for the notification to appear
 * @param methodToRunForEachTry - The method to run for each try
 * @returns
 */
export const verifyNotificationWithRetry = async (
  notificationPattern: RegExp,
  wait = Duration.TEN_MINUTES,
  methodToRunForEachTry?: () => Promise<void>
) => {
  try {
    if (methodToRunForEachTry) {
      await methodToRunForEachTry();
    }
    const notificationWasFound = await notificationIsPresentWithTimeout(notificationPattern, wait);
    expect(notificationWasFound).to.equal(true);
    return;
  } catch (error) {
    if (methodToRunForEachTry) {
      await methodToRunForEachTry();
    }
    log(`Error finding notification ${notificationPattern} ${JSON.stringify(error)}, trying again...`);
    await getWorkbench().openNotificationsCenter();
  }
};

/**
 * Retry an operation
 * TODO: Consider moving this to salesforcedx-vscode-test-tools
 * @param operation - The operation to retry
 * @param maxAttempts - The maximum number of attempts
 * @param errorMessage - The error message to log
 * @returns The result of the operation
 */
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxAttempts = 2,
  errorMessage = 'Operation failed'
): Promise<T> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      log(`${errorMessage} ${JSON.stringify(error)}, trying again...`);
    }
  }
  throw new Error(`${errorMessage} after ${maxAttempts} attempts`);
};
