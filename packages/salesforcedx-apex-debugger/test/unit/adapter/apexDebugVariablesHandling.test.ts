/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  OutputEvent,
  Source,
  StackFrame,
  StoppedEvent,
  ThreadEvent
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import {
  ApexDebugStackFrameInfo,
  ApexVariable,
  ApexVariableKind
} from '../../../src/adapter/apexDebug';
import {
  LineBreakpointInfo,
  LineBreakpointsInTyperef
} from '../../../src/breakpoints/lineBreakpoint';
import { Value, LocalValue } from '../../../src/commands';
import {
  GET_LINE_BREAKPOINT_INFO_EVENT,
  HOTSWAP_REQUEST,
  LINE_BREAKPOINT_INFO_REQUEST,
  SHOW_MESSAGE_EVENT
} from '../../../src/constants';
import {
  ApexDebuggerEventType,
  BreakpointService,
  DebuggerMessage,
  SessionService,
  StreamingClientInfo,
  StreamingEvent,
  StreamingService
} from '../../../src/core';
import {
  VscodeDebuggerMessage,
  VscodeDebuggerMessageType
} from '../../../src/index';
import { nls } from '../../../src/messages';
import { ApexDebugForTest } from './apexDebugForTest';
import os = require('os');

describe('Debugger adapter variable handling - unit', () => {
  describe('ApexVariable', () => {
    let value: Value;
    let variable: ApexVariable;

    beforeEach(() => {
      value = {
        name: 'name',
        nameForMessages: 'nameForMessages',
        declaredTypeRef: 'declaredTypeRef',
        value: 'value'
      };
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
    });

    it('Should use proper values from Value', async () => {
      expect(variable.name).to.equal(value.name);
      expect(variable.declaredTypeRef).to.equal(value.declaredTypeRef);
      expect(variable.value).to.equal(value.value);
      expect(variable.variablesReference).to.equal(20);
      expect(variable['kind']).to.equal(ApexVariableKind.Local);
    });

    it('Should set slot to MAX integer for non local value', async () => {
      expect(variable['slot']).to.equal(Number.MAX_SAFE_INTEGER);
    });

    it('Should set slot to specific value for LocalValue', async () => {
      const localvalue: LocalValue = {
        name: 'name',
        nameForMessages: 'nameForMessages',
        declaredTypeRef: 'declaredTypeRef',
        value: 'value',
        slot: 15
      };
      variable = new ApexVariable(localvalue, ApexVariableKind.Local, 20);
      expect(variable['slot']).to.equal(localvalue.slot);
    });
  });
});
