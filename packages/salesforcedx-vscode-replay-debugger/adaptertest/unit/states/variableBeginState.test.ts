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
describe('Variable begin scope event', () => {
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
    getStaticMapStub = sinon
      .stub(LogContext.prototype, 'getStaticVariablesClassMap')
      .returns(map);
  });

  afterEach(() => {
    getStaticMapStub.restore();
  });

  it('Should add static variable to frame', () => {
    //
  });

  it('Should add local variable to frame', () => {
    //
  });

  it('Should create class entry in static variable map when class has not been seen before', () => {
    //
  });
});
