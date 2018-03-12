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
import { FrameEntryState } from '../../../src/states';

// tslint:disable:no-unused-expression
describe('Frame entry event', () => {
  let getUriFromSignatureStub: sinon.SinonStub;
  let getStaticMapStub: sinon.SinonStub;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const uriFromSignature = 'file:///path/foo.cls';
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true
  };
  let map: Map<String, Map<String, ApexVariable>>;

  beforeEach(() => {
    map = new Map<String, Map<String, ApexVariable>>();
    map.set('previousClass', new Map<String, ApexVariable>());
    map.get('previousClass')!.set(
      'var1',
      new ApexVariable('var1', '0', 'Integer')
    );
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

  it('Should add a frame', () => {
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
    expect(context.getStaticVariablesClassMap().has('signature')).to.be.true;
    expect(
      context.getStaticVariablesClassMap().get('signature')!.size
    ).to.equal(0);
  });

  it('Should parse the class name from method signature and add it to static variable map', () => {
    const state = new FrameEntryState(['className.method']);
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
      name: 'className.method',
      source: {
        name: 'foo.cls',
        path: Uri.parse(uriFromSignature).fsPath,
        sourceReference: 0
      }
    } as StackFrame);
    expect(context.getStaticVariablesClassMap().has('className')).to.be.true;
    expect(
      context.getStaticVariablesClassMap().get('className')!.size
    ).to.equal(0);
  });

  it('Should reuse static variables for a new frame if class has been previously seen', () => {
    const state = new FrameEntryState(['previousClass.seenBefore']);
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
      name: 'previousClass.seenBefore',
      source: {
        name: 'foo.cls',
        path: Uri.parse(uriFromSignature).fsPath,
        sourceReference: 0
      }
    } as StackFrame);
    expect(context.getStaticVariablesClassMap().has('previousClass')).to.be
      .true;
    expect(
      context.getStaticVariablesClassMap().get('previousClass')!.size
    ).to.equal(1);
  });
});
