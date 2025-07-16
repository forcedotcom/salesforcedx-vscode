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

import { Source, StackFrame } from '@vscode/debugadapter';
import { EOL } from 'node:os';
import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { EXEC_ANON_SIGNATURE } from '../../../src/constants';
import { LogContext } from '../../../src/core';
import { UserDebugState } from '../../../src/states';

describe('User debug event', () => {
  let warnToDebugConsoleStub: jest.SpyInstance;
  let getLogLinesStub: jest.SpyInstance;
  let context: LogContext;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const launchRequestArgs: LaunchRequestArguments = {
    logFileContents: 'test log content',
    logFilePath,
    logFileName,
    trace: true,
    projectPath: undefined
  };

  beforeEach(() => {
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    warnToDebugConsoleStub = jest.spyOn(ApexReplayDebug.prototype, 'warnToDebugConsole');
    getLogLinesStub = jest
      .spyOn(LogContext.prototype, 'getLogLines')
      .mockReturnValue(['foo', 'bar', 'timestamp|USER_DEBUG|[3]|DEBUG|Next message']);
  });

  afterEach(() => {
    warnToDebugConsoleStub.mockRestore();
    getLogLinesStub.mockRestore();
  });

  it('Should not print without any frames', () => {
    const state = new UserDebugState(['timestamp', 'USER_DEBUG', '2', 'DEBUG', 'Hello']);

    expect(state.handle(context)).toBe(false);
    expect(context.getFrames()).toHaveLength(0);
    expect(warnToDebugConsoleStub).toHaveBeenCalledTimes(0);
  });

  it('Should link to anonymous specific frame', () => {
    const frame = {
      name: EXEC_ANON_SIGNATURE,
      source: new Source('foo.log')
    } as StackFrame;
    context.getFrames().push(frame);
    context.getExecAnonScriptMapping().set(2, 5);
    const state = new UserDebugState(['timestamp', 'USER_DEBUG', '2', 'DEBUG', 'Hello']);

    expect(state.handle(context)).toBe(false);
    expect(warnToDebugConsoleStub).toHaveBeenCalledTimes(1);
    expect(warnToDebugConsoleStub.mock.calls[0][0]).toEqual(`Hello${EOL}foo${EOL}bar`);
    expect(warnToDebugConsoleStub.mock.calls[0][1]).toEqual(frame.source);
    expect(warnToDebugConsoleStub.mock.calls[0][2]).toEqual(5);
  });

  it('Should use line number in log line', () => {
    const frame = {
      name: 'foo',
      source: new Source('foo.log')
    } as StackFrame;
    context.getFrames().push(frame);
    const state = new UserDebugState(['timestamp', 'USER_DEBUG', '2', 'DEBUG', 'Hello']);

    expect(state.handle(context)).toBe(false);
    expect(warnToDebugConsoleStub).toHaveBeenCalledTimes(1);
    expect(warnToDebugConsoleStub.mock.calls[0][0]).toEqual(`Hello${EOL}foo${EOL}bar`);
    expect(warnToDebugConsoleStub.mock.calls[0][1]).toEqual(frame.source);
    expect(warnToDebugConsoleStub.mock.calls[0][2]).toEqual(2);
  });
});
