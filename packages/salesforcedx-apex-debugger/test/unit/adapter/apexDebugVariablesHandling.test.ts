/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DebugProtocol } from '@vscode/debugprotocol';
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
import { LocalValue, Reference, Value } from '../../../src/commands';
import { BreakpointService } from '../../../src/core/breakpointService';
import { RequestService } from '../../../src/requestService/requestService';
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

    it('Should use proper values from Value', () => {
      expect(variable.name).toBe(value.name);
      expect(variable.type).toBe(value.nameForMessages);
      expect(variable.declaredTypeRef).toBe(value.declaredTypeRef);
      expect(variable.value).toBe(ApexVariable.valueAsString(value));
      expect(variable.evaluateName).toBe(ApexVariable.valueAsString(value));
      expect(variable.variablesReference).toBe(20);
      expect(variable['kind']).toBe(ApexVariableKind.Local);
    });

    it('Should set slot to MAX integer for non local value', () => {
      expect(variable['slot']).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('Should set slot to specific value for LocalValue', () => {
      const localvalue: LocalValue = {
        name: 'name',
        nameForMessages: 'nameForMessages',
        declaredTypeRef: 'declaredTypeRef',
        value: 'value',
        slot: 15
      };
      variable = new ApexVariable(localvalue, ApexVariableKind.Local, 20);
      expect(variable['slot']).toBe(localvalue.slot);
    });

    it('Should correctly print null string as "null"', () => {
      value.value = undefined;
      value.declaredTypeRef = 'java/lang/String';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).toBe('null');
      expect(variable.evaluateName).toBe('null');
    });

    it('Should correctly print empty string', () => {
      value.value = '';
      value.declaredTypeRef = 'java/lang/String';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).toBe("''");
      expect(variable.evaluateName).toBe("''");
    });

    it('Should correctly print string', () => {
      value.value = '123';
      value.declaredTypeRef = 'java/lang/String';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).toBe("'123'");
      expect(variable.evaluateName).toBe("'123'");
    });

    it('Should correctly print value', () => {
      value.value = '123';
      value.nameForMessages = 'a-type';
      value.declaredTypeRef = 'a/specific/type';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).toBe('123');
      expect(variable.evaluateName).toBe('123');
    });

    it('Should correctly print null', () => {
      value.value = undefined;
      value.nameForMessages = 'a-type';
      value.declaredTypeRef = 'a/specific/type';
      variable = new ApexVariable(value, ApexVariableKind.Local, 20);
      expect(variable.value).toBe('null');
      expect(variable.evaluateName).toBe('null');
    });

    it('Should compare Value of different kinds', () => {
      // given
      const v1 = new ApexVariable(value, ApexVariableKind.Local);
      const v2 = new ApexVariable(value, ApexVariableKind.Static);

      // when
      const result = ApexVariable.compareVariables(v1, v2);

      // expect
      expect(result).not.toBe(0);
      expect(result).toBe(ApexVariableKind.Local - ApexVariableKind.Static);
    });

    it('Should compare Value of same kinds', () => {
      // given
      const v1 = new ApexVariable(value, ApexVariableKind.Local);
      const v2 = new ApexVariable(value, ApexVariableKind.Local);

      // when
      const result = ApexVariable.compareVariables(v1, v2);

      // expect
      expect(result).toBe(0);
    });

    it('Should compare based on slot for Local', () => {
      // given
      const v1 = new ApexVariable(newStringValue('a_name', 'value', 10), ApexVariableKind.Local);
      const v2 = new ApexVariable(newStringValue('z_name', 'value', 9), ApexVariableKind.Local);

      // when
      const result1 = ApexVariable.compareVariables(v1, v2);
      const result2 = ApexVariable.compareVariables(v2, v1);

      // expect
      expect(result1).toBeGreaterThan(0); // slot 10 is greater than 9
      expect(result2).toBeLessThan(0); // slot 9 is less than 10
    });

    it('Should compare based on slot for Field', () => {
      // given
      const v1 = new ApexVariable(newStringValue('a_name', 'value', 10), ApexVariableKind.Field);
      const v2 = new ApexVariable(newStringValue('z_name', 'value', 9), ApexVariableKind.Field);

      // when
      const result1 = ApexVariable.compareVariables(v1, v2);
      const result2 = ApexVariable.compareVariables(v2, v1);

      // expect
      expect(result1).toBeGreaterThan(0); // slot 10 is greater than 9
      expect(result2).toBeLessThan(0); // slot 9 is less than 10
    });

    it('Should compare based on name for others', () => {
      // given
      const v1 = new ApexVariable(newStringValue('a_name', 'value'), ApexVariableKind.Static);
      const v2 = new ApexVariable(newStringValue('z_name', 'value'), ApexVariableKind.Static);

      // when
      const result1 = ApexVariable.compareVariables(v1, v2);
      const result2 = ApexVariable.compareVariables(v2, v1);

      // expect
      expect(result1).toBeLessThan(0); // 'a...' before 'z...'
      expect(result2).toBeGreaterThan(0); // 'z...' after 'a...'
    });

    it('Should compare based on numbered name (eg. array index)', () => {
      // given
      const v1 = new ApexVariable(newStringValue('[124]', 'value'), ApexVariableKind.Static);
      const v2 = new ApexVariable(newStringValue('123', 'value'), ApexVariableKind.Static);

      // when
      const result1 = ApexVariable.compareVariables(v1, v2);
      const result2 = ApexVariable.compareVariables(v2, v1);

      // expect
      expect(result1).toBeGreaterThan(0); // '[124]' after '123' (if [124] properly treated as number, see following test)
      expect(result2).toBeLessThan(0); // '123' before '124'
    });

    it('Should compare numbered name with string', () => {
      // given
      const v1 = new ApexVariable(newStringValue('12', 'value'), ApexVariableKind.Static);
      const v2 = new ApexVariable(newStringValue('a_name', 'value'), ApexVariableKind.Static);

      // when
      const result1 = ApexVariable.compareVariables(v1, v2);
      const result2 = ApexVariable.compareVariables(v2, v1);

      // expect
      expect(result1).toBeGreaterThan(0); // numbers after names
      expect(result2).toBeLessThan(0); // names before numbers
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

      const variableRef = await adapter.resolveApexIdToVariableReference('FakeRequestId', 0);

      expect(variableRef).toBeGreaterThanOrEqual(0);
      const container = adapter.getVariableContainer(variableRef as number);

      expect(container).toBeTruthy();
      expect(container).toBeInstanceOf(ObjectReferenceContainer);
      expect(adapter.getVariableContainerReferenceByApexId().size).toBe(1);
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

      const variableRef = await adapter.resolveApexIdToVariableReference('FakeRequestId', 0);

      expect(variableRef).toBeGreaterThanOrEqual(0);
      const container = adapter.getVariableContainer(variableRef as number);

      expect(container).toBeTruthy();
      expect(container).toBeInstanceOf(CollectionReferenceContainer);
      expect(container!.getNumberOfChildren()).toBe(1);
      expect(adapter.getNumberOfChildren(variableRef)).toBe(1);
      const expandedVariables = await container!.expand(adapter, 'all');
      expect(expandedVariables.length).toBe(1);
      expect(expandedVariables[0].indexedVariables).toBe(2);
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

      const variableRef = await adapter.resolveApexIdToVariableReference('FakeRequestId', 0);

      expect(variableRef).toBeGreaterThanOrEqual(0);
      const container = adapter.getVariableContainer(variableRef as number);

      expect(container).toBeTruthy();
      expect(container).toBeInstanceOf(CollectionReferenceContainer);
      expect(container!.getNumberOfChildren()).toBe(1);
      expect(adapter.getNumberOfChildren(variableRef)).toBe(1);
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
      const expectedTupleContainer = new MapTupleContainer(tupleA, 'FakeRequestId');
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

      const variableRef = await adapter.resolveApexIdToVariableReference('FakeRequestId', 0);

      expect(variableRef).toBeGreaterThanOrEqual(0);
      const container = adapter.getVariableContainer(variableRef as number);

      expect(container).toBeTruthy();
      expect(container).toBeInstanceOf(MapReferenceContainer);
      const mapContainer = container as MapReferenceContainer;
      expect(mapContainer.getNumberOfChildren()).toBe(1);
      expect(mapContainer.tupleContainers.size).toBe(1);
      expect(mapContainer.tupleContainers.get(1000)).toEqual(expectedTupleContainer);
      expect(mapContainer.tupleContainers.get(1000)!.getNumberOfChildren()).toBeUndefined();
    });

    it('Should not expand unknown reference type', () => {
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

      expect(adapter.getVariableContainerReferenceByApexId().size).toBe(0);
    });
  });

  describe('resolveApexIdToVariableReference', () => {
    let adapter: ApexDebugForTest;
    let referencesSpy: jest.SpyInstance;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new RequestService());
    });

    it('Should handle undefined input', async () => {
      // given
      const apexId = undefined;

      // when
      const variableRef = await adapter.resolveApexIdToVariableReference('FakeRequestId', apexId);

      // then
      expect(variableRef).toBeUndefined();
    });

    it('Should call fetchReferences for unknown input', async () => {
      // given
      const apexId = 12_345;
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
      referencesSpy = jest.spyOn(RequestService.prototype, 'execute').mockResolvedValue(
        JSON.stringify({
          referencesResponse: {
            references: {
              references
            }
          }
        })
      );

      // when
      const variableRef = await adapter.resolveApexIdToVariableReference('FakeRequestId', apexId);

      // then
      expect(referencesSpy).toHaveBeenCalledTimes(1);
      expect(variableRef).toBeTruthy();
      const container = adapter.getVariableContainer(variableRef as number);
      expect(container).toBeTruthy();
    });
  });

  describe('ApexDebugStackFrameInfo', () => {
    let stateSpy: jest.SpyInstance;
    let adapter: ApexDebugForTest;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new RequestService());
      adapter.setSalesforceProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
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
      stateSpy = jest
        .spyOn(RequestService.prototype, 'execute')
        .mockResolvedValue(JSON.stringify(stateResponse));
      jest.spyOn(BreakpointService.prototype, 'getSourcePathFromTyperef').mockReturnValue('file:///foo.cls');

      // when
      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      // then
      expect(stateSpy).toHaveBeenCalled();
      const response = adapter.getResponse(0) as DebugProtocol.StackTraceResponse;
      expect(response.success).toBe(true);
      const stackFrames = response.body.stackFrames;
      expect(stackFrames.length).toBe(2);
      expect(stackFrames[0].id).toBeTruthy(); // should have frame id
      const frameInfo = adapter.getStackFrameInfo(stackFrames[0].id);
      expect(frameInfo).toBeTruthy(); // should have frame info for frame id
      expect(frameInfo.locals).toBeTruthy();
      expect(frameInfo.locals).toEqual(stateResponse.stateResponse.state.locals.local);
      expect(frameInfo.statics).toBeTruthy();
      expect(frameInfo.statics).toEqual(stateResponse.stateResponse.state.statics.static);
      expect(frameInfo.globals).toBeTruthy();
      expect(frameInfo.globals).toEqual(stateResponse.stateResponse.state.globals.global);
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
      stateSpy = jest
        .spyOn(RequestService.prototype, 'execute')
        .mockResolvedValue(JSON.stringify(stateResponse));
      jest.spyOn(BreakpointService.prototype, 'getSourcePathFromTyperef').mockReturnValue('file:///foo.cls');

      // when
      await adapter.stackTraceRequest(
        {} as DebugProtocol.StackTraceResponse,
        { threadId: 1 } as DebugProtocol.StackTraceArguments
      );

      // then
      expect(stateSpy).toHaveBeenCalled();
      const response = adapter.getResponse(0) as DebugProtocol.StackTraceResponse;
      expect(response.success).toBe(true);
      const stackFrames = response.body.stackFrames;
      expect(stackFrames.length).toBe(2);
      expect(stackFrames[0].id).toBeTruthy(); // should have frame id
      const frameInfo = adapter.getStackFrameInfo(stackFrames[0].id);
      expect(frameInfo).toBeTruthy(); // should have frame info for frame id
      expect(frameInfo.locals).toBeTruthy();
      expect(frameInfo.statics).toBeTruthy();
      expect(frameInfo.globals).toBeTruthy();
    });

    it('Should populate as part of fetchFrameVariables', async () => {
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
      stateSpy = jest
        .spyOn(RequestService.prototype, 'execute')
        .mockResolvedValue(JSON.stringify(frameRespObj));

      // when
      await adapter.fetchFrameVariables(frameInfo);

      // then
      expect(stateSpy).toHaveBeenCalled();
      expect(frameInfo).toBeTruthy(); // should have frame info for frame id
      expect(frameInfo.locals).toBeTruthy();
      expect(frameInfo.locals).toEqual(frameRespObj.frameResponse.frame.locals.local);
      expect(frameInfo.statics).toBeTruthy();
      expect(frameInfo.statics).toEqual(frameRespObj.frameResponse.frame.statics.static);
      expect(frameInfo.globals).toBeTruthy();
      expect(frameInfo.globals).toEqual(frameRespObj.frameResponse.frame.globals.global);
    });
  });

  describe('scopesRequest', () => {
    let adapter: ApexDebugForTest;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new RequestService());
      adapter.setSalesforceProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
    });

    it('Should return no scopes for unknown frameId', async () => {
      // given
      const args: DebugProtocol.ScopesArguments = {
        frameId: 1_234_567
      };

      // when
      await adapter.scopesRequest({} as DebugProtocol.ScopesResponse, args);

      // then
      const response = adapter.getResponse(0) as DebugProtocol.ScopesResponse;
      expect(response.success).toBe(true);
      expect(response.body).toBeTruthy();
      expect(response.body.scopes).toBeTruthy();
      expect(response.body.scopes.length).toBe(0);
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
          frameId
        } as DebugProtocol.ScopesArguments
      );

      // then
      const response = adapter.getResponse(0) as DebugProtocol.ScopesResponse;
      expect(response.success).toBe(true);
      expect(response.body).toBeTruthy();
      expect(response.body.scopes).toBeTruthy();
      expect(response.body.scopes.length).toBe(3);
      expect(response.body.scopes[0]).toEqual({
        name: 'Local',
        variablesReference: 1000,
        expensive: false
      });
      expect(response.body.scopes[1]).toEqual({
        name: 'Static',
        variablesReference: 1001,
        expensive: false
      });
      expect(response.body.scopes[2]).toEqual({
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
      jest.spyOn(ApexDebugForTest.prototype, 'resolveApexIdToVariableReference').mockResolvedValue(1001);
      const expectedVariableObj = new ApexVariable(variableValue, ApexVariableKind.Local, 1001);

      const localScope = new ScopeContainer('local', frameInfo);
      const vars = await localScope.expand(adapter, 'all', 0, 0);
      expect(vars.length).toBe(1);
      expect(ApexVariable.compareVariables(expectedVariableObj, vars[0])).toBe(0);
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
      jest.spyOn(ApexDebugForTest.prototype, 'resolveApexIdToVariableReference').mockResolvedValue(1001);
      const expectedVariableObj = new ApexVariable(variableValue, ApexVariableKind.Static, 1001);

      const localScope = new ScopeContainer('static', frameInfo);
      const vars = await localScope.expand(adapter, 'all', 0, 0);
      expect(vars.length).toBe(1);
      expect(ApexVariable.compareVariables(expectedVariableObj, vars[0])).toBe(0);
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
      jest.spyOn(ApexDebugForTest.prototype, 'resolveApexIdToVariableReference').mockResolvedValue(1001);
      const expectedVariableObj = new ApexVariable(variableValue, ApexVariableKind.Global, 1001);

      const localScope = new ScopeContainer('global', frameInfo);
      const vars = await localScope.expand(adapter, 'all', 0, 0);
      expect(vars.length).toBe(1);
      expect(ApexVariable.compareVariables(expectedVariableObj, vars[0])).toBe(0);
    });
  });

  describe('variablesRequest', () => {
    let adapter: ApexDebugForTest;
    let resetIdleTimersSpy: jest.SpyInstance;

    beforeEach(() => {
      adapter = new ApexDebugForTest(new RequestService());
      adapter.setSalesforceProject('someProjectPath');
      adapter.addRequestThread('07cFAKE');
      resetIdleTimersSpy = jest.spyOn(ApexDebugForTest.prototype, 'resetIdleTimer');
    });

    it('Should return no variables for unknown variablesReference', async () => {
      // given
      const args: DebugProtocol.VariablesArguments = {
        variablesReference: 1_234_567
      };

      // when
      await adapter.variablesRequest({} as DebugProtocol.VariablesResponse, args);

      // then
      const response = adapter.getResponse(0) as DebugProtocol.VariablesResponse;
      expect(response.success).toBe(true);
      expect(response.body).toBeTruthy();
      expect(response.body.variables).toBeTruthy();
      expect(response.body.variables.length).toBe(0);
      expect(resetIdleTimersSpy).not.toHaveBeenCalled();
    });

    it('Should return variables for known variablesReference', async () => {
      // given
      const variables = [
        new ApexVariable(newStringValue('var1'), ApexVariableKind.Static),
        new ApexVariable(newStringValue('var2'), ApexVariableKind.Global)
      ];
      const variableReference = adapter.createVariableContainer(new DummyContainer(variables));

      // when
      await adapter.variablesRequest(
        {} as DebugProtocol.VariablesResponse,
        {
          variablesReference: variableReference
        } as DebugProtocol.VariablesArguments
      );

      // then
      const response = adapter.getResponse(0) as DebugProtocol.VariablesResponse;
      expect(response.success).toBe(true);
      expect(response.body).toBeTruthy();
      expect(response.body.variables).toBeTruthy();
      expect(response.body.variables.length).toBe(2);
      expect(response.body.variables).toEqual(variables);
      expect(resetIdleTimersSpy).toHaveBeenCalledTimes(1);
    });

    it('Should return no variables when expand errors out', async () => {
      const variables = [
        new ApexVariable(newStringValue('var1'), ApexVariableKind.Static),
        new ApexVariable(newStringValue('var2'), ApexVariableKind.Global)
      ];
      const variableReference = adapter.createVariableContainer(new ErrorDummyContainer(variables));

      await adapter.variablesRequest(
        {} as DebugProtocol.VariablesResponse,
        {
          variablesReference: variableReference
        } as DebugProtocol.VariablesArguments
      );

      const response = adapter.getResponse(0) as DebugProtocol.VariablesResponse;
      expect(response.success).toBe(true);
      expect(response.body.variables.length).toBe(0);
      expect(resetIdleTimersSpy).not.toHaveBeenCalled();
    });
  });
});

export const newStringValue = (name: string, value = 'value', slot?: number): Value => {
  const result: any = {
    name,
    declaredTypeRef: 'java/lang/String',
    nameForMessages: 'String',
    value
  };
  if (slot !== undefined) {
    result.slot = slot;
  }
  return result;
};

export class DummyContainer implements VariableContainer {
  public variables: ApexVariable[];
  constructor(variables: ApexVariable[]) {
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
  constructor(variables: ApexVariable[]) {
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
