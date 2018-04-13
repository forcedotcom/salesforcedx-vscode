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
  ApexDebug,
  ApexDebugStackFrameInfo,
  ApexVariable,
  ApexVariableKind,
  CollectionReferenceContainer,
  MapReferenceContainer,
  MapTupleContainer,
  ObjectReferenceContainer,
  ScopeContainer,
  VariableContainer
} from '../../../src/adapter/apexDebug';
import {
  LocalValue,
  Reference,
  RequestService,
  Value
} from '../../../src/commands';
import { BreakpointService } from '../../../src/core/breakpointService';
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
      expect(variable.type).to.equal(value.nameForMessages);
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

    it('Should correctly print value', async () => {
      value.value = '123';
      value.nameForMessages = 'a-type';
      value.declaredTypeRef = 'a/specific/type';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal('123');
    });

    it('Should correctly print null', async () => {
      value.value = undefined;
      value.nameForMessages = 'a-type';
      value.declaredTypeRef = 'a/specific/type';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).to.equal('null');
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
      adapter = new ApexDebugForTest(new RequestService());

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
      expect(adapter.getVariableContainerReferenceByApexId().size).to.equal(1);
    });

    it('Should expand list correctly', async () => {
      adapter = new ApexDebugForTest(new RequestService());

      const references: Reference[] = [
        {
          type: 'list',
          nameForMessages: 'List<List<String>>',
          typeRef: 'List<List<String>>',
          id: 0,
          size: 1,
          value: [
            {
              name: '0',
              nameForMessages: 'List<String>',
              value: '(a, b)',
              declaredTypeRef: 'List<String>',
              ref: 1
            }
          ]
        },
        {
          type: 'list',
          nameForMessages: '<List<String>',
          typeRef: 'List<List<String>>',
          id: 1,
          size: 2,
          value: [
            {
              name: '0',
              nameForMessages: 'String',
              value: 'a',
              declaredTypeRef: 'String'
            },
            {
              name: '1',
              nameForMessages: 'String',
              value: 'b',
              declaredTypeRef: 'String'
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
      expect(container).to.be.instanceOf(CollectionReferenceContainer);
      expect(container!.getNumberOfChildren()).to.equal(1);
      expect(adapter.getNumberOfChildren(variableRef)).to.equal(1);
      const expandedVariables = await container!.expand(adapter, 'all');
      expect(expandedVariables.length).to.equal(1);
      expect(expandedVariables[0].indexedVariables).to.equal(2);
    });

    it('Should expand set correctly', async () => {
      adapter = new ApexDebugForTest(new RequestService());

      const references: Reference[] = [
        {
          type: 'set',
          nameForMessages: 'Set',
          typeRef: 'Type',
          id: 0,
          size: 1,
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
      expect(container).to.be.instanceOf(CollectionReferenceContainer);
      expect(container!.getNumberOfChildren()).to.equal(1);
      expect(adapter.getNumberOfChildren(variableRef)).to.equal(1);
    });

    it('Should expand map correctly', async () => {
      adapter = new ApexDebugForTest(new RequestService());

      const tupleA = {
        key: {
          name: 'key',
          declaredTypeRef: 'Integer',
          nameForMessages: '0'
        },
        value: {
          name: 'value',
          declaredTypeRef: 'String',
          nameForMessages: 'foo'
        }
      };
      const expectedTupleContainer = new MapTupleContainer(
        tupleA,
        'FakeRequestId'
      );
      const references: Reference[] = [
        {
          type: 'map',
          nameForMessages: 'Map',
          typeRef: 'Type',
          id: 0,
          size: 1,
          fields: [
            {
              name: 'var',
              nameForMessages: 'varNameForMessages',
              value: 'varValue',
              declaredTypeRef: 'varDeclaredTypeRef',
              index: 0
            }
          ],
          tuple: [tupleA]
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
      expect(container).to.be.instanceOf(MapReferenceContainer);
      const mapContainer = container as MapReferenceContainer;
      expect(mapContainer.getNumberOfChildren()).to.equal(1);
      expect(mapContainer.tupleContainers.size).to.equal(1);
      expect(mapContainer.tupleContainers.get(1000)).to.deep.equal(
        expectedTupleContainer
      );
      expect(mapContainer.tupleContainers.get(1000)!.getNumberOfChildren()).to
        .be.undefined;
    });

    it('Should not expand unknown reference type', async () => {
      adapter = new ApexDebugForTest(new RequestService());

      const references: Reference[] = [
        {
          type: 'foo',
          nameForMessages: 'foo',
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

      expect(adapter.getVariableContainerReferenceByApexId().size).to.equal(0);
    });
  });

  describe('resolveApexIdToVariableReference', () => {
    let adapter: ApexDebugForTest;
    let referencesSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new RequestService());
    });

    afterEach(() => {
      if (referencesSpy) {
        referencesSpy.restore();
      }
    });

    it('Should handle undefined input', async () => {
      // given
      const apexId = undefined;

      // when
      const variableRef = await adapter.resolveApexIdToVariableReference(
        'FakeRequestId',
        apexId
      );

      // then
      expect(variableRef).to.be.undefined;
    });

    it('Should call fetchReferences for unknown input', async () => {
      // given
      const apexId = 12345;
      const references: Reference[] = [
        {
          type: 'object',
          nameForMessages: 'Object',
          typeRef: 'Type',
          id: apexId,
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
      referencesSpy = sinon.stub(RequestService.prototype, 'execute').returns(
        Promise.resolve(
          JSON.stringify({
            referencesResponse: {
              references: {
                references: references
              }
            }
          })
        )
      );

      // when
      const variableRef = await adapter.resolveApexIdToVariableReference(
        'FakeRequestId',
        apexId
      );

      // then
      expect(referencesSpy.callCount).to.equal(1);
      expect(variableRef).to.be.ok;
      const container = adapter.getVariableContainer(variableRef as number);
      expect(container).to.be.ok;
    });
  });

  describe('ApexDebugStackFrameInfo', () => {
    let stateSpy: sinon.SinonStub;
    let sourcePathSpy: sinon.SinonStub;
    let adapter: ApexDebugForTest;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new RequestService());
      adapter.setSfdxProject('someProjectPath');
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

    it('Should propulates as part of fetchFrameVariables', async () => {
      // given
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE', 1000);
      const frameRespObj: any = {
        frameResponse: {
          frame: {
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
        .returns(Promise.resolve(JSON.stringify(frameRespObj)));

      // when
      await adapter.fetchFrameVariables(frameInfo);

      // then
      expect(stateSpy.called).to.equal(true);
      expect(frameInfo).to.be.ok; // should have frame info for frame id
      expect(frameInfo.locals).to.be.ok;
      expect(frameInfo.locals).to.deep.equal(
        frameRespObj.frameResponse.frame.locals.local
      );
      expect(frameInfo.statics).to.be.ok;
      expect(frameInfo.statics).to.deep.equal(
        frameRespObj.frameResponse.frame.statics.static
      );
      expect(frameInfo.globals).to.be.ok;
      expect(frameInfo.globals).to.deep.equal(
        frameRespObj.frameResponse.frame.globals.global
      );
    });
  });

  describe('scopesRequest', () => {
    let adapter: ApexDebugForTest;
    let resolveApexIdToVariableReferenceSpy: sinon.SinonStub;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new RequestService());
      adapter.setSfdxProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
    });

    afterEach(() => {
      if (resolveApexIdToVariableReferenceSpy) {
        resolveApexIdToVariableReferenceSpy.restore();
      }
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
      expect(response.body.scopes[0]).to.deep.equal({
        name: 'Local',
        variablesReference: 1000,
        expensive: false
      });
      expect(response.body.scopes[1]).to.deep.equal({
        name: 'Static',
        variablesReference: 1001,
        expensive: false
      });
      expect(response.body.scopes[2]).to.deep.equal({
        name: 'Global',
        variablesReference: 1002,
        expensive: false
      });
    });

    it('Should expand local scope', async () => {
      const variableValue: LocalValue = {
        slot: 0,
        name: 'foo',
        declaredTypeRef: 'String',
        nameForMessages: 'String'
      };
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE', 0);
      frameInfo.locals = [];
      frameInfo.statics = [];
      frameInfo.globals = [];
      frameInfo.locals[0] = variableValue;
      resolveApexIdToVariableReferenceSpy = sinon
        .stub(ApexDebugForTest.prototype, 'resolveApexIdToVariableReference')
        .returns(1001);
      const expectedVariableObj = new ApexVariable(
        variableValue,
        ApexVariableKind.Local,
        1001
      );

      const localScope = new ScopeContainer('local', frameInfo);
      const vars = await localScope.expand(adapter, 'all', 0, 0);
      expect(vars.length).to.equal(1);
      expect(
        ApexVariable.compareVariables(expectedVariableObj, vars[0])
      ).to.equal(0);
    });

    it('Should expand static scope', async () => {
      const variableValue: Value = {
        name: 'foo',
        declaredTypeRef: 'String',
        nameForMessages: 'String'
      };
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE', 0);
      frameInfo.locals = [];
      frameInfo.statics = [];
      frameInfo.globals = [];
      frameInfo.statics[0] = variableValue;
      resolveApexIdToVariableReferenceSpy = sinon
        .stub(ApexDebugForTest.prototype, 'resolveApexIdToVariableReference')
        .returns(1001);
      const expectedVariableObj = new ApexVariable(
        variableValue,
        ApexVariableKind.Static,
        1001
      );

      const localScope = new ScopeContainer('static', frameInfo);
      const vars = await localScope.expand(adapter, 'all', 0, 0);
      expect(vars.length).to.equal(1);
      expect(
        ApexVariable.compareVariables(expectedVariableObj, vars[0])
      ).to.equal(0);
    });

    it('Should expand global scope', async () => {
      const variableValue: Value = {
        name: 'foo',
        declaredTypeRef: 'String',
        nameForMessages: 'String'
      };
      const frameInfo = new ApexDebugStackFrameInfo('07cFAKE', 0);
      frameInfo.locals = [];
      frameInfo.statics = [];
      frameInfo.globals = [];
      frameInfo.globals[0] = variableValue;
      resolveApexIdToVariableReferenceSpy = sinon
        .stub(ApexDebugForTest.prototype, 'resolveApexIdToVariableReference')
        .returns(1001);
      const expectedVariableObj = new ApexVariable(
        variableValue,
        ApexVariableKind.Global,
        1001
      );

      const localScope = new ScopeContainer('global', frameInfo);
      const vars = await localScope.expand(adapter, 'all', 0, 0);
      expect(vars.length).to.equal(1);
      expect(
        ApexVariable.compareVariables(expectedVariableObj, vars[0])
      ).to.equal(0);
    });
  });

  describe('variablesRequest', () => {
    let adapter: ApexDebugForTest;
    let resetIdleTimersSpy: sinon.SinonSpy;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new RequestService());
      adapter.setSfdxProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
      resetIdleTimersSpy = sinon.spy(
        ApexDebugForTest.prototype,
        'resetIdleTimer'
      );
    });

    afterEach(() => {
      resetIdleTimersSpy.restore();
    });

    it('Should return no variables for unknown variablesReference', async () => {
      // given
      const args: DebugProtocol.VariablesArguments = {
        variablesReference: 1234567
      };

      // when
      await adapter.variablesRequest(
        {} as DebugProtocol.VariablesResponse,
        args
      );

      // then
      const response = adapter.getResponse(
        0
      ) as DebugProtocol.VariablesResponse;
      expect(response.success).to.equal(true);
      expect(response.body).to.be.ok;
      expect(response.body.variables).to.be.ok;
      expect(response.body.variables.length).to.equal(0);
      expect(resetIdleTimersSpy.called).to.equal(false);
    });

    it('Should return variables for known variablesReference', async () => {
      // given
      const variables = [
        new ApexVariable(newStringValue('var1'), ApexVariableKind.Static),
        new ApexVariable(newStringValue('var2'), ApexVariableKind.Global)
      ];
      const variableReference = adapter.createVariableContainer(
        new DummyContainer(variables)
      );

      // when
      await adapter.variablesRequest(
        {} as DebugProtocol.VariablesResponse,
        {
          variablesReference: variableReference
        } as DebugProtocol.VariablesArguments
      );

      // then
      const response = adapter.getResponse(
        0
      ) as DebugProtocol.VariablesResponse;
      expect(response.success).to.equal(true);
      expect(response.body).to.be.ok;
      expect(response.body.variables).to.be.ok;
      expect(response.body.variables.length).to.equal(2);
      expect(response.body.variables).to.deep.equal(variables);
      expect(resetIdleTimersSpy.calledOnce).to.equal(true);
    });

    it('Should return no variables when expand errors out', async () => {
      const variables = [
        new ApexVariable(newStringValue('var1'), ApexVariableKind.Static),
        new ApexVariable(newStringValue('var2'), ApexVariableKind.Global)
      ];
      const variableReference = adapter.createVariableContainer(
        new ErrorDummyContainer(variables)
      );

      await adapter.variablesRequest(
        {} as DebugProtocol.VariablesResponse,
        {
          variablesReference: variableReference
        } as DebugProtocol.VariablesArguments
      );

      const response = adapter.getResponse(
        0
      ) as DebugProtocol.VariablesResponse;
      expect(response.success).to.equal(true);
      expect(response.body.variables.length).to.equal(0);
      expect(resetIdleTimersSpy.called).to.equal(false);
    });
  });
});

export function newStringValue(
  name: string,
  value = 'value',
  slot?: number
): Value {
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

export class DummyContainer implements VariableContainer {
  public variables: ApexVariable[];
  public constructor(variables: ApexVariable[]) {
    this.variables = variables;
  }

  public expand(
    session: ApexDebug,
    filter: 'named' | 'indexed' | 'all',
    start: number | undefined,
    count: number | undefined
  ): Promise<ApexVariable[]> {
    return Promise.resolve(this.variables);
  }

  public getNumberOfChildren(): number | undefined {
    return undefined;
  }
}

class ErrorDummyContainer implements VariableContainer {
  public variables: ApexVariable[];
  public constructor(variables: ApexVariable[]) {
    this.variables = variables;
  }

  public expand(
    session: ApexDebug,
    filter: 'named' | 'indexed' | 'all',
    start: number | undefined,
    count: number | undefined
  ): Promise<ApexVariable[]> {
    return Promise.reject('error');
  }

  public getNumberOfChildren(): number | undefined {
    return undefined;
  }
}
