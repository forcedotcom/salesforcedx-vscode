/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Source, StackFrame } from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { EXTENT_TRIGGER_PREFIX } from '../../../src';
import {
  ApexDebugStackFrameInfo,
  ApexReplayDebug,
  ApexVariable,
  ApexVariableContainer,
  LaunchRequestArguments,
  VariableContainer
} from '../../../src/adapter/apexReplayDebug';
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

// tslint:disable:no-unused-expression
describe('Replay debugger adapter variable handling - unit', () => {
  let adapter: MockApexReplayDebug;
  let sendResponseSpy: sinon.SinonSpy;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const projectPath = undefined;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true,
    projectPath
  };

  describe('Scopes request', () => {
    let hasHeapDumpForTopFrameStub: sinon.SinonStub;
    let getFrameHandlerStub: sinon.SinonStub;
    let copyStateForHeapDumpStub: sinon.SinonStub;
    let replaceVariablesWithHeapDumpStub: sinon.SinonStub;
    let resetLastSeenHeapDumpLogLineStub: sinon.SinonStub;
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
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
      getFrameHandlerStub = sinon.stub(LogContext.prototype, 'getFrameHandler').returns(frameHandler);
    });

    afterEach(() => {
      sendResponseSpy.restore();
      hasHeapDumpForTopFrameStub.restore();
      getFrameHandlerStub.restore();
      if (copyStateForHeapDumpStub) {
        copyStateForHeapDumpStub.restore();
      }
      if (replaceVariablesWithHeapDumpStub) {
        replaceVariablesWithHeapDumpStub.restore();
      }
      if (resetLastSeenHeapDumpLogLineStub) {
        resetLastSeenHeapDumpLogLineStub.restore();
      }
    });

    it('Should return no scopes for unknown frame', async () => {
      hasHeapDumpForTopFrameStub = sinon.stub(LogContext.prototype, 'hasHeapDumpForTopFrame').returns(false);

      await adapter.scopesRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.ScopesResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.scopes.length).to.equal(0);
    });

    it('Should return local, static, and global scopes', async () => {
      hasHeapDumpForTopFrameStub = sinon.stub(LogContext.prototype, 'hasHeapDumpForTopFrame').returns(false);
      const id = frameHandler.create(new ApexDebugStackFrameInfo(0, 'foo'));
      args.frameId = id;

      await adapter.scopesRequest(response, args);

      const actualResponse: DebugProtocol.ScopesResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.scopes.length).to.equal(3);
      expect(actualResponse.body.scopes[0].name).to.equal('Local');
      expect(actualResponse.body.scopes[1].name).to.equal('Static');
      expect(actualResponse.body.scopes[2].name).to.equal('Global');
    });

    it('Should replace with heapdump variables', async () => {
      hasHeapDumpForTopFrameStub = sinon.stub(LogContext.prototype, 'hasHeapDumpForTopFrame').returns(true);
      copyStateForHeapDumpStub = sinon.stub(LogContext.prototype, 'copyStateForHeapDump');
      replaceVariablesWithHeapDumpStub = sinon.stub(HeapDumpService.prototype, 'replaceVariablesWithHeapDump');
      resetLastSeenHeapDumpLogLineStub = sinon.stub(LogContext.prototype, 'resetLastSeenHeapDumpLogLine');

      await adapter.scopesRequest(response, args);

      expect(copyStateForHeapDumpStub.calledOnce).to.be.true;
      expect(replaceVariablesWithHeapDumpStub.calledOnce).to.be.true;
      expect(resetLastSeenHeapDumpLogLineStub.calledOnce).to.be.true;
    });
  });

  describe('Variables request', () => {
    let getVariableHandlerStub: sinon.SinonStub;
    let getAllVariablesStub: sinon.SinonStub;
    let response: DebugProtocol.VariablesResponse;
    let args: DebugProtocol.VariablesArguments;
    let variableHandler: Handles<VariableContainer>;

    beforeEach(() => {
      adapter = new MockApexReplayDebug();
      adapter.setLogFile(launchRequestArgs);
      response = Object.assign(adapter.getDefaultResponse(), {
        body: {}
      });
      args = {
        variablesReference: 0
      };
      variableHandler = new Handles<VariableContainer>();
      sendResponseSpy = sinon.spy(ApexReplayDebug.prototype, 'sendResponse');
    });

    afterEach(() => {
      sendResponseSpy.restore();
      if (getVariableHandlerStub) {
        getVariableHandlerStub.restore();
      }
      if (getAllVariablesStub) {
        getAllVariablesStub.restore();
      }
    });

    it('Should return no variables for unknown scope', async () => {
      await adapter.variablesRequest(response, args);

      const actualResponse: DebugProtocol.VariablesResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.variables.length).to.equal(0);
    });

    it('Should collect variables from scope container', async () => {
      getVariableHandlerStub = sinon.stub(LogContext.prototype, 'getVariableHandler').returns(variableHandler);
      getAllVariablesStub = sinon
        .stub(VariableContainer.prototype, 'getAllVariables')
        .returns([new ApexVariable('foo', 'bar', 'String')]);
      const id = variableHandler.create(new ApexVariableContainer('foo', 'bar', 'String'));
      args.variablesReference = id;

      await adapter.variablesRequest(response, args);

      const actualResponse: DebugProtocol.VariablesResponse = sendResponseSpy.getCall(0).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.variables.length).to.equal(1);
      const apexVariable = actualResponse.body.variables[0];
      expect(apexVariable.name).to.equal('foo');
      expect(apexVariable.value).to.equal('bar');
      expect(apexVariable.evaluateName).to.equal(apexVariable.value);
      expect(apexVariable.type).to.equal('String');
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
      let getTopFrameStub: sinon.SinonStub;
      let getHeapDumpForThisLocationStub: sinon.SinonStub;
      let createStringRefsFromHeapdumpSpy: sinon.SinonSpy;
      let updateLeafReferenceContainerSpy: sinon.SinonSpy;
      let createVariableFromReferenceSpy: sinon.SinonSpy;
      let getFrameHandlerStub: sinon.SinonStub;
      let getRefsMapStub: sinon.SinonStub;
      let getStaticVariablesClassMapStub: sinon.SinonStub;
      const topFrame: StackFrame = {
        id: 0,
        name: 'Foo.cls',
        line: 10,
        column: 0,
        source: new Source('Foo.cls', '/path/Foo.cls')
      };
      let frameHandler: Handles<ApexDebugStackFrameInfo>;
      let refsMap: Map<string, ApexVariableContainer>;
      let staticVariablesClassMap: Map<string, Map<string, VariableContainer>>;

      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        adapter.setLogFile(launchRequestArgs);
        frameHandler = new Handles<ApexDebugStackFrameInfo>();
        refsMap = new Map<string, ApexVariableContainer>();
        staticVariablesClassMap = new Map<string, Map<string, ApexVariableContainer>>();
        getTopFrameStub = sinon.stub(LogContext.prototype, 'getTopFrame').returns(topFrame);

        createStringRefsFromHeapdumpSpy = sinon.spy(HeapDumpService.prototype, 'createStringRefsFromHeapdump');
        updateLeafReferenceContainerSpy = sinon.spy(HeapDumpService.prototype, 'updateLeafReferenceContainer');
        createVariableFromReferenceSpy = sinon.spy(HeapDumpService.prototype, 'createVariableFromReference');
        getFrameHandlerStub = sinon.stub(LogContext.prototype, 'getFrameHandler').returns(frameHandler);
        getRefsMapStub = sinon.stub(LogContext.prototype, 'getRefsMap').returns(refsMap);
        getStaticVariablesClassMapStub = sinon
          .stub(LogContext.prototype, 'getStaticVariablesClassMap')
          .returns(staticVariablesClassMap);
      });

      afterEach(() => {
        getTopFrameStub.restore();
        getHeapDumpForThisLocationStub.restore();
        createStringRefsFromHeapdumpSpy.restore();
        updateLeafReferenceContainerSpy.restore();
        createVariableFromReferenceSpy.restore();
        getFrameHandlerStub.restore();
        getRefsMapStub.restore();
        getStaticVariablesClassMapStub.restore();
      });

      it('Should not switch variables without a heapdump for current location', () => {
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(undefined);

        heapDumpService.replaceVariablesWithHeapDump();

        expect(createStringRefsFromHeapdumpSpy.called).to.be.false;
        expect(updateLeafReferenceContainerSpy.called).to.be.false;
        expect(createVariableFromReferenceSpy.called).to.be.false;
      });

      it('Should not switch variables without a successful heapdump for current location', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);

        heapDumpService.replaceVariablesWithHeapDump();

        expect(createStringRefsFromHeapdumpSpy.called).to.be.false;
        expect(updateLeafReferenceContainerSpy.called).to.be.false;
        expect(createVariableFromReferenceSpy.called).to.be.false;
      });

      it('Should not create string refs if there are not any in the heapdump', () => {
        const heapdump = createHeapDumpWithNoStringTypes();
        heapDumpService.createStringRefsFromHeapdump(heapdump.getOverlaySuccessResult()!);
        expect(refsMap.size).to.be.eq(0);
      });

      it('Should only create string refs if there are not any in the heapdump', () => {
        const heapdump = createHeapDumpWithNoStringTypes();
        heapDumpService.createStringRefsFromHeapdump(heapdump.getOverlaySuccessResult()!);
        expect(refsMap.size).to.be.eq(0);
      });

      it('Should create string refs if there are any in the heapdump', () => {
        const heapdump = createHeapDumpWithStrings();
        heapDumpService.createStringRefsFromHeapdump(heapdump.getOverlaySuccessResult()!);
        expect(refsMap.size).to.be.eq(2);
        let tempStringVar = refsMap.get('0x47a32f5b') as ApexVariableContainer;
        expect(tempStringVar.value).to.be.eq(
          "'This is a longer string that will certainly get truncated until we hit a checkpoint and inspect it_extra'"
        );
        tempStringVar = refsMap.get('0x6cda5efc') as ApexVariableContainer;
        expect(tempStringVar.value).to.be.eq("'9/13/2018'");
      });

      it('Should not follow reference chain when creating leaf variables except strings', () => {
        const heapdump = createHeapDumpWithNestedRefs();
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);
        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;
        heapDumpService.replaceVariablesWithHeapDump();
        expect(createStringRefsFromHeapdumpSpy.called).to.be.true;
        expect(updateLeafReferenceContainerSpy.called).to.be.true;
        expect(createVariableFromReferenceSpy.called).to.be.false;
        expect(refsMap.size).to.be.eq(4);

        // NonStaticClassWithVariablesToInspect has an inner class of the same type.
        // Get the one that's the top level one and verify that it's innerVariable does not
        // have children and that all of the other values have been set including the string
        // value
        let tempApexVar = refsMap.get('0x3557adc7') as ApexVariableContainer;
        expect(tempApexVar.variables.size).to.be.eq(7);
        expect((tempApexVar.variables.get('MyBoolean') as ApexVariableContainer).value).to.be.eq('false');
        expect((tempApexVar.variables.get('MyDate') as ApexVariableContainer).value).to.be.eq(
          'Thu Sep 13 00:00:00 GMT 2018'
        );
        expect((tempApexVar.variables.get('MyDouble') as ApexVariableContainer).value).to.be.eq('4.37559');
        expect((tempApexVar.variables.get('MyInteger') as ApexVariableContainer).value).to.be.eq('10');
        expect((tempApexVar.variables.get('MyLong') as ApexVariableContainer).value).to.be.eq('4271993');
        expect((tempApexVar.variables.get('MyString') as ApexVariableContainer).value).to.be.eq(
          "'This is a longer string that will certainly get truncated until we hit a checkpoint and inspect it_extra'"
        );
        const innerApexRefVar = tempApexVar.variables.get('innerVariable') as ApexVariableContainer;
        expect(innerApexRefVar.ref).to.be.eq('0x55260a7a');
        expect(innerApexRefVar.variables.size).to.be.eq(0);

        tempApexVar = refsMap.get('0x55260a7a') as ApexVariableContainer;
        expect(tempApexVar.variables.size).to.be.eq(7);
        expect((tempApexVar.variables.get('MyBoolean') as ApexVariableContainer).value).to.be.eq('true');
        expect((tempApexVar.variables.get('MyDate') as ApexVariableContainer).value).to.be.eq(
          'Thu Sep 13 00:00:00 GMT 2018'
        );
        expect((tempApexVar.variables.get('MyDouble') as ApexVariableContainer).value).to.be.eq('3.14159');
        expect((tempApexVar.variables.get('MyInteger') as ApexVariableContainer).value).to.be.eq('5');
        expect((tempApexVar.variables.get('MyLong') as ApexVariableContainer).value).to.be.eq('4271990');
        expect((tempApexVar.variables.get('MyString') as ApexVariableContainer).value).to.be.eq("'9/13/2018'");
        expect((tempApexVar.variables.get('innerVariable') as ApexVariableContainer).value).to.be.eq('null');
      });

      it('Should follow reference chain when creating instance variables from references', () => {
        const heapdump = createHeapDumpWithNestedRefs();
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);

        const localRefVariable = new ApexVariableContainer('foo', '', 'NonStaticClassWithVariablesToInspect');
        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;
        frameInfo.locals.set(localRefVariable.name, localRefVariable);
        heapDumpService.replaceVariablesWithHeapDump();

        const updatedLocRefVariable = frameInfo.locals.get(localRefVariable.name) as ApexVariableContainer;
        expect(updatedLocRefVariable.variables.size).to.be.eq(7);
        expect((updatedLocRefVariable.variables.get('MyBoolean') as ApexVariableContainer).value).to.be.eq('false');
        expect((updatedLocRefVariable.variables.get('MyDate') as ApexVariableContainer).value).to.be.eq(
          'Thu Sep 13 00:00:00 GMT 2018'
        );
        expect((updatedLocRefVariable.variables.get('MyDouble') as ApexVariableContainer).value).to.be.eq('4.37559');
        expect((updatedLocRefVariable.variables.get('MyInteger') as ApexVariableContainer).value).to.be.eq('10');
        expect((updatedLocRefVariable.variables.get('MyLong') as ApexVariableContainer).value).to.be.eq('4271993');
        expect((updatedLocRefVariable.variables.get('MyString') as ApexVariableContainer).value).to.be.eq(
          "'This is a longer string that will certainly get truncated until we hit a checkpoint and inspect it_extra'"
        );

        const innerApexRefVar = updatedLocRefVariable.variables.get('innerVariable') as ApexVariableContainer;
        expect(innerApexRefVar.ref).to.be.eq('0x55260a7a');

        expect(innerApexRefVar.variables.size).to.be.eq(7);
        expect((innerApexRefVar.variables.get('MyBoolean') as ApexVariableContainer).value).to.be.eq('true');
        expect((innerApexRefVar.variables.get('MyDate') as ApexVariableContainer).value).to.be.eq(
          'Thu Sep 13 00:00:00 GMT 2018'
        );
        expect((innerApexRefVar.variables.get('MyDouble') as ApexVariableContainer).value).to.be.eq('3.14159');
        expect((innerApexRefVar.variables.get('MyInteger') as ApexVariableContainer).value).to.be.eq('5');
        expect((innerApexRefVar.variables.get('MyLong') as ApexVariableContainer).value).to.be.eq('4271990');
        expect((innerApexRefVar.variables.get('MyString') as ApexVariableContainer).value).to.be.eq("'9/13/2018'");
        expect((innerApexRefVar.variables.get('innerVariable') as ApexVariableContainer).value).to.be.eq('null');
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
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);
        const nonRefVariable = new ApexVariableContainer('theInt', '2', 'Double');
        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;
        frameInfo.locals.set(nonRefVariable.name, nonRefVariable);

        heapDumpService.replaceVariablesWithHeapDump();
        expect(createStringRefsFromHeapdumpSpy.calledOnce).to.be.true;
        expect(updateLeafReferenceContainerSpy.calledOnce).to.be.false;
        expect(createVariableFromReferenceSpy.calledOnce).to.be.false;
        const updatedNonRefVariable = frameInfo.locals.get(nonRefVariable.name) as ApexVariableContainer;
        expect(updatedNonRefVariable.value).to.be.eq('5');
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
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);
        const nonRefVariable = new ApexVariableContainer('theInt', '2', 'Double');
        staticVariablesClassMap.set('Foo', new Map([['theInt', nonRefVariable]]));
        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;
        frameInfo.statics.set(nonRefVariable.name, nonRefVariable);

        heapDumpService.replaceVariablesWithHeapDump();
        expect(createStringRefsFromHeapdumpSpy.calledOnce).to.be.true;
        expect(updateLeafReferenceContainerSpy.calledOnce).to.be.false;
        expect(createVariableFromReferenceSpy.calledOnce).to.be.false;
        const updatedNonRefVariable = frameInfo.statics.get(nonRefVariable.name) as ApexVariableContainer;
        expect(updatedNonRefVariable.value).to.be.eq('5');
      });

      it('Should correctly deal with circular references and variable values', () => {
        const heapdump = createHeapDumpWithCircularRefs();
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);

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
        expect(updatedLocRefVariable.value).to.be.eq(expectedVariableValue);

        expect(updatedLocRefVariable.variables.size).to.be.eq(2);
        expect((updatedLocRefVariable.variables.get('someInt') as ApexVariableContainer).value).to.be.eq('5');
        const listChildVar = updatedLocRefVariable.variables.get('cfList') as ApexVariableContainer;

        expect(listChildVar.value).to.be.eq(expectedListVarValue);
        expect(listChildVar.variables.size).to.be.eq(1);

        const listElementVar = listChildVar.variables.get('0') as ApexVariableContainer;
        expect(listElementVar.value).to.be.eq(expectedVariableValue);
        expect((listElementVar.variables.get('cfList') as ApexVariableContainer).value).to.be.eq(expectedListVarValue);
      });
    }); // Describe replaceVariablesWithHeapDump

    describe('heapDumpTriggerContextVariables', () => {
      let getTopFrameStub: sinon.SinonStub;
      let getHeapDumpForThisLocationStub: sinon.SinonStub;
      let getFrameHandlerStub: sinon.SinonStub;
      let getRefsMapStub: sinon.SinonStub;
      let getStaticVariablesClassMapStub: sinon.SinonStub;
      let isRunningApexTriggerStub: sinon.SinonStub;
      let getVariableHandlerStub: sinon.SinonStub;
      let variableHandler: Handles<VariableContainer>;

      const topFrame: StackFrame = {
        id: 0,
        name: 'Foo.cls',
        line: 10,
        column: 0,
        source: new Source('Foo.trigger', '/path/Foo.trigger')
      };
      let frameHandler: Handles<ApexDebugStackFrameInfo>;
      let refsMap: Map<string, ApexVariableContainer>;
      let staticVariablesClassMap: Map<string, Map<string, VariableContainer>>;

      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        adapter.setLogFile(launchRequestArgs);
        frameHandler = new Handles<ApexDebugStackFrameInfo>();
        refsMap = new Map<string, ApexVariableContainer>();
        staticVariablesClassMap = new Map<string, Map<string, ApexVariableContainer>>();
        getTopFrameStub = sinon.stub(LogContext.prototype, 'getTopFrame').returns(topFrame);
        getFrameHandlerStub = sinon.stub(LogContext.prototype, 'getFrameHandler').returns(frameHandler);
        getRefsMapStub = sinon.stub(LogContext.prototype, 'getRefsMap').returns(refsMap);
        getStaticVariablesClassMapStub = sinon
          .stub(LogContext.prototype, 'getStaticVariablesClassMap')
          .returns(staticVariablesClassMap);
        variableHandler = new Handles<VariableContainer>();
        isRunningApexTriggerStub = sinon.stub(LogContext.prototype, 'isRunningApexTrigger');
      });

      afterEach(() => {
        getTopFrameStub.restore();
        getHeapDumpForThisLocationStub.restore();
        getFrameHandlerStub.restore();
        getRefsMapStub.restore();
        getStaticVariablesClassMapStub.restore();
        if (isRunningApexTriggerStub) {
          isRunningApexTriggerStub.restore();
        }
        if (getVariableHandlerStub) {
          getVariableHandlerStub.restore();
        }
      });

      it('Should not create global trigger variables if not processing a trigger heapdump', () => {
        const heapdump = createHeapDumpResultForTriggers();

        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);

        getVariableHandlerStub = sinon.stub(LogContext.prototype, 'getVariableHandler').returns(variableHandler);

        isRunningApexTriggerStub.returns(false);

        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;

        expect(frameInfo.globals.size).to.eq(0);
        heapDumpService.replaceVariablesWithHeapDump();
        expect(frameInfo.globals.size).to.eq(0);
      });

      it('Should create trigger variables if processing a trigger heapdump', () => {
        const heapdump = createHeapDumpResultForTriggers();

        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);

        getVariableHandlerStub = sinon.stub(LogContext.prototype, 'getVariableHandler').returns(variableHandler);

        isRunningApexTriggerStub.returns(true);

        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;

        expect(frameInfo.globals.size).to.eq(0);
        heapDumpService.replaceVariablesWithHeapDump();

        expect(frameInfo.globals.size).to.eq(8);
        expect((frameInfo.globals.get(EXTENT_TRIGGER_PREFIX + 'isbefore') as ApexVariableContainer).value).to.eq(
          'false'
        );
        expect((frameInfo.globals.get(EXTENT_TRIGGER_PREFIX + 'isdelete') as ApexVariableContainer).value).to.eq(
          'false'
        );
        expect((frameInfo.globals.get(EXTENT_TRIGGER_PREFIX + 'isundelete') as ApexVariableContainer).value).to.eq(
          'false'
        );
        expect((frameInfo.globals.get(EXTENT_TRIGGER_PREFIX + 'isupdate') as ApexVariableContainer).value).to.eq(
          'false'
        );
        expect((frameInfo.globals.get(EXTENT_TRIGGER_PREFIX + 'isafter') as ApexVariableContainer).value).to.eq('true');
        expect((frameInfo.globals.get(EXTENT_TRIGGER_PREFIX + 'isinsert') as ApexVariableContainer).value).to.eq(
          'true'
        );

        const triggerNew = frameInfo.globals.get(EXTENT_TRIGGER_PREFIX + 'new') as ApexVariableContainer;
        expect(triggerNew.type).to.be.eq('List<Account>');
        expect(triggerNew.variablesRef).to.be.greaterThan(0);
        expect(triggerNew.variables.size).to.be.eq(3);
        expect((triggerNew.variables.get('0') as ApexVariableContainer).ref).to.eq('0x5f163c72');
        expect((triggerNew.variables.get('1') as ApexVariableContainer).ref).to.eq('0xf1fabe');
        expect((triggerNew.variables.get('2') as ApexVariableContainer).ref).to.eq('0x76e9852b');

        const triggerNewmap = frameInfo.globals.get(EXTENT_TRIGGER_PREFIX + 'newmap') as ApexVariableContainer;
        expect(triggerNewmap.type).to.be.eq('Map<Id,Account>');
        expect(triggerNewmap.variablesRef).to.be.greaterThan(0);
        expect(triggerNewmap.variables.size).to.be.eq(3);

        let tempKeyValPairApexVar = triggerNewmap.variables.get('key0_value0') as ApexVariableContainer;
        expect(tempKeyValPairApexVar.name).to.be.eq("'001xx000003Dv3YAAS'");
        let keyApexVar = tempKeyValPairApexVar.variables.get('key') as ApexVariableContainer;
        expect(keyApexVar.type).to.eq('Id');
        expect(keyApexVar.value).to.eq(tempKeyValPairApexVar.name);
        let valueApexVar = tempKeyValPairApexVar.variables.get('value') as ApexVariableContainer;
        expect(valueApexVar.type).to.be.eq('Account');
        expect(valueApexVar.ref).to.be.eq('0x5f163c72');

        tempKeyValPairApexVar = triggerNewmap.variables.get('key1_value1') as ApexVariableContainer;
        expect(tempKeyValPairApexVar.name).to.be.eq("'001xx000003Dv3ZAAS'");
        keyApexVar = tempKeyValPairApexVar.variables.get('key') as ApexVariableContainer;
        expect(keyApexVar.type).to.eq('Id');
        expect(keyApexVar.value).to.eq(tempKeyValPairApexVar.name);
        valueApexVar = tempKeyValPairApexVar.variables.get('value') as ApexVariableContainer;
        expect(valueApexVar.type).to.be.eq('Account');
        expect(valueApexVar.ref).to.be.eq('0xf1fabe');

        tempKeyValPairApexVar = triggerNewmap.variables.get('key2_value2') as ApexVariableContainer;
        expect(tempKeyValPairApexVar.name).to.be.eq("'001xx000003Dv3aAAC'");
        keyApexVar = tempKeyValPairApexVar.variables.get('key') as ApexVariableContainer;
        expect(keyApexVar.type).to.eq('Id');
        expect(keyApexVar.value).to.eq(tempKeyValPairApexVar.name);
        valueApexVar = tempKeyValPairApexVar.variables.get('value') as ApexVariableContainer;
        expect(valueApexVar.type).to.be.eq('Account');
        expect(valueApexVar.ref).to.be.eq('0x76e9852b');
      });
    });
  });
});
