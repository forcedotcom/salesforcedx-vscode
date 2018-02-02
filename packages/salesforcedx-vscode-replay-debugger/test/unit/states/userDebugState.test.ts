/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { EOL } from 'os';
import * as sinon from 'sinon';
import { StackFrame } from 'vscode-debugadapter';
import {
  ApexReplayDebug,
  LaunchRequestArguments
} from '../../../src/adapter/apexReplayDebug';
import { EXEC_ANON_SIGNATURE } from '../../../src/constants';
import { LogContext } from '../../../src/core';
import { UserDebugState } from '../../../src/states';

// tslint:disable:no-unused-expression
describe('User debug event', () => {
  let warnToDebugConsoleStub: sinon.SinonStub;
  let getLogLinesStub: sinon.SinonStub;
  let context: LogContext;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true
  };

  beforeEach(() => {
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    warnToDebugConsoleStub = sinon.stub(
      ApexReplayDebug.prototype,
      'warnToDebugConsole'
    );
    getLogLinesStub = sinon
      .stub(LogContext.prototype, 'getLogLines')
      .returns(['foo', 'bar', 'timestamp|USER_DEBUG|[3]|DEBUG|Next message']);
  });

  afterEach(() => {
    warnToDebugConsoleStub.restore();
    getLogLinesStub.restore();
  });

  it('Should not print without any frames', () => {
    const state = new UserDebugState([
      'timestamp',
      'USER_DEBUG',
      '2',
      'DEBUG',
      'Hello'
    ]);

    expect(state.handle(context)).to.be.false;
    expect(context.getFrames()).to.be.empty;
    expect(warnToDebugConsoleStub.called).to.be.false;
  });

  it('Should link to anonymous specific frame', () => {
    const frame = {
      name: EXEC_ANON_SIGNATURE,
      source: { name: 'foo.log' }
    } as StackFrame;
    context.getFrames().push(frame);
    context.getExecAnonScriptMapping().set(2, 5);
    const state = new UserDebugState([
      'timestamp',
      'USER_DEBUG',
      '2',
      'DEBUG',
      'Hello'
    ]);

    expect(state.handle(context)).to.be.false;
    expect(warnToDebugConsoleStub.calledOnce).to.be.true;
    expect(warnToDebugConsoleStub.getCall(0).args).to.have.same.members([
      `Hello${EOL}foo${EOL}bar`,
      frame.source,
      5
    ]);
  });

  it('Should use line number in log line', () => {
    const frame = {
      name: 'foo',
      source: { name: 'foo.cls' }
    } as StackFrame;
    context.getFrames().push(frame);
    const state = new UserDebugState([
      'timestamp',
      'USER_DEBUG',
      '2',
      'DEBUG',
      'Hello'
    ]);

    expect(state.handle(context)).to.be.false;
    expect(warnToDebugConsoleStub.calledOnce).to.be.true;
    expect(warnToDebugConsoleStub.getCall(0).args).to.have.same.members([
      `Hello${EOL}foo${EOL}bar`,
      frame.source,
      2
    ]);
  });
});
