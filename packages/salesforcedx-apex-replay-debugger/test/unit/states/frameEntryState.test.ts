/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock DebugSession.run to prevent it from executing during tests
vi.mock(import('@vscode/debugadapter'), async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    DebugSession: Object.assign(actual.DebugSession, { run: vi.fn() })
  };
});

import type { MockInstance as VitestMockInstance } from 'vitest';
import { type StackFrame } from '@vscode/debugadapter';
import { URI } from 'vscode-uri';
import { ApexReplayDebug } from '../../../src/adapter/apexReplayDebug';
import { type LaunchRequestArguments } from '../../../src/adapter/types';
import { ApexVariableContainer } from '../../../src/adapter/variableContainer';
import { breakpointUtil } from '../../../src/breakpoints';
import { LogContext } from '../../../src/core';
import { FrameEntryState } from '../../../src/states';

describe('Frame entry event', () => {
  let getUriFromSignatureStub: VitestMockInstance;
  let getStaticMapStub: VitestMockInstance;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const uriFromSignature = 'file:///path/foo.cls';
  const launchRequestArgs: LaunchRequestArguments = {
    logFileContents: 'test log content',
    logFilePath,
    logFileName,
    trace: true
  };
  let map: Map<string, Map<string, ApexVariableContainer>>;

  beforeEach(() => {
    const variableMap = new Map<string, ApexVariableContainer>([
      ['var1', new ApexVariableContainer('var1', '0', 'Integer')]
    ]);
    map = new Map<string, Map<string, ApexVariableContainer>>([['previousClass', variableMap]]);
    getUriFromSignatureStub = vi.spyOn(LogContext.prototype, 'getUriFromSignature').mockReturnValue(uriFromSignature);
    getStaticMapStub = vi.spyOn(LogContext.prototype, 'getStaticVariablesClassMap').mockReturnValue(map);
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
        path: uriFromSignature,
        sourceReference: 0
      }
    } as StackFrame);
    expect(context.getStaticVariablesClassMap().has('signature')).toBe(true);
    expect(context.getStaticVariablesClassMap().get('signature')!.size).toBe(0);
  });

  it('Should preserve a Windows filesystem path', () => {
    const windowsFilePath = String.raw`C:\work\Foo.cls`;
    getUriFromSignatureStub.mockReturnValue(windowsFilePath);
    const state = new FrameEntryState(['signature']);
    const context = new LogContext(launchRequestArgs, new ApexReplayDebug());

    expect(state.handle(context)).toBe(false);

    expect(context.getFrames()[0].source).toEqual({
      name: 'Foo.cls',
      path: URI.file('C:/work/Foo.cls').toString(),
      sourceReference: 0
    });
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
        path: uriFromSignature,
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
        path: uriFromSignature,
        sourceReference: 0
      }
    } as StackFrame);
    expect(Array.from(context.getStaticVariablesClassMap().keys())).toContain('previousClass');
    expect(context.getStaticVariablesClassMap().get('previousClass')).toEqual(map.get('previousClass'));
  });
});

describe('Resolved frame sources', () => {
  const args: LaunchRequestArguments = {
    logFileContents: '',
    logFilePath: '/logs/replay.log',
    logFileName: 'replay.log'
  };

  beforeEach(() => breakpointUtil.createMappingsFromLineBreakpointInfo([]));
  afterEach(() => breakpointUtil.createMappingsFromLineBreakpointInfo([]));

  it('preserves the complete org URI for nested-class source', () => {
    const uri = 'sf-org-metadata:/orgs/00D000000000001/ApexClass/Outer.cls?version=1#source';
    const context = new LogContext({ ...args, sourceUriMapping: { Outer: uri } }, new ApexReplayDebug());
    new FrameEntryState('time|METHOD_ENTRY|[1]|01p|Outer.Inner.run()'.split('|')).handle(context);

    expect(context.getTopFrame()?.source).toMatchObject({ name: 'Outer.cls', path: uri });
  });

  it('uses the workspace typeref mapping before catalog source without changing breakpoint lines', () => {
    const lineBreakpointInfo = [{ typeref: 'ns/Outer$Inner', uri: 'memfs:/workspace/Outer.cls', lines: [3, 8] }];
    breakpointUtil.createMappingsFromLineBreakpointInfo(lineBreakpointInfo);
    const context = new LogContext(
      { ...args, sourceUriMapping: { 'ns.Outer': 'sf-org-metadata:/orgs/00D/ApexClass/Outer.cls' } },
      new ApexReplayDebug()
    );
    new FrameEntryState('time|CONSTRUCTOR_ENTRY|[1]|01p|<init>()|ns/Outer.Inner'.split('|')).handle(context);

    expect(context.getTopFrame()?.source?.path).toBe('memfs:/workspace/Outer.cls');
    expect(breakpointUtil.getLineNumberMapping().get(lineBreakpointInfo[0].uri)).toEqual([3, 8]);
    expect(breakpointUtil.getTyperefMapping().size).toBe(1);
  });

  it('omits Source when neither workspace nor catalog resolves the type', () => {
    const context = new LogContext(args, new ApexReplayDebug());
    new FrameEntryState('time|METHOD_ENTRY|[1]|01p|Missing.run()'.split('|')).handle(context);

    expect(context.getTopFrame()?.source).toBeUndefined();
    expect(JSON.stringify(context.getTopFrame())).not.toContain('"source"');
  });

  it.each(['__sfdc_trigger/ns/MyTrigger', '__sfdc_trigger/ns/MyTrigger$Inner'])(
    'resolves trigger %s through the catalog mapping',
    signature => {
      const uri = 'sf-org-metadata:/orgs/00D/ApexTrigger/ns.MyTrigger.trigger';
      const context = new LogContext(
        { ...args, sourceUriMapping: { '__sfdc_trigger/ns/MyTrigger': uri } },
        new ApexReplayDebug()
      );
      new FrameEntryState(`time|CODE_UNIT_STARTED|[EXTERNAL]|01q|${signature}`.split('|')).handle(context);

      expect(context.getTopFrame()?.source?.path).toBe(uri);
      expect(context.isRunningApexTrigger()).toBe(true);
    }
  );
});
