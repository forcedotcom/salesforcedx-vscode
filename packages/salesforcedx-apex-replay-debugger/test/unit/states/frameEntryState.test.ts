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
import { URI } from 'vscode-uri';
import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { ApexVariableContainer } from '../../../src/adapter/VariableContainer';
import { LogContext } from '../../../src/core';
import { FrameEntryState } from '../../../src/states';

describe('Frame entry event', () => {
  let getUriFromSignatureStub: jest.SpyInstance;
  let getStaticMapStub: jest.SpyInstance;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const uriFromSignature = 'file:///path/foo.cls';
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true,
    projectPath: undefined
  };
  let map: Map<string, Map<string, ApexVariableContainer>>;

  beforeEach(() => {
    const variableMap = new Map<string, ApexVariableContainer>();
    variableMap.set('var1', new ApexVariableContainer('var1', '0', 'Integer'));
    map = new Map<string, Map<string, ApexVariableContainer>>();
    map.set('previousClass', variableMap);
    getUriFromSignatureStub = jest.spyOn(LogContext.prototype, 'getUriFromSignature').mockReturnValue(uriFromSignature);
    getStaticMapStub = jest.spyOn(LogContext.prototype, 'getStaticVariablesClassMap').mockReturnValue(map);
  });

  afterEach(() => {
    getUriFromSignatureStub.mockRestore();
    getStaticMapStub.mockRestore();
  });

  it('Should add a frame', () => {
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
    expect(context.getStaticVariablesClassMap().has('signature')).toBe(true);
    expect(context.getStaticVariablesClassMap().get('signature')!.size).toBe(0);
  });

  it('Should parse the class name from method signature and add it to static variable map', () => {
    const state = new FrameEntryState(['className.method']);
    const context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.getFrames().push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);

    expect(state.handle(context)).toBe(false);

    const frames = context.getFrames();
    expect(context.getNumOfFrames()).toBe(2);
    expect(frames[1]).toEqual({
      id: 1000,
      line: 0,
      column: 0,
      name: 'className.method',
      source: {
        name: 'foo.cls',
        path: URI.parse(uriFromSignature).fsPath,
        sourceReference: 0
      }
    } as StackFrame);
    expect(Array.from(context.getStaticVariablesClassMap().keys())).toContain('className');
    expect(context.getStaticVariablesClassMap().get('className')!.size).toBe(0);
  });

  it('Should use existing static variables when the entry is for a class that was seen earlier', () => {
    const state = new FrameEntryState(['previousClass.seenBefore']);
    const context = new LogContext(launchRequestArgs, new ApexReplayDebug());
    context.getFrames().push({ id: 0, name: 'execute_anonymous_apex' } as StackFrame);

    expect(state.handle(context)).toBe(false);

    const frames = context.getFrames();
    expect(context.getNumOfFrames()).toBe(2);
    expect(frames[1]).toEqual({
      id: 1000,
      line: 0,
      column: 0,
      name: 'previousClass.seenBefore',
      source: {
        name: 'foo.cls',
        path: URI.parse(uriFromSignature).fsPath,
        sourceReference: 0
      }
    } as StackFrame);
    expect(Array.from(context.getStaticVariablesClassMap().keys())).toContain('previousClass');
    expect(context.getStaticVariablesClassMap().get('previousClass')).toEqual(map.get('previousClass'));
  });
});
