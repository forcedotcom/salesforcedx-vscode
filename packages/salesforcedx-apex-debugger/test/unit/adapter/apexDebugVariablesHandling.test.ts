/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* tslint:disable:no-unused-expression */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import {
  ApexDebugStackFrameInfo,
  ApexVariable,
  ApexVariableKind,
  ObjectReferenceContainer
} from '../../../src/adapter/apexDebug';
import {
  LocalValue,
  OrgInfo,
  Reference,
  RequestService,
  Value
} from '../../../src/commands';
import { BreakpointService } from '../../../src/core/breakpointService';
import { SessionService } from '../../../src/core/sessionService';
import { StreamingService } from '../../../src/core/streamingService';
import { ApexDebugForTest } from './apexDebugForTest';

describe('Debugger adapter variable handling - unit', () => {
  describe('ApexVariable', () => {
    let value: Value;
    let variable: ApexVariable;

    beforeEach(() => {
      value = {
        name: 'variableName',
        nameForMessages: 'String',
        declaredTypeRef: 'java/lang/String',
        value: 'a string'
      };
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
    });

    it('Should use proper values from Value', async () => {
      expect(variable.name).to.equal(value.name);
      expect(variable.declaredTypeRef).to.equal(value.declaredTypeRef);
      expect(variable.value).to.equal(ApexVariable.valueAsString(value));
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

    it('Should correctly print null string as "null"', async () => {
      value.value = undefined;
      value.declaredTypeRef = 'java/lang/String';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal('null');
    });

    it('Should correctly print empty string', async () => {
      value.value = '';
      value.declaredTypeRef = 'java/lang/String';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal("''");
    });

    it('Should correctly print string', async () => {
      value.value = '123';
      value.declaredTypeRef = 'java/lang/String';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal("'123'");
    });

    it('Should correctly print value with type info', async () => {
      value.value = '123';
      value.nameForMessages = 'a-type';
      value.declaredTypeRef = 'a/specific/type';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal('123 [a-type]');
    });

    it('Should correctly print null with type info', async () => {
      value.value = undefined;
      value.nameForMessages = 'a-type';
      value.declaredTypeRef = 'a/specific/type';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal('null [a-type]');
    });

    it('Should compare Value of different kinds', async () => {
      // given
      const v1 = new ApexVariable(value, ApexVariableKind.Local);
      const v2 = new ApexVariable(value, ApexVariableKind.Static);

      // when
      const result = ApexVariable.compareVariables(v1, v2);

      // expect
      expect(result).to.not.equal(0);
      expect(result).to.equal(ApexVariableKind.Local - ApexVariableKind.Static);
    });

    it('Should compare Value of same kinds', async () => {
      // given
      const v1 = new ApexVariable(value, ApexVariableKind.Local);
      const v2 = new ApexVariable(value, ApexVariableKind.Local);

      // when
      const result = ApexVariable.compareVariables(v1, v2);

      // expect
      expect(result).to.equal(0);
    });

    it('Should compare based on slot for Local', async () => {
      // given
      const v1 = new ApexVariable(
        newStringValue('a_name', 'value', 10),
        ApexVariableKind.Local
      );
      const v2 = new ApexVariable(
        newStringValue('z_name', 'value', 9),
        ApexVariableKind.Local
      );

      // when
      const result1 = ApexVariable.compareVariables(v1, v2);
      const result2 = ApexVariable.compareVariables(v2, v1);

      // expect
      expect(result1).to.be.greaterThan(0); // slot 10 is greater than 9
      expect(result2).to.be.lessThan(0); // slot 9 is less than 10
    });

    it('Should compare based on slot for Field', async () => {
      // given
      const v1 = new ApexVariable(
        newStringValue('a_name', 'value', 10),
        ApexVariableKind.Field
      );
      const v2 = new ApexVariable(
        newStringValue('z_name', 'value', 9),
        ApexVariableKind.Field
      );

      // when
      const result1 = ApexVariable.compareVariables(v1, v2);
      const result2 = ApexVariable.compareVariables(v2, v1);

      // expect
      expect(result1).to.be.greaterThan(0); // slot 10 is greater than 9
      expect(result2).to.be.lessThan(0); // slot 9 is less than 10
    });

    it('Should compare based on name for others', async () => {
      // given
      const v1 = new ApexVariable(
        newStringValue('a_name', 'value'),
        ApexVariableKind.Static
      );
      const v2 = new ApexVariable(
        newStringValue('z_name', 'value'),
        ApexVariableKind.Static
      );

      // when
      const result1 = ApexVariable.compareVariables(v1, v2);
      const result2 = ApexVariable.compareVariables(v2, v1);

      // expect
      expect(result1).to.be.lessThan(0); // 'a...' before 'z...'
      expect(result2).to.be.greaterThan(0); // 'z...' after 'a...'
    });

    it('Should compare based on numbered name (eg. array index)', async () => {
      // given
      const v1 = new ApexVariable(
        newStringValue('[124]', 'value'),
        ApexVariableKind.Static
      );
      const v2 = new ApexVariable(
        newStringValue('123', 'value'),
        ApexVariableKind.Static
      );

      // when
      const result1 = ApexVariable.compareVariables(v1, v2);
      const result2 = ApexVariable.compareVariables(v2, v1);

      // expect
      expect(result1).to.be.greaterThan(0); // '[124]' after '123' (if [124] properly treated as number, see following test)
      expect(result2).to.be.lessThan(0); // '123' before '124'
    });

    it('Should compare numbered name with string', async () => {
      // given
      const v1 = new ApexVariable(
        newStringValue('12', 'value'),
        ApexVariableKind.Static
      );
      const v2 = new ApexVariable(
        newStringValue('a_name', 'value'),
        ApexVariableKind.Static
      );

      // when
      const result1 = ApexVariable.compareVariables(v1, v2);
      const result2 = ApexVariable.compareVariables(v2, v1);

      // expect
      expect(result1).to.be.greaterThan(0, 'numbers after names');
      expect(result2).to.be.lessThan(0), 'names before numbers';
    });
  });

  describe('populateReferences', () => {
    let adapter: ApexDebugForTest;

    it('Should expand object correctly', async () => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );

      const references: Reference[] = [
        {
          type: 'object',
          nameForMessages: 'Object',
          typeRef: 'Type',
          id: 0,
          fields: [
            {
              name: 'var',
              nameForMessages: 'varNameForMessages',
              value: 'varValue',
              declaredTypeRef: 'varDeclaredTypeRef',
              index: 0
            }
          ]
        }
      ];

      adapter.populateReferences(references, 'FakeRequestId');

      const variableRef = await adapter.resolveApexIdToVariableReference(
        'FakeRequestId',
        0
      );

      expect(variableRef).to.be.at.least(0);
      const container = adapter.getVariableContainer(variableRef as number);

      expect(container).to.be.ok;
      expect(container).to.be.instanceOf(ObjectReferenceContainer);
    });
  });

  describe('ApexDebugStackFrameInfo', () => {
    let stateSpy: sinon.SinonStub;
    let sourcePathSpy: sinon.SinonStub;
    let adapter: ApexDebugForTest;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      adapter.setSfdxProject('someProjectPath');
      adapter.setOrgInfo({
        instanceUrl: 'https://www.salesforce.com',
        accessToken: '123'
      } as OrgInfo);
      adapter.addRequestThread('07cFAKE');
    });

    afterEach(() => {
      stateSpy.restore();
      if (sourcePathSpy) {
        sourcePathSpy.restore();
      }
    });

    it('Should create as part of stackTraceRequest with variables info', async () => {
      // given
      const stateResponse: any = {
        stateResponse: {
          state: {
            stack: {
              stackFrame: [
                {
                  typeRef: 'FooDebug',
                  fullName: 'FooDebug.test()',
                  lineNumber: 1,
                  frameNumber: 0
                },
                {
                  typeRef: 'BarDebug',
                  fullName: 'BarDebug.test()',
                  lineNumber: 2,
                  frameNumber: 1
                }
              ]
            },
            locals: {
              local: [newStringValue('localvar1', 'value', 0)]
            },
            statics: {
              static: [newStringValue('staticvar1')]
            },
            globals: {
              global: [newStringValue('globalvar')]
            }
          }
        }
      };
      stateSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(Promise.resolve(JSON.stringify(stateResponse)));
      sourcePathSpy = sinon
        .stub(BreakpointService.prototype, 'getSourcePathFromTyperef')
        .returns('file:///foo.cls');

      // when
      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      // then
      expect(stateSpy.called).to.equal(true);
      const response = adapter.getResponse(
        0
      ) as DebugProtocol.StackTraceResponse;
      expect(response.success).to.equal(true);
      const stackFrames = response.body.stackFrames;
      expect(stackFrames.length).to.equal(2);
      expect(stackFrames[0].id).to.be.ok; // should have frame id
      const frameInfo = adapter.getStackFrameInfo(stackFrames[0].id);
      expect(frameInfo).to.be.ok; // should have frame info for frame id
      expect(frameInfo.locals).to.be.ok;
      expect(frameInfo.locals).to.deep.equal(
        stateResponse.stateResponse.state.locals.local
      );
      expect(frameInfo.statics).to.be.ok;
      expect(frameInfo.statics).to.deep.equal(
        stateResponse.stateResponse.state.statics.static
      );
      expect(frameInfo.globals).to.be.ok;
      expect(frameInfo.globals).to.deep.equal(
        stateResponse.stateResponse.state.globals.global
      );
    });

    it('Should create as part of stackTraceRequest without variables info', async () => {
      // given
      const stateResponse: any = {
        stateResponse: {
          state: {
            stack: {
              stackFrame: [
                {
                  typeRef: 'FooDebug',
                  fullName: 'FooDebug.test()',
                  lineNumber: 1,
                  frameNumber: 0
                },
                {
                  typeRef: 'BarDebug',
                  fullName: 'BarDebug.test()',
                  lineNumber: 2,
                  frameNumber: 1
                }
              ]
            }
          }
        }
      };
      stateSpy = sinon
        .stub(RequestService.prototype, 'execute')
        .returns(Promise.resolve(JSON.stringify(stateResponse)));
      sourcePathSpy = sinon
        .stub(BreakpointService.prototype, 'getSourcePathFromTyperef')
        .returns('file:///foo.cls');

      // when
      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      // then
      expect(stateSpy.called).to.equal(true);
      const response = adapter.getResponse(
        0
      ) as DebugProtocol.StackTraceResponse;
      expect(response.success).to.equal(true);
      const stackFrames = response.body.stackFrames;
      expect(stackFrames.length).to.equal(2);
      expect(stackFrames[0].id).to.be.ok; // should have frame id
      const frameInfo = adapter.getStackFrameInfo(stackFrames[0].id);
      expect(frameInfo).to.be.ok; // should have frame info for frame id
      expect(frameInfo.locals).to.be.ok;
      expect(frameInfo.statics).to.be.ok;
      expect(frameInfo.globals).to.be.ok;
    });
  });

  describe('scopesRequest', () => {
    let adapter: ApexDebugForTest;

    beforeEach(() => {
      adapter = new ApexDebugForTest(
        new SessionService(),
        new StreamingService(),
        new BreakpointService(),
        new RequestService()
      );
      adapter.setSfdxProject('someProjectPath');
      adapter.setOrgInfo({
        instanceUrl: 'https://www.salesforce.com',
        accessToken: '123'
      } as OrgInfo);
      adapter.addRequestThread('07cFAKE');
    });

    it('Should return no scopes for unknown frameId', async () => {
      // given
      const args: DebugProtocol.ScopesArguments = {
        frameId: 1234567
      };

      // when
      await adapter.scopesRequest({} as DebugProtocol.ScopesResponse, args);

      // then
      const response = adapter.getResponse(0) as DebugProtocol.ScopesResponse;
      expect(response.success).to.equal(true);
      expect(response.body).to.be.ok;
      expect(response.body.scopes).to.be.ok;
      expect(response.body.scopes.length).to.equal(0);
    });

    it('Should return three scopes for known frameId', async () => {
      // given
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE', 0);
      frameInfo.locals = [];
      frameInfo.statics = [];
      frameInfo.globals = [];
      const frameId = adapter.createStackFrameInfo(frameInfo);

      // when
      await adapter.scopesRequest(
        {} as DebugProtocol.ScopesResponse,
        {
          frameId: frameId
        } as DebugProtocol.ScopesArguments
      );

      // then
      const response = adapter.getResponse(0) as DebugProtocol.ScopesResponse;
      expect(response.success).to.equal(true);
      expect(response.body).to.be.ok;
      expect(response.body.scopes).to.be.ok;
      expect(response.body.scopes.length).to.equal(3);
    });
  });
});

function newStringValue(name: string, value = 'value', slot?: number): any {
  const result: any = {
    name: name,
    declaredTypeRef: 'java/lang/String',
    nameForMessages: 'String',
    value: value
  };
  if (typeof slot !== 'undefined') {
    result.slot = slot;
  }
  return result;
}
