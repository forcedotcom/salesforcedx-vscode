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
import * as sinon from 'sinon';
import { URI } from 'vscode-uri';
import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { ApexVariable } from '../../../src/adapter/ApexVariable';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { LogContext } from '../../../src/core';
import { FrameEntryState, VariableBeginState } from '../../../src/states';

describe('Variable begin scope event', () => {
  let getUriFromSignatureStub: sinon.SinonStub;
  let getStaticMapStub: sinon.SinonStub;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const uriFromSignature = 'file:///path/foo.cls';
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true,
    projectPath: undefined
  };
  const STATIC_VARIABLE_LOG_LINE = 'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|fakeClass.staticInteger|Integer|false|true';
  const LOCAL_VARIABLE_LOG_LINE = 'fakeTime|VARIABLE_SCOPE_BEGIN|[38]|localInteger|Integer|false|false';
  let map: Map<string, Map<string, ApexVariable>>;

  beforeEach(() => {
    map = new Map<string, Map<string, ApexVariable>>();
    map.set('fakeClass', new Map<string, ApexVariable>());
    getUriFromSignatureStub = sinon.stub(LogContext.prototype, 'getUriFromSignature').returns(uriFromSignature);
    getStaticMapStub = sinon.stub(LogContext.prototype, 'getStaticVariablesClassMap').returns(map);
  });

  afterEach(() => {
    getUriFromSignatureStub.restore();
    getStaticMapStub.restore();
  });

  it('Should add static variable to frame', () => {
    const entryState = new VariableBeginState(STATIC_VARIABLE_LOG_LINE.split('|'));
    const context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.getFrames().push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);

    expect(entryState.handle(context)).toBe(false);
    expect(context.getStaticVariablesClassMap().has('fakeClass')).toBe(true);
    expect(context.getStaticVariablesClassMap().get('fakeClass')!.size).toBe(1);
    expect(context.getStaticVariablesClassMap().get('fakeClass')?.has('staticInteger')).toBe(true);
  });

  it('Should add local variable to frame', () => {
    const state = new FrameEntryState(['signature']);
    const context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.getFrames().push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);

    expect(state.handle(context)).toBe(false);

    const frames = context.getFrames();
    expect(context.getNumOfFrames()).toBe(2);
    expect(frames[1]).toEqual({
      id: 1000,
      line: 0,
      column: 0,
      name: 'signature',
      source: {
        name: 'foo.cls',
        path: URI.parse(uriFromSignature).fsPath,
        sourceReference: 0
      }
    } as StackFrame);
    const entryState = new VariableBeginState(LOCAL_VARIABLE_LOG_LINE.split('|'));
    expect(entryState.handle(context)).toBe(false);
    const id = context.getTopFrame()!.id;
    const frameInfo = context.getFrameHandler().get(id);
    expect(frameInfo.locals.size).toBe(1);
    expect(frameInfo.locals.has('localInteger')).toBe(true);
    expect(frameInfo.locals.get('localInteger')).toMatchObject({
      name: 'localInteger',
      type: 'Integer'
    });
  });

  it('Should create class entry in static variable map when class has not been seen before', () => {
    const entryState = new VariableBeginState(STATIC_VARIABLE_LOG_LINE.split('|'));
    const context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.getFrames().push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);

    expect(entryState.handle(context)).toBe(false);
    expect(context.getStaticVariablesClassMap().has('fakeClass')).toBe(true);
    expect(context.getStaticVariablesClassMap().get('fakeClass')!.size).toBe(1);
    expect(context.getStaticVariablesClassMap().get('fakeClass')?.has('staticInteger')).toBe(true);
  });
});
