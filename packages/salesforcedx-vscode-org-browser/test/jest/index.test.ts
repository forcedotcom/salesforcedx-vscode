/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { activate, deactivate } from '../../src/index';

// Mock the Effect-based extension provider
jest.mock('../../src/services/extensionProvider', () => ({
  initializeTelemetry: jest.fn()
}));

// Mock Effect
jest.mock('effect', () => ({
  Effect: {
    runPromise: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock vscode
jest.mock('vscode', () => ({
  extensions: {
    getExtension: jest.fn()
  }
}));

// Import the mocked functions
import { Effect } from 'effect';

const mockRunPromise = Effect.runPromise as jest.MockedFunction<typeof Effect.runPromise>;

describe('Extension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should activate successfully', async () => {
    const context = {} as vscode.ExtensionContext;

    await activate(context);

    expect(mockRunPromise).toHaveBeenCalled();
  });

  it('should deactivate successfully', () => {
    deactivate();
    expect(true).toBe(true);
  });
});
