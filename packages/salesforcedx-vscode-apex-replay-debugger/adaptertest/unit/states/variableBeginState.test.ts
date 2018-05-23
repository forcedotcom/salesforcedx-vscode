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
  let getUriFromSignatureStub: sinon.SinonStub;
  let getStaticMapStub: sinon.SinonStub;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const uriFromSignature = 'file:///path/foo.cls';
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true
  };
  const STATIC_VARIABLE_LOG_LINE =
    'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|fakeClass.staticInteger|Integer|false|true';
  const LOCAL_VARIABLE_LOG_LINE =
    'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|localInteger|Integer|false|false';
  let map: Map<string, Map<string, ApexVariable>>;

  beforeEach(() => {
    map = new Map<string, Map<string, ApexVariable>>();
    map.set('fakeClass', new Map<string, ApexVariable>());
    getUriFromSignatureStub = sinon
      .stub(LogContext.prototype, 'getUriFromSignature')
      .returns(uriFromSignature);
    getStaticMapStub = sinon
      .stub(LogContext.prototype, 'getStaticVariablesClassMap')
      .returns(map);
  });

  afterEach(() => {
    getUriFromSignatureStub.restore();
    getStaticMapStub.restore();
  });

  it('Should add static variable to frame', () => {
    const entryState = new VariableBeginState(
      STATIC_VARIABLE_LOG_LINE.split('|')
    );
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
      'staticInteger'
    );
  });

  it('Should add local variable to frame', () => {
    const state = new FrameEntryState(['signature']);
    const context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context
      .getFrames()
      .push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);

    expect(state.handle(context)).to.be.false;

    const frames = context.getFrames();
    expect(context.getNumOfFrames()).to.equal(2);
    expect(frames[1]).to.deep.equal({
      id: 1000,
      line: 0,
      column: 0,
      name: 'signature',
      source: {
        name: 'foo.cls',
        path: Uri.parse(uriFromSignature).fsPath,
        sourceReference: 0
      }
    } as StackFrame);
    const entryState = new VariableBeginState(
      LOCAL_VARIABLE_LOG_LINE.split('|')
    );
    expect(entryState.handle(context)).to.be.false;
    const id = context.getTopFrame()!.id;
    const frameInfo = context.getFrameHandler().get(id);
    expect(frameInfo.locals.size).to.equal(1);
    expect(frameInfo.locals.has('localInteger')).to.be.true;
    expect(frameInfo.locals.get('localInteger')).to.include({
      name: 'localInteger',
      type: 'Integer'
    });
  });

  it('Should create class entry in static variable map when class has not been seen before', () => {
    const entryState = new VariableBeginState(
      STATIC_VARIABLE_LOG_LINE.split('|')
    );
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
      'staticInteger'
    );
  });
});
