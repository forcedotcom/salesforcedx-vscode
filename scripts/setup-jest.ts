/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/// <reference types="jest" />

import { createVSCodeMock } from './vscodeMock';

// Azure Monitor exporter ctor starts a 15s Statsbeat timer that dynamic-imports after Jest teardown (exit 1).
process.env.APPLICATION_INSIGHTS_NO_STATSBEAT = 'true';

jest.mock('vscode', () => createVSCodeMock(jest.fn), { virtual: true });

beforeEach(() => {
  // resetMocks=true wipes mock implementations, so re-apply default mocks here.
  // Tests that need specific mocks should provide their own via Effect layers.
  const vscodeMock: any = jest.requireMock('vscode');
  vscodeMock.extensions.getExtension.mockImplementation(() => undefined);
  vscodeMock.commands.executeCommand.mockResolvedValue(undefined);
});

// Mock os module to ensure homedir() always returns a valid path
jest.mock('node:os', () => ({
  ...jest.requireActual('node:os'),
  homedir: jest.fn(() => '/tmp')
}));

// Also mock the legacy 'os' import
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => '/tmp')
}));
