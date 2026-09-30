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

import type { MockInstance as VitestMockInstance } from 'vitest';
import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { LogContext } from '../../../src/core';
import * as logContextUtil from '../../../src/core/logContextUtil';
import { LogEntryState } from '../../../src/states';

describe('LogEntry event', () => {
  let readLogFileStub: VitestMockInstance;

  beforeEach(() => {
    readLogFileStub = vi.spyOn(logContextUtil, 'readLogFileFromContents').mockReturnValue(['line1', 'line2']);
  });

  afterEach(() => {
    readLogFileStub.mockRestore();
  });

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
    const logEntry = new LogEntryState();

    const isStopped = logEntry.handle(context);

    expect(isStopped).toBe(true);
    const stackFrames = context.getFrames();
    expect(context.getNumOfFrames()).toBe(1);
    const stackFrame = stackFrames[0];
    expect(stackFrame.id).toBe(0);
    expect(stackFrame.name).toBe('');
    expect(stackFrame.line).toBe(context.getLogLinePosition() + 1);
    expect(stackFrame.source?.name).toBe(context.getLogFileName());
    expect(stackFrame.source?.path).toBe(context.getLogFilePath());
  });
});
