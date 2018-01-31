/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { StackFrame } from 'vscode-debugadapter';
import { LaunchRequestArguments } from '../../../src/adapter/apexReplayDebug';
import { BreakpointUtil } from '../../../src/breakpoints';
import { LogContext } from '../../../src/core';
import { FrameEntryState } from '../../../src/states';

// tslint:disable:no-unused-expression
describe('Frame entry event', () => {
  let getUriFromSignatureStub: sinon.SinonStub;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true
  };

  beforeEach(() => {
    getUriFromSignatureStub = sinon
      .stub(LogContext.prototype, 'getUriFromSignature')
      .returns('file:///path/foo.cls');
  });

  afterEach(() => {
    getUriFromSignatureStub.restore();
  });

  it('Should add a frame', () => {
    const state = new FrameEntryState(['signature']);
    const context = new LogContext(launchRequestArgs, new BreakpointUtil());
    context
      .getFrames()
      .push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);

    expect(state.handle(context)).to.be.false;

    const frames = context.getFrames();
    expect(context.getNumOfFrames()).to.equal(2);
    expect(frames[1]).to.deep.equal({
      id: 1,
      line: 0,
      column: 0,
      name: 'signature',
      source: {
        name: 'foo.cls',
        path: '/path/foo.cls',
        sourceReference: 0
      }
    } as StackFrame);
  });
});
