/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { StackFrame } from 'vscode-debugadapter';
import Uri from 'vscode-uri';
import {
  ApexReplayDebug,
  ApexVariable,
  LaunchRequestArguments
} from '../../../src/adapter/apexReplayDebug';
import { LogContext } from '../../../src/core';
import { FrameEntryState, VariableBeginState } from '../../../src/states';

// tslint:disable:no-unused-expression
describe('Variable begin scope event', () => {
  let getStaticMapStub: sinon.SinonStub;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const uriFromSignature = 'file:///path/foo.cls';
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true
  };
  const staticVarLogLine =
    'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|fakeClass.staticInteger|5|false|true';
  const newStaticVarLogLine =
    'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|anotherFakeClass.staticInteger|5|false|true';
  const localVarLogLine =
    'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|localInteger|10|false|false';
  let map: Map<String, Map<String, ApexVariable>>;

  beforeEach(() => {
    map = new Map<String, Map<String, ApexVariable>>();
    map.set('fakeClass', new Map<String, ApexVariable>());
    getStaticMapStub = sinon
      .stub(LogContext.prototype, 'getStaticVariablesClassMap')
      .returns(map);
  });

  afterEach(() => {
    getStaticMapStub.restore();
  });

  it('Should add static variable to frame', () => {
    const entryState = new VariableBeginState(staticVarLogLine.split('|'));
    const context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context
      .getFrames()
      .push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);

    expect(entryState.handle(context)).to.be.false;
    expect(context.getStaticVariablesClassMap().has('fakeClass')).to.be.true;
    expect(
      context.getStaticVariablesClassMap().get('fakeClass')!.size
    ).to.equal(1);
    expect(context.getStaticVariablesClassMap().get('fakeClass')).to.have.key(
      'fakeClass.staticInteger'
    );
  });

  it('Should add local variable to frame', () => {
    const entryState = new VariableBeginState(localVarLogLine.split('|'));
    const context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context
      .getFrames()
      .push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);

    expect(entryState.handle(context)).to.be.false;
    expect(context.getStaticVariablesClassMap().has('fakeClass')).to.be.true;
    expect(
      context.getStaticVariablesClassMap().get('fakeClass')!.size
    ).to.equal(1);
    expect(context.getStaticVariablesClassMap().get('fakeClass')).to.have.key(
      'fakeClass.localInteger'
    );
  });

  it('Should create class entry in static variable map when class has not been seen before', () => {
    const entryState = new VariableBeginState(staticVarLogLine.split('|'));
    const context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context
      .getFrames()
      .push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);

    expect(entryState.handle(context)).to.be.false;
    expect(context.getStaticVariablesClassMap().has('fakeClass')).to.be.true;
    expect(
      context.getStaticVariablesClassMap().get('fakeClass')!.size
    ).to.equal(1);
    expect(context.getStaticVariablesClassMap().get('fakeClass')).to.have.key(
      'fakeClass.staticInteger'
    );
  });
});
