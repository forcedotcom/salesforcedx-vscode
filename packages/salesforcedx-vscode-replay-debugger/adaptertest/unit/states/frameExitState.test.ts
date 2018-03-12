/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { StackFrame } from 'vscode-debugadapter';
import {
  ApexReplayDebug,
  LaunchRequestArguments
} from '../../../src/adapter/apexReplayDebug';
import { LogContext } from '../../../src/core';
import { FrameExitState } from '../../../src/states';

// tslint:disable:no-unused-expression
describe('Frame exit event', () => {
  let context: LogContext;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true
  };

  beforeEach(() => {
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
  });

  it('Should not remove anything if there are no frames', () => {
    const state = new FrameExitState(['signature']);

    expect(state.handle(context)).to.be.false;
  });

  it('Should not remove if signature does not match top frame', () => {
    context.getFrames().push({ name: 'signature' } as StackFrame);

    const state = new FrameExitState(['signatureFoo']);

    expect(state.handle(context)).to.be.false;
    expect(context.getFrames()).to.be.empty;
  });

  it('Should remove if signature matches top frame exactly', () => {
    context.getFrames().push({ name: 'signature' } as StackFrame);

    const state = new FrameExitState(['signature']);

    expect(state.handle(context)).to.be.false;
    expect(context.getFrames()).to.be.empty;
  });

  it('Should remove if signature matches top frame partially', () => {
    context.getFrames().push({ name: 'signature' } as StackFrame);

    const state = new FrameExitState(['sign']);

    expect(state.handle(context)).to.be.false;
    expect(context.getFrames()).to.be.empty;
  });
});
