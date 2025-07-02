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

import { Source, StackFrame } from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { EXTENT_TRIGGER_PREFIX } from '../../../src';
import { ApexDebugStackFrameInfo } from '../../../src/adapter/apexDebugStackFrameInfo';
import { ApexVariable } from '../../../src/adapter/apexVariable';
import { LaunchRequestArguments } from '../../../src/adapter/types';
import { ApexVariableContainer } from '../../../src/adapter/variableContainer';
import { ApexExecutionOverlayResultCommandSuccess } from '../../../src/commands/apexExecutionOverlayResultCommand';
import { ApexHeapDump, LogContext } from '../../../src/core';
import { Handles } from '../../../src/core/handles';
import { HeapDumpService } from '../../../src/core/heapDumpService';
import { MockApexReplayDebug } from './apexReplayDebug.test';
import {
  createHeapDumpResultForTriggers,
  createHeapDumpWithCircularRefs,
  createHeapDumpWithNestedRefs,
  createHeapDumpWithNoStringTypes,
  createHeapDumpWithStrings
} from './heapDumpTestUtil';

describe('Replay debugger adapter variable handling - unit', () => {
  let adapter: MockApexReplayDebug;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true,
    projectPath: undefined
  };

  describe('Scopes request', () => {
    let hasHeapDumpForTopFrameStub: jest.SpyInstance;
    let getFrameHandlerStub: jest.SpyInstance | undefined;
    let copyStateForHeapDumpStub: jest.SpyInstance;
    let replaceVariablesWithHeapDumpStub: jest.SpyInstance;
    let resetLastSeenHeapDumpLogLineStub: jest.SpyInstance;
    let response: DebugProtocol.ScopesResponse;
    let args: DebugProtocol.ScopesArguments;
    let frameHandler: Handles<ApexDebugStackFrameInfo>;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      adapter.setLogFile(launchRequestArgs);
      response = Object.assign(adapter.getDefaultResponse(), {
        body: {}
      });
      args = {
        frameId: 0
      };
      frameHandler = new Handles<ApexDebugStackFrameInfo>();
    });

    afterEach(() => {
      if (hasHeapDumpForTopFrameStub) {
        hasHeapDumpForTopFrameStub.mockRestore();
      }
      if (getFrameHandlerStub) {
        getFrameHandlerStub.mockRestore();
        getFrameHandlerStub = undefined;
      }
      if (copyStateForHeapDumpStub) {
        copyStateForHeapDumpStub.mockRestore();
      }
      if (replaceVariablesWithHeapDumpStub) {
        replaceVariablesWithHeapDumpStub.mockRestore();
      }
      if (resetLastSeenHeapDumpLogLineStub) {
        resetLastSeenHeapDumpLogLineStub.mockRestore();
      }
    });

    it('Should return no scopes for unknown frame', async () => {
      hasHeapDumpForTopFrameStub = jest
        .spyOn(LogContext.prototype, 'hasHeapDumpForTopFrame')
        .mockReturnValue(undefined);

      await adapter.scopesRequest(response, args);

      const actualResponse = response;
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.scopes.length).toBe(0);
    });

    it('Should return local, static, and global scopes', async () => {
      hasHeapDumpForTopFrameStub = jest
        .spyOn(LogContext.prototype, 'hasHeapDumpForTopFrame')
        .mockReturnValue(undefined);
      const id = frameHandler.create(new ApexDebugStackFrameInfo(0, 'foo'));
      args.frameId = id;
      getFrameHandlerStub = jest.spyOn(LogContext.prototype, 'getFrameHandler').mockReturnValue(frameHandler);

      await adapter.scopesRequest(response, args);

      const actualResponse = response;
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.scopes.length).toBe(3);
      expect(actualResponse.body.scopes[0].name).toBe('Local');
      expect(actualResponse.body.scopes[1].name).toBe('Static');
      expect(actualResponse.body.scopes[2].name).toBe('Global');
    });

    it('Should replace with heapdump variables', async () => {
      hasHeapDumpForTopFrameStub = jest
        .spyOn(LogContext.prototype, 'hasHeapDumpForTopFrame')
        .mockReturnValue('heapDumpId');
      copyStateForHeapDumpStub = jest.spyOn(LogContext.prototype, 'copyStateForHeapDump');
      replaceVariablesWithHeapDumpStub = jest.spyOn(HeapDumpService.prototype, 'replaceVariablesWithHeapDump');
      resetLastSeenHeapDumpLogLineStub = jest.spyOn(LogContext.prototype, 'resetLastSeenHeapDumpLogLine');

      await adapter.scopesRequest(response, args);

      expect(copyStateForHeapDumpStub).toHaveBeenCalledTimes(1);
      expect(replaceVariablesWithHeapDumpStub).toHaveBeenCalledTimes(1);
      expect(resetLastSeenHeapDumpLogLineStub).toHaveBeenCalledTimes(1);
    });
  });

  describe('Variables request', () => {
    let getVariableHandlerStub: jest.SpyInstance;
    let getAllVariablesStub: jest.SpyInstance;
    let response: DebugProtocol.VariablesResponse;
    let args: DebugProtocol.VariablesArguments;
    let variableHandler: Handles<ApexVariableContainer>;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      adapter.setLogFile(launchRequestArgs);
      response = Object.assign(adapter.getDefaultResponse(), {
        body: {}
      });
      args = {
        variablesReference: 0
      };
      variableHandler = new Handles<ApexVariableContainer>();
    });

    afterEach(() => {
      if (getVariableHandlerStub) {
        getVariableHandlerStub.mockRestore();
      }
      if (getAllVariablesStub) {
        getAllVariablesStub.mockRestore();
      }
    });

    it('Should return no variables for unknown scope', async () => {
      await adapter.variablesRequest(response, args);

      const actualResponse = response;
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.variables.length).toBe(0);
    });

    it('Should collect variables from scope container', async () => {
      getVariableHandlerStub = jest.spyOn(LogContext.prototype, 'getVariableHandler').mockReturnValue(variableHandler);
      getAllVariablesStub = jest
        .spyOn(ApexVariableContainer.prototype, 'getAllVariables')
        .mockReturnValue([new ApexVariable('foo', 'bar', 'String')]);
      const id = variableHandler.create(new ApexVariableContainer('foo', 'bar', 'String'));
      args.variablesReference = id;

      await adapter.variablesRequest(response, args);

      const actualResponse = response;
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.body.variables.length).toBe(1);
      const apexVariable = actualResponse.body.variables[0];
      expect(apexVariable.name).toBe('foo');
      expect(apexVariable.value).toBe('bar');
      expect(apexVariable.evaluateName).toBe(apexVariable.value);
      expect(apexVariable.type).toBe('String');
    });
  });

  describe('Heapdump', () => {
    let heapDumpService: HeapDumpService;

    beforeAll(() => {
      adapter = new MockApexReplayDebug();
      const logContext = new LogContext(launchRequestArgs, adapter);
      heapDumpService = new HeapDumpService(logContext);
    });

    describe('replaceVariablesWithHeapDump', () => {
      let getTopFrameStub: jest.SpyInstance;
      let getHeapDumpForThisLocationStub: jest.SpyInstance;
      let createStringRefsFromHeapdumpSpy: jest.SpyInstance;
      let updateLeafReferenceContainerSpy: jest.SpyInstance;
      let createVariableFromReferenceSpy: jest.SpyInstance;
      let getFrameHandlerStub: jest.SpyInstance;
      let getRefsMapStub: jest.SpyInstance;
      let getStaticVariablesClassMapStub: jest.SpyInstance;
      const topFrame: StackFrame = {
        id: 0,
        name: 'Foo.cls',
        line: 10,
        column: 0,
        source: new Source('Foo.cls', '/path/Foo.cls')
      };
      let frameHandler: Handles<ApexDebugStackFrameInfo>;
      let refsMap: Map<string, ApexVariableContainer>;
      let staticVariablesClassMap: Map<string, Map<string, ApexVariableContainer>>;

      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        adapter.setLogFile(launchRequestArgs);
        frameHandler = new Handles<ApexDebugStackFrameInfo>();
        refsMap = new Map<string, ApexVariableContainer>();
        staticVariablesClassMap = new Map<string, Map<string, ApexVariableContainer>>();
        getTopFrameStub = jest.spyOn(LogContext.prototype, 'getTopFrame').mockReturnValue(topFrame);

        createStringRefsFromHeapdumpSpy = jest.spyOn(HeapDumpService.prototype, 'createStringRefsFromHeapdump');
        updateLeafReferenceContainerSpy = jest.spyOn(HeapDumpService.prototype, 'updateLeafReferenceContainer');
        createVariableFromReferenceSpy = jest.spyOn(HeapDumpService.prototype, 'createVariableFromReference');
        getFrameHandlerStub = jest.spyOn(LogContext.prototype, 'getFrameHandler').mockReturnValue(frameHandler);
        getRefsMapStub = jest.spyOn(LogContext.prototype, 'getRefsMap').mockReturnValue(refsMap);
        getStaticVariablesClassMapStub = jest
          .spyOn(LogContext.prototype, 'getStaticVariablesClassMap')
          .mockReturnValue(staticVariablesClassMap);
      });

      afterEach(() => {
        getTopFrameStub.mockRestore();
        getHeapDumpForThisLocationStub.mockRestore();
        createStringRefsFromHeapdumpSpy.mockRestore();
        updateLeafReferenceContainerSpy.mockRestore();
        createVariableFromReferenceSpy.mockRestore();
        getFrameHandlerStub.mockRestore();
        getRefsMapStub.mockRestore();
        getStaticVariablesClassMapStub.mockRestore();
      });

      it('Should not switch variables without a heapdump for current location', () => {
        getHeapDumpForThisLocationStub = jest
          .spyOn(LogContext.prototype, 'getHeapDumpForThisLocation')
          .mockReturnValue(undefined);

        heapDumpService.replaceVariablesWithHeapDump();

        expect(createStringRefsFromHeapdumpSpy).toHaveBeenCalledTimes(0);
        expect(updateLeafReferenceContainerSpy).toHaveBeenCalledTimes(0);
        expect(createVariableFromReferenceSpy).toHaveBeenCalledTimes(0);
      });

      it('Should not switch variables without a successful heapdump for current location', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        getHeapDumpForThisLocationStub = jest
          .spyOn(LogContext.prototype, 'getHeapDumpForThisLocation')
          .mockReturnValue(heapdump);

        heapDumpService.replaceVariablesWithHeapDump();

        expect(createStringRefsFromHeapdumpSpy).toHaveBeenCalledTimes(0);
        expect(updateLeafReferenceContainerSpy).toHaveBeenCalledTimes(0);
        expect(createVariableFromReferenceSpy).toHaveBeenCalledTimes(0);
      });

      it('Should not create string refs if there are not any in the heapdump', () => {
        const heapdump = createHeapDumpWithNoStringTypes();
        heapDumpService.createStringRefsFromHeapdump(heapdump.getOverlaySuccessResult()!);
        expect(refsMap.size).toBe(0);
      });

      it('Should only create string refs if there are not any in the heapdump', () => {
        const heapdump = createHeapDumpWithNoStringTypes();
        heapDumpService.createStringRefsFromHeapdump(heapdump.getOverlaySuccessResult()!);
        expect(refsMap.size).toBe(0);
      });

      it('Should create string refs if there are any in the heapdump', () => {
        const heapdump = createHeapDumpWithStrings();
        heapDumpService.createStringRefsFromHeapdump(heapdump.getOverlaySuccessResult()!);
        expect(refsMap.size).toBe(2);
        let tempStringVar = refsMap.get('0x47a32f5b') as ApexVariableContainer;
        expect(tempStringVar.value).toBe(
          "'This is a longer string that will certainly get truncated until we hit a checkpoint and inspect it_extra'"
        );
        tempStringVar = refsMap.get('0x6cda5efc') as ApexVariableContainer;
        expect(tempStringVar.value).toBe("'9/13/2018'");
      });

      it('Should not follow reference chain when creating leaf variables except strings', () => {
        const heapdump = createHeapDumpWithNestedRefs();
        getHeapDumpForThisLocationStub = jest
          .spyOn(LogContext.prototype, 'getHeapDumpForThisLocation')
          .mockReturnValue(heapdump);
        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;
        heapDumpService.replaceVariablesWithHeapDump();
        expect(createStringRefsFromHeapdumpSpy).toHaveBeenCalledTimes(1);
        expect(updateLeafReferenceContainerSpy).toHaveBeenCalledTimes(2);
        expect(createVariableFromReferenceSpy).toHaveBeenCalledTimes(0);
        expect(refsMap.size).toBe(4);

        // NonStaticClassWithVariablesToInspect has an inner class of the same type.
        // Get the one that's the top level one and verify that it's innerVariable does not
        // have children and that all of the other values have been set including the string
        // value
        let tempApexVar = refsMap.get('0x3557adc7') as ApexVariableContainer;
        expect(tempApexVar.variables.size).toBe(7);
        expect((tempApexVar.variables.get('MyBoolean') as ApexVariableContainer).value).toBe('false');
        expect((tempApexVar.variables.get('MyDate') as ApexVariableContainer).value).toBe(
          'Thu Sep 13 00:00:00 GMT 2018'
        );
        expect((tempApexVar.variables.get('MyDouble') as ApexVariableContainer).value).toBe('4.37559');
        expect((tempApexVar.variables.get('MyInteger') as ApexVariableContainer).value).toBe('10');
        expect((tempApexVar.variables.get('MyLong') as ApexVariableContainer).value).toBe('4271993');
        expect((tempApexVar.variables.get('MyString') as ApexVariableContainer).value).toBe(
          "'This is a longer string that will certainly get truncated until we hit a checkpoint and inspect it_extra'"
        );
        const innerApexRefVar = tempApexVar.variables.get('innerVariable') as ApexVariableContainer;
        expect(innerApexRefVar.ref).toBe('0x55260a7a');
        expect(innerApexRefVar.variables.size).toBe(0);

        tempApexVar = refsMap.get('0x55260a7a') as ApexVariableContainer;
        expect(tempApexVar.variables.size).toBe(7);
        expect((tempApexVar.variables.get('MyBoolean') as ApexVariableContainer).value).toBe('true');
        expect((tempApexVar.variables.get('MyDate') as ApexVariableContainer).value).toBe(
          'Thu Sep 13 00:00:00 GMT 2018'
        );
        expect((tempApexVar.variables.get('MyDouble') as ApexVariableContainer).value).toBe('3.14159');
        expect((tempApexVar.variables.get('MyInteger') as ApexVariableContainer).value).toBe('5');
        expect((tempApexVar.variables.get('MyLong') as ApexVariableContainer).value).toBe('4271990');
        expect((tempApexVar.variables.get('MyString') as ApexVariableContainer).value).toBe("'9/13/2018'");
        expect((tempApexVar.variables.get('innerVariable') as ApexVariableContainer).value).toBe('null');
      });

      it('Should follow reference chain when creating instance variables from references', () => {
        const heapdump = createHeapDumpWithNestedRefs();
        getHeapDumpForThisLocationStub = jest
          .spyOn(LogContext.prototype, 'getHeapDumpForThisLocation')
          .mockReturnValue(heapdump);

        const localRefVariable = new ApexVariableContainer('foo', '', 'NonStaticClassWithVariablesToInspect');
        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;
        frameInfo.locals.set(localRefVariable.name, localRefVariable);
        heapDumpService.replaceVariablesWithHeapDump();

        const updatedLocRefVariable = frameInfo.locals.get(localRefVariable.name) as ApexVariableContainer;
        expect(updatedLocRefVariable.variables.size).toBe(7);
        expect((updatedLocRefVariable.variables.get('MyBoolean') as ApexVariableContainer).value).toBe('false');
        expect((updatedLocRefVariable.variables.get('MyDate') as ApexVariableContainer).value).toBe(
          'Thu Sep 13 00:00:00 GMT 2018'
        );
        expect((updatedLocRefVariable.variables.get('MyDouble') as ApexVariableContainer).value).toBe('4.37559');
        expect((updatedLocRefVariable.variables.get('MyInteger') as ApexVariableContainer).value).toBe('10');
        expect((updatedLocRefVariable.variables.get('MyLong') as ApexVariableContainer).value).toBe('4271993');
        expect((updatedLocRefVariable.variables.get('MyString') as ApexVariableContainer).value).toBe(
          "'This is a longer string that will certainly get truncated until we hit a checkpoint and inspect it_extra'"
        );

        const innerApexRefVar = updatedLocRefVariable.variables.get('innerVariable') as ApexVariableContainer;
        expect(innerApexRefVar.ref).toBe('0x55260a7a');

        expect(innerApexRefVar.variables.size).toBe(7);
        expect((innerApexRefVar.variables.get('MyBoolean') as ApexVariableContainer).value).toBe('true');
        expect((innerApexRefVar.variables.get('MyDate') as ApexVariableContainer).value).toBe(
          'Thu Sep 13 00:00:00 GMT 2018'
        );
        expect((innerApexRefVar.variables.get('MyDouble') as ApexVariableContainer).value).toBe('3.14159');
        expect((innerApexRefVar.variables.get('MyInteger') as ApexVariableContainer).value).toBe('5');
        expect((innerApexRefVar.variables.get('MyLong') as ApexVariableContainer).value).toBe('4271990');
        expect((innerApexRefVar.variables.get('MyString') as ApexVariableContainer).value).toBe("'9/13/2018'");
        expect((innerApexRefVar.variables.get('innerVariable') as ApexVariableContainer).value).toBe('null');
      });

      it('Should update a non-reference variable', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        heapdump.setOverlaySuccessResult({
          HeapDump: {
            extents: [
              {
                collectionType: null,
                typeName: 'Integer',
                definition: [
                  {
                    name: 'value',
                    type: 'Double'
                  }
                ],
                extent: [
                  {
                    address: '0xfoo',
                    isStatic: false,
                    symbols: ['theInt'],
                    value: {
                      value: 5
                    }
                  }
                ]
              }
            ]
          }
        } as ApexExecutionOverlayResultCommandSuccess);
        getHeapDumpForThisLocationStub = jest
          .spyOn(LogContext.prototype, 'getHeapDumpForThisLocation')
          .mockReturnValue(heapdump);
        const nonRefVariable = new ApexVariableContainer('theInt', '2', 'Double');
        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;
        frameInfo.locals.set(nonRefVariable.name, nonRefVariable);

        heapDumpService.replaceVariablesWithHeapDump();
        expect(createStringRefsFromHeapdumpSpy).toHaveBeenCalledTimes(1);
        expect(updateLeafReferenceContainerSpy).toHaveBeenCalledTimes(0);
        expect(createVariableFromReferenceSpy).toHaveBeenCalledTimes(0);
        const updatedNonRefVariable = frameInfo.locals.get(nonRefVariable.name) as ApexVariableContainer;
        expect(updatedNonRefVariable.value).toBe('5');
      });

      it('Should update a non-reference static variable', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        heapdump.setOverlaySuccessResult({
          HeapDump: {
            extents: [
              {
                collectionType: null,
                typeName: 'Integer',
                definition: [
                  {
                    name: 'value',
                    type: 'Double'
                  }
                ],
                extent: [
                  {
                    address: '0xfoo',
                    isStatic: false,
                    symbols: ['Foo.theInt'],
                    value: {
                      value: 5
                    }
                  }
                ]
              }
            ]
          }
        } as ApexExecutionOverlayResultCommandSuccess);
        getHeapDumpForThisLocationStub = jest
          .spyOn(LogContext.prototype, 'getHeapDumpForThisLocation')
          .mockReturnValue(heapdump);
        const nonRefVariable = new ApexVariableContainer('theInt', '2', 'Double');
        staticVariablesClassMap.set('Foo', new Map([['theInt', nonRefVariable]]));
        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;
        frameInfo.statics.set(nonRefVariable.name, nonRefVariable);

        heapDumpService.replaceVariablesWithHeapDump();
        expect(createStringRefsFromHeapdumpSpy).toHaveBeenCalledTimes(1);
        expect(updateLeafReferenceContainerSpy).toHaveBeenCalledTimes(0);
        expect(createVariableFromReferenceSpy).toHaveBeenCalledTimes(0);
        const updatedNonRefVariable = frameInfo.statics.get(nonRefVariable.name) as ApexVariableContainer;
        expect(updatedNonRefVariable.value).toBe('5');
      });

      it('Should correctly deal with circular references and variable values', () => {
        const heapdump = createHeapDumpWithCircularRefs();
        getHeapDumpForThisLocationStub = jest
          .spyOn(LogContext.prototype, 'getHeapDumpForThisLocation')
          .mockReturnValue(heapdump);

        const localRefVariable = new ApexVariableContainer('cf1', '', 'CircularReference', '0x717304ef');
        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;
        frameInfo.locals.set(localRefVariable.name, localRefVariable);
        heapDumpService.replaceVariablesWithHeapDump();

        // Verify the variable was updated and that there is a cicular reference that
        // was set up correctly. The local variable cf1, of type CircularReference contains
        // a field that's a List<CircularReference>. After creating cf1 we add cf1 to its own
        // list.
        const expectedVariableValue = 'CircularReference:{(already output), someInt=5}';
        const expectedListVarValue = '(CircularReference:{already output, someInt=5})';

        const updatedLocRefVariable = frameInfo.locals.get(localRefVariable.name) as ApexVariableContainer;
        expect(updatedLocRefVariable.value).toBe(expectedVariableValue);

        expect(updatedLocRefVariable.variables.size).toBe(2);
        expect((updatedLocRefVariable.variables.get('someInt') as ApexVariableContainer).value).toBe('5');
        const listChildVar = updatedLocRefVariable.variables.get('cfList') as ApexVariableContainer;

        expect(listChildVar.value).toBe(expectedListVarValue);
        expect(listChildVar.variables.size).toBe(1);

        const listElementVar = listChildVar.variables.get('0') as ApexVariableContainer;
        expect(listElementVar.value).toBe(expectedVariableValue);
        expect((listElementVar.variables.get('cfList') as ApexVariableContainer).value).toBe(expectedListVarValue);
      });
    }); // Describe replaceVariablesWithHeapDump

    describe('heapDumpTriggerContextVariables', () => {
      let getTopFrameStub: jest.SpyInstance;
      let getHeapDumpForThisLocationStub: jest.SpyInstance;
      let getFrameHandlerStub: jest.SpyInstance;
      let getRefsMapStub: jest.SpyInstance;
      let getStaticVariablesClassMapStub: jest.SpyInstance;
      let isRunningApexTriggerStub: jest.SpyInstance;
      let getVariableHandlerStub: jest.SpyInstance;
      let variableHandler: Handles<ApexVariableContainer>;

      const topFrame: StackFrame = {
        id: 0,
        name: 'Foo.cls',
        line: 10,
        column: 0,
        source: new Source('Foo.trigger', '/path/Foo.trigger')
      };
      let frameHandler: Handles<ApexDebugStackFrameInfo>;
      let refsMap: Map<string, ApexVariableContainer>;
      let staticVariablesClassMap: Map<string, Map<string, ApexVariableContainer>>;

      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        adapter.setLogFile(launchRequestArgs);
        frameHandler = new Handles<ApexDebugStackFrameInfo>();
        refsMap = new Map<string, ApexVariableContainer>();
        staticVariablesClassMap = new Map<string, Map<string, ApexVariableContainer>>();
        getTopFrameStub = jest.spyOn(LogContext.prototype, 'getTopFrame').mockReturnValue(topFrame);
        getFrameHandlerStub = jest.spyOn(LogContext.prototype, 'getFrameHandler').mockReturnValue(frameHandler);
        getRefsMapStub = jest.spyOn(LogContext.prototype, 'getRefsMap').mockReturnValue(refsMap);
        getStaticVariablesClassMapStub = jest
          .spyOn(LogContext.prototype, 'getStaticVariablesClassMap')
          .mockReturnValue(staticVariablesClassMap);
        variableHandler = new Handles<ApexVariableContainer>();
        isRunningApexTriggerStub = jest.spyOn(LogContext.prototype, 'isRunningApexTrigger');
      });

      afterEach(() => {
        getTopFrameStub.mockRestore();
        getHeapDumpForThisLocationStub.mockRestore();
        getFrameHandlerStub.mockRestore();
        getRefsMapStub.mockRestore();
        getStaticVariablesClassMapStub.mockRestore();
        if (isRunningApexTriggerStub) {
          isRunningApexTriggerStub.mockRestore();
        }
        if (getVariableHandlerStub) {
          getVariableHandlerStub.mockRestore();
        }
      });

      it('Should not create global trigger variables if not processing a trigger heapdump', () => {
        const heapdump = createHeapDumpResultForTriggers();

        getHeapDumpForThisLocationStub = jest
          .spyOn(LogContext.prototype, 'getHeapDumpForThisLocation')
          .mockReturnValue(heapdump);

        getVariableHandlerStub = jest
          .spyOn(LogContext.prototype, 'getVariableHandler')
          .mockReturnValue(variableHandler);

        isRunningApexTriggerStub.mockReturnValue(false);

        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;

        expect(frameInfo.globals.size).toBe(0);
        heapDumpService.replaceVariablesWithHeapDump();
        expect(frameInfo.globals.size).toBe(0);
      });

      it('Should create trigger variables if processing a trigger heapdump', () => {
        const heapdump = createHeapDumpResultForTriggers();

        getHeapDumpForThisLocationStub = jest
          .spyOn(LogContext.prototype, 'getHeapDumpForThisLocation')
          .mockReturnValue(heapdump);

        getVariableHandlerStub = jest
          .spyOn(LogContext.prototype, 'getVariableHandler')
          .mockReturnValue(variableHandler);

        isRunningApexTriggerStub.mockReturnValue(true);

        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;

        expect(frameInfo.globals.size).toBe(0);
        heapDumpService.replaceVariablesWithHeapDump();

        expect(frameInfo.globals.size).toBe(8);
        expect((frameInfo.globals.get(`${EXTENT_TRIGGER_PREFIX}isbefore`) as ApexVariableContainer).value).toBe(
          'false'
        );
        expect((frameInfo.globals.get(`${EXTENT_TRIGGER_PREFIX}isdelete`) as ApexVariableContainer).value).toBe(
          'false'
        );
        expect((frameInfo.globals.get(`${EXTENT_TRIGGER_PREFIX}isundelete`) as ApexVariableContainer).value).toBe(
          'false'
        );
        expect((frameInfo.globals.get(`${EXTENT_TRIGGER_PREFIX}isupdate`) as ApexVariableContainer).value).toBe(
          'false'
        );
        expect((frameInfo.globals.get(`${EXTENT_TRIGGER_PREFIX}isafter`) as ApexVariableContainer).value).toBe('true');
        expect((frameInfo.globals.get(`${EXTENT_TRIGGER_PREFIX}isinsert`) as ApexVariableContainer).value).toBe('true');

        const triggerNew = frameInfo.globals.get(`${EXTENT_TRIGGER_PREFIX}new`) as ApexVariableContainer;
        expect(triggerNew.type).toBe('List<Account>');
        expect(triggerNew.variablesRef).toBeGreaterThan(0);
        expect(triggerNew.variables.size).toBe(3);
        expect((triggerNew.variables.get('0') as ApexVariableContainer).ref).toBe('0x5f163c72');
        expect((triggerNew.variables.get('1') as ApexVariableContainer).ref).toBe('0xf1fabe');
        expect((triggerNew.variables.get('2') as ApexVariableContainer).ref).toBe('0x76e9852b');

        const triggerNewmap = frameInfo.globals.get(`${EXTENT_TRIGGER_PREFIX}newmap`) as ApexVariableContainer;
        expect(triggerNewmap.type).toBe('Map<Id,Account>');
        expect(triggerNewmap.variablesRef).toBeGreaterThan(0);
        expect(triggerNewmap.variables.size).toBe(3);

        let tempKeyValPairApexVar = triggerNewmap.variables.get('key0_value0') as ApexVariableContainer;
        expect(tempKeyValPairApexVar.name).toBe("'001xx000003Dv3YAAS'");
        let keyApexVar = tempKeyValPairApexVar.variables.get('key') as ApexVariableContainer;
        expect(keyApexVar.type).toBe('Id');
        expect(keyApexVar.value).toBe(tempKeyValPairApexVar.name);
        let valueApexVar = tempKeyValPairApexVar.variables.get('value') as ApexVariableContainer;
        expect(valueApexVar.type).toBe('Account');
        expect(valueApexVar.ref).toBe('0x5f163c72');

        tempKeyValPairApexVar = triggerNewmap.variables.get('key1_value1') as ApexVariableContainer;
        expect(tempKeyValPairApexVar.name).toBe("'001xx000003Dv3ZAAS'");
        keyApexVar = tempKeyValPairApexVar.variables.get('key') as ApexVariableContainer;
        expect(keyApexVar.type).toBe('Id');
        expect(keyApexVar.value).toBe(tempKeyValPairApexVar.name);
        valueApexVar = tempKeyValPairApexVar.variables.get('value') as ApexVariableContainer;
        expect(valueApexVar.type).toBe('Account');
        expect(valueApexVar.ref).toBe('0xf1fabe');

        tempKeyValPairApexVar = triggerNewmap.variables.get('key2_value2') as ApexVariableContainer;
        expect(tempKeyValPairApexVar.name).toBe("'001xx000003Dv3aAAC'");
        keyApexVar = tempKeyValPairApexVar.variables.get('key') as ApexVariableContainer;
        expect(keyApexVar.type).toBe('Id');
        expect(keyApexVar.value).toBe(tempKeyValPairApexVar.name);
        valueApexVar = tempKeyValPairApexVar.variables.get('value') as ApexVariableContainer;
        expect(valueApexVar.type).toBe('Account');
        expect(valueApexVar.ref).toBe('0x76e9852b');
      });
    });
  });
});
