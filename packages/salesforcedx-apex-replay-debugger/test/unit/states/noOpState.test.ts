/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock DebugSession.run to prevent it from executing during tests
vi.mock('@vscode/debugadapter', async importOriginal => {
  const actual = await importOriginal<typeof import('@vscode/debugadapter')>();
  return {
    ...actual,
    DebugSession: Object.assign(actual.DebugSession, { run: vi.fn() })
  };
});

import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { LogContext } from '../../../src/core';
import { NoOpState } from '../../../src/states';

describe('NoOp event', () => {
  it('Should handle event', () => {
    const context = new LogContext(
      {
        logFileContents: 'test log content',
        logFilePath: '/path/foo.log',
        logFileName: 'foo.log',
        stopOnEntry: true,
        trace: true
      } as LaunchRequestArguments,
      new ApexReplayDebug()
    );
    const unsupported = new NoOpState();

    expect(unsupported.handle(context)).toBe(false);
  });
});
