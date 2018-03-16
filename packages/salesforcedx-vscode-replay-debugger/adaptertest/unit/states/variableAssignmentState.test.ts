/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { StackFrame } from 'vscode-debugadapter';
import {
  ApexReplayDebug,
  LaunchRequestArguments
} from '../../../src/adapter/apexReplayDebug';
import { LogContext } from '../../../src/core';
import {
  FrameEntryState,
  VariableAssignmentState,
  VariableBeginState
} from '../../../src/states';

// tslint:disable:no-unused-expression
describe('Variable assignment event', () => {
  let getUriFromSignatureStub: sinon.SinonStub;
  let context: LogContext;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const uriFromSignature = 'file:///path/foo.cls';
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true
  };

  const STATIC_VARIABLE_BEGIN_LOG_LINE =
    'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|signature.staticInteger|Integer|false|true';
  const LOCAL_VARIABLE_BEGIN_LOG_LINE =
    'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|localInteger|Integer|false|false';
  const STATIC_VARIABLE_ASSIGNMENT_LOG_LINE =
    'fakeTime|VARIABLE_ASSIGNMENT|[5]|signature.staticInteger|5';
  const LOCAL_VARIABLE_ASSIGNEMENT_LOG_LINE =
    'fakeTime|VARIABLE_ASSIGNMENT|[5]|localInteger|0';

  beforeEach(() => {
    // push frames on
    const state = new FrameEntryState(['signature']);
    context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context
      .getFrames()
      .push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);
    expect(state.handle(context)).to.be.false;

    // add begin states for a local and static variable
    let beginState = new VariableBeginState(
      STATIC_VARIABLE_BEGIN_LOG_LINE.split('|')
    );
    beginState.handle(context);
    beginState = new VariableBeginState(
      LOCAL_VARIABLE_BEGIN_LOG_LINE.split('|')
    );
    beginState.handle(context);
    getUriFromSignatureStub = sinon
      .stub(LogContext.prototype, 'getUriFromSignature')
      .returns(uriFromSignature);
  });

  afterEach(() => {
    getUriFromSignatureStub.restore();
  });

  it('Should assign static variable for class', () => {
    const state = new VariableAssignmentState(
      STATIC_VARIABLE_ASSIGNMENT_LOG_LINE.split('|')
    );
    // expect unassigned beforehand
    expect(context.getStaticVariablesClassMap().get('signature')).to.have.key(
      'signature.staticInteger'
    );
    expect(
      context.getStaticVariablesClassMap().get('signature')!.get(
        'signature.staticInteger'
      )
    ).to.include({
      name: 'staticInteger',
      value: ''
    });
    state.handle(context);

    expect(context.getStaticVariablesClassMap().get('signature')).to.have.key(
      'signature.staticInteger'
    );
    expect(
      context.getStaticVariablesClassMap().get('signature')!.get(
        'signature.staticInteger'
      )
    ).to.include({
      name: 'staticInteger',
      value: '5'
    });
  });

  it('Should add local variable to frame', () => {
    const state = new VariableAssignmentState(
      LOCAL_VARIABLE_ASSIGNEMENT_LOG_LINE.split('|')
    );
    // locals of frame should one entry
    const frameInfo = context.getFrameHandler().get(context.getTopFrame()!.id);
    expect(frameInfo.locals).to.have.key('localInteger');
    expect(frameInfo.locals.get('localInteger')).to.include({
      name: 'localInteger',
      value: ''
    });
    state.handle(context);

    expect(frameInfo.locals.get('localInteger')).to.include({
      name: 'localInteger',
      value: '0'
    });
  });
});
