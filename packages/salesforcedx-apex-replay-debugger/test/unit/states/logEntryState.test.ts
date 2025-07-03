/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock DebugSession.run to prevent it from executing during tests
jest.mock('@vscode/debugadapter', () => ({
  ...jest.requireActual('@vscode/debugadapter'),
  DebugSession: {
    ...jest.requireActual('@vscode/debugadapter').DebugSession,
    run: jest.fn()
  }
}));

import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { LogContext, LogContextUtil } from '../../../src/core';
import { LogEntryState } from '../../../src/states';

describe('LogEntry event', () => {
  let readLogFileStub: jest.SpyInstance;

  beforeEach(() => {
    readLogFileStub = jest.spyOn(LogContextUtil.prototype, 'readLogFile').mockResolvedValue(['line1', 'line2']);
  });

  afterEach(() => {
    readLogFileStub.mockRestore();
  });

  it('Should handle event', async () => {
    const context = await LogContext.create(
      {
        logFile: '/path/foo.log',
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
