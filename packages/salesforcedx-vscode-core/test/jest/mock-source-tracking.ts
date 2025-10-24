/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// this file somehow became necessary when STL moved to ESM module because of mocking differences.

export const SourceTracking = {
  create: jest.fn()
};

export const SourceConflictError = class SourceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceConflictError';
  }
};

export const getKeyFromObject = jest.fn();
export const deleteCustomLabels = jest.fn();
