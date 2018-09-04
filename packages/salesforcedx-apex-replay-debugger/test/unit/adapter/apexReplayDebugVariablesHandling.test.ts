/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { Source, StackFrame } from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { EXTENT_TRIGGER_PREFIX } from '../../../src';
import {
  ApexDebugStackFrameInfo,
  ApexReplayDebug,
  ApexVariable,
  ApexVariableContainer,
  LaunchRequestArguments,
  VariableContainer
} from '../../../src/adapter/apexReplayDebug';
import { ApexHeapDump, LogContext } from '../../../src/core';
import { Handles } from '../../../src/core/handles';
import { HeapDumpService } from '../../../src/core/heapDumpService';
import { MockApexReplayDebug } from './apexReplayDebug.test';
import { createHeapDumpResultForTriggers } from './heapDumpTestUtil';

// tslint:disable:no-unused-expression
describe('Replay debugger adapter variable handling - unit', () => {
  let adapter: MockApexReplayDebug;
  let sendResponseSpy: sinon.SinonSpy;
  const logFileName = 'foo.log';
  const logFilePath = `path/${logFileName}`;
  const launchRequestArgs: LaunchRequestArguments = {
    logFile: logFilePath,
    trace: true
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
      getFrameHandlerStub = sinon
        .stub(LogContext.prototype, 'getFrameHandler')
        .returns(frameHandler);
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
      hasHeapDumpForTopFrameStub = sinon
        .stub(LogContext.prototype, 'hasHeapDumpForTopFrame')
        .returns(false);

      await adapter.scopesRequest(response, args);

      expect(sendResponseSpy.calledOnce).to.be.true;
      const actualResponse: DebugProtocol.ScopesResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.scopes.length).to.equal(0);
    });

    it('Should return local, static, and global scopes', async () => {
      hasHeapDumpForTopFrameStub = sinon
        .stub(LogContext.prototype, 'hasHeapDumpForTopFrame')
        .returns(false);
      const id = frameHandler.create(new ApexDebugStackFrameInfo(0, 'foo'));
      args.frameId = id;

      await adapter.scopesRequest(response, args);

      const actualResponse: DebugProtocol.ScopesResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.scopes.length).to.equal(3);
      expect(actualResponse.body.scopes[0].name).to.equal('Local');
      expect(actualResponse.body.scopes[1].name).to.equal('Static');
      expect(actualResponse.body.scopes[2].name).to.equal('Global');
    });

    it('Should replace with heapdump variables', async () => {
      hasHeapDumpForTopFrameStub = sinon
        .stub(LogContext.prototype, 'hasHeapDumpForTopFrame')
        .returns(true);
      copyStateForHeapDumpStub = sinon.stub(
        LogContext.prototype,
        'copyStateForHeapDump'
      );
      replaceVariablesWithHeapDumpStub = sinon.stub(
        HeapDumpService.prototype,
        'replaceVariablesWithHeapDump'
      );
      resetLastSeenHeapDumpLogLineStub = sinon.stub(
        LogContext.prototype,
        'resetLastSeenHeapDumpLogLine'
      );

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

      const actualResponse: DebugProtocol.VariablesResponse = sendResponseSpy.getCall(
        0
      ).args[0];
      expect(actualResponse.success).to.be.true;
      expect(actualResponse.body.variables.length).to.equal(0);
    });

    it('Should collect variables from scope container', async () => {
      getVariableHandlerStub = sinon
        .stub(LogContext.prototype, 'getVariableHandler')
        .returns(variableHandler);
      getAllVariablesStub = sinon
        .stub(VariableContainer.prototype, 'getAllVariables')
        .returns([new ApexVariable('foo', 'bar', 'String')]);
      const id = variableHandler.create(
        new ApexVariableContainer('foo', 'bar', 'String')
      );
      args.variablesReference = id;

      await adapter.variablesRequest(response, args);

      const actualResponse: DebugProtocol.VariablesResponse = sendResponseSpy.getCall(
        0
      ).args[0];
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

    before(() => {
      adapter = new MockApexReplayDebug();
      const logContext = new LogContext(launchRequestArgs, adapter);
      heapDumpService = new HeapDumpService(logContext);
    });

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
        staticVariablesClassMap = new Map<
          string,
          Map<string, ApexVariableContainer>
        >();
        getTopFrameStub = sinon
          .stub(LogContext.prototype, 'getTopFrame')
          .returns(topFrame);
        getFrameHandlerStub = sinon
          .stub(LogContext.prototype, 'getFrameHandler')
          .returns(frameHandler);
        getRefsMapStub = sinon
          .stub(LogContext.prototype, 'getRefsMap')
          .returns(refsMap);
        getStaticVariablesClassMapStub = sinon
          .stub(LogContext.prototype, 'getStaticVariablesClassMap')
          .returns(staticVariablesClassMap);
        variableHandler = new Handles<VariableContainer>();
        isRunningApexTriggerStub = sinon.stub(
          LogContext.prototype,
          'isRunningApexTrigger'
        );
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

        getVariableHandlerStub = sinon
          .stub(LogContext.prototype, 'getVariableHandler')
          .returns(variableHandler);

        // In this test we're not running a trigger
        isRunningApexTriggerStub.returns(false);

        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;

        // There should be no globals before the heap dump processing
        expect(frameInfo.globals.size).to.eq(0);

        heapDumpService.replaceVariablesWithHeapDump();

        // There should be no gloabs after the heap dump processing
        expect(frameInfo.globals.size).to.eq(0);
      });

      it('Should create trigger variables if processing a trigger heapdump', () => {
        const heapdump = createHeapDumpResultForTriggers();

        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);

        getVariableHandlerStub = sinon
          .stub(LogContext.prototype, 'getVariableHandler')
          .returns(variableHandler);

        // In this test we are running a trigger
        isRunningApexTriggerStub.returns(true);

        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;

        // There should be no globals before the heap dump processing
        expect(frameInfo.globals.size).to.eq(0);

        heapDumpService.replaceVariablesWithHeapDump();

        // There should be 8 globals after the heap dump processing
        // 6 Trigger.is* boolean values
        // 1 Trigger.new - List
        // 1 Trigger.newmap - Map
        expect(frameInfo.globals.size).to.eq(8);
        // Verify the false Trigger booleans
        expect(
          (frameInfo.globals.get(
            EXTENT_TRIGGER_PREFIX + 'isbefore'
          ) as ApexVariableContainer).value
        ).to.eq('false');
        expect(
          (frameInfo.globals.get(
            EXTENT_TRIGGER_PREFIX + 'isdelete'
          ) as ApexVariableContainer).value
        ).to.eq('false');
        expect(
          (frameInfo.globals.get(
            EXTENT_TRIGGER_PREFIX + 'isundelete'
          ) as ApexVariableContainer).value
        ).to.eq('false');
        expect(
          (frameInfo.globals.get(
            EXTENT_TRIGGER_PREFIX + 'isupdate'
          ) as ApexVariableContainer).value
        ).to.eq('false');
        // Verify the True Trigger booleans
        expect(
          (frameInfo.globals.get(
            EXTENT_TRIGGER_PREFIX + 'isafter'
          ) as ApexVariableContainer).value
        ).to.eq('true');
        expect(
          (frameInfo.globals.get(
            EXTENT_TRIGGER_PREFIX + 'isinsert'
          ) as ApexVariableContainer).value
        ).to.eq('true');

        // Verify the Trigger.new map
        const triggerNew = frameInfo.globals.get(
          EXTENT_TRIGGER_PREFIX + 'new'
        ) as ApexVariableContainer;
        expect(triggerNew.type).to.be.eq('List<Account>');
        // The variablesRef should be set as part of the variable processing. 0 is
        // the default, if the reference is set it'll be greater than 0
        expect(triggerNew.variablesRef).to.be.greaterThan(0);
        // There should be 3 items in the Trigger.new list
        expect(triggerNew.variables.size).to.be.eq(3);
        // Verify the entries in the array
        expect(
          (triggerNew.variables.get('0') as ApexVariableContainer).value
        ).to.eq("'0x5f163c72'");
        expect(
          (triggerNew.variables.get('1') as ApexVariableContainer).value
        ).to.eq("'0xf1fabe'");
        expect(
          (triggerNew.variables.get('2') as ApexVariableContainer).value
        ).to.eq("'0x76e9852b'");

        // Verify the Trigger.newmap which is a Map<Id,Account>
        const triggerNewmap = frameInfo.globals.get(
          EXTENT_TRIGGER_PREFIX + 'newmap'
        ) as ApexVariableContainer;
        expect(triggerNewmap.type).to.be.eq('Map<Id,Account>');
        // The variablesRef should be set as part of the variable processing. 0 is
        // the default, if the reference is set it'll be greater than 0
        expect(triggerNewmap.variablesRef).to.be.greaterThan(0);
        expect(triggerNewmap.variables.size).to.be.eq(3);
        // Verify the key/value pairs in the map
        expect(
          (triggerNewmap.variables.get('0x5c288675') as ApexVariableContainer)
            .value
        ).to.be.eq('0x5f163c72');
        expect(
          (triggerNewmap.variables.get('0x5db01cb1') as ApexVariableContainer)
            .value
        ).to.be.eq('0xf1fabe');
        expect(
          (triggerNewmap.variables.get('0x1872dffb') as ApexVariableContainer)
            .value
        ).to.be.eq('0x76e9852b');
      });
    });
  });
});
