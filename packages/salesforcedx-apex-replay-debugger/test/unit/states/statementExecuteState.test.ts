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

import { StackFrame } from '@vscode/debugadapter';
import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { EXEC_ANON_SIGNATURE } from '../../../src/constants';
import { LogContext } from '../../../src/core';
import { StatementExecuteState } from '../../../src/states';

describe('Statement execute event', () => {
  let context: LogContext;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true,
    projectPath: undefined
  };

  beforeEach(async () => {
    context = await LogContext.create(launchRequestArgs, new ApexReplayDebug());
  });

  it('Should not update frame without any frames', () => {
    const state = new StatementExecuteState(['1']);

    expect(state.handle(context)).toBe(true);
    expect(context.getFrames()).toHaveLength(0);
  });

  it('Should update top frame', () => {
    context.getFrames().push({ name: 'foo' } as StackFrame);
    const state = new StatementExecuteState(['2']);

    expect(state.handle(context)).toBe(true);
    expect(context.getFrames()[0].line).toBe(2);
  });

  it('Should update execute anonymous specific frame', () => {
    context.getFrames().push({ name: EXEC_ANON_SIGNATURE } as StackFrame);
    context.getExecAnonScriptMapping().set(2, 5);
    const state = new StatementExecuteState(['2']);

    expect(state.handle(context)).toBe(true);
    expect(context.getFrames()[0].line).toBe(5);
  });
});
