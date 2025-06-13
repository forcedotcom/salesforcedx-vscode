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
import { LogContext } from '../../../src/core';
import { FrameExitState } from '../../../src/states';

describe('Frame exit event', () => {
  let context: LogContext;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true,
    projectPath: undefined
  };

  beforeEach(() => {
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
  });

  it('Should not remove anything if there are no frames', () => {
    const state = new FrameExitState(['signature']);

    expect(state.handle(context)).toBe(false);
  });

  it('Should not remove if signature does not match top frame', () => {
    context.getFrames().push({ name: 'signature' } as StackFrame);

    const state = new FrameExitState(['signatureFoo']);

    expect(state.handle(context)).toBe(false);
    expect(context.getFrames()).toHaveLength(0);
  });

  it('Should remove if signature matches top frame exactly', () => {
    context.getFrames().push({ name: 'signature' } as StackFrame);

    const state = new FrameExitState(['signature']);

    expect(state.handle(context)).toBe(false);
    expect(context.getFrames()).toHaveLength(0);
  });

  it('Should remove if signature matches top frame partially', () => {
    context.getFrames().push({ name: 'signature' } as StackFrame);

    const state = new FrameExitState(['sign']);

    expect(state.handle(context)).toBe(false);
    expect(context.getFrames()).toHaveLength(0);
  });
});
