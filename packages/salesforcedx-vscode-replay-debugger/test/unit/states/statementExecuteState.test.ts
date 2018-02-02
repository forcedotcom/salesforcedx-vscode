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
import { EXEC_ANON_SIGNATURE } from '../../../src/constants';
import { LogContext } from '../../../src/core';
import { StatementExecuteState } from '../../../src/states';

// tslint:disable:no-unused-expression
describe('Statement execute event', () => {
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

  it('Should not update frame without any frames', () => {
    const state = new StatementExecuteState(['1']);

    expect(state.handle(context)).to.be.true;
    expect(context.getFrames()).to.be.empty;
  });

  it('Should update top frame', () => {
    context.getFrames().push({ name: 'foo' } as StackFrame);
    const state = new StatementExecuteState(['2']);

    expect(state.handle(context)).to.be.true;
    expect(context.getFrames()[0].line).to.equal(2);
  });

  it('Should update execute anonymous specific frame', () => {
    context.getFrames().push({ name: EXEC_ANON_SIGNATURE } as StackFrame);
    context.getExecAnonScriptMapping().set(2, 5);
    const state = new StatementExecuteState(['2']);

    expect(state.handle(context)).to.be.true;
    expect(context.getFrames()[0].line).to.equal(5);
  });
});
