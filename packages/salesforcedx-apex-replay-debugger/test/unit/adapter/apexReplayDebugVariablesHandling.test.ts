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
import {
  ApexDebugStackFrameInfo,
  ApexReplayDebug,
  ApexVariable,
  ApexVariableContainer,
  LaunchRequestArguments,
  VariableContainer
} from '../../../src/adapter/apexReplayDebug';
import {
  ApexExecutionOverlayResultCommandSuccess,
  HeadpDumpExtentValue
} from '../../../src/commands/apexExecutionOverlayResultCommand';
import { ApexHeapDump, LogContext } from '../../../src/core';
import { Handles } from '../../../src/core/handles';
import { HeapDumpService } from '../../../src/core/heapDumpService';
import { MockApexReplayDebug } from './apexReplayDebug.test';

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

    it('Should return local and static scopes', async () => {
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
      expect(actualResponse.body.scopes.length).to.equal(2);
      expect(actualResponse.body.scopes[0].name).to.equal('Local');
      expect(actualResponse.body.scopes[1].name).to.equal('Static');
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

      await adapter.scopesRequest(response, args);

      expect(copyStateForHeapDumpStub.calledOnce).to.be.true;
      expect(replaceVariablesWithHeapDumpStub.calledOnce).to.be.true;
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

    describe('updateVariableContainer', () => {
      let updateVariableContainerWithExtentValueStub: sinon.SinonSpy;

      beforeEach(() => {
        updateVariableContainerWithExtentValueStub = sinon.spy(
          HeapDumpService.prototype,
          'updateVariableContainerWithExtentValue'
        );
      });

      afterEach(() => {
        updateVariableContainerWithExtentValueStub.restore();
      });

      it('Should update variable if extent has a string value', () => {
        const varContainer = new ApexVariableContainer('foo', 'bar', 'String');
        const extentValue: HeadpDumpExtentValue = {
          value: 'new bar'
        };

        heapDumpService.updateVariableContainer(varContainer, extentValue);

        expect(varContainer.value).to.equal(`'new bar'`);
        expect(updateVariableContainerWithExtentValueStub.called).to.be.false;
      });

      it('Should update variable if extent has a non string value', () => {
        const varContainer = new ApexVariableContainer('foo', '5', 'Integer');
        const extentValue: HeadpDumpExtentValue = {
          value: 10
        };

        heapDumpService.updateVariableContainer(varContainer, extentValue);

        expect(varContainer.value).to.equal('10');
        expect(updateVariableContainerWithExtentValueStub.called).to.be.false;
      });

      it('Should try to update a child variable with extent entry', () => {
        const varContainer = new ApexVariableContainer('parentfoo', '', 'type');
        varContainer.variables.set(
          'foo1',
          new ApexVariableContainer('foo1', 'bar', 'String')
        );
        varContainer.variables.set(
          'foo2',
          new ApexVariableContainer('foo2', 'bar', 'String')
        );
        const extentValue: HeadpDumpExtentValue = {
          entry: [
            {
              keyDisplayValue: 'parent foo1',
              value: {
                entry: [
                  {
                    keyDisplayValue: 'foo1',
                    value: {
                      value: 'new bar'
                    }
                  }
                ]
              }
            }
          ]
        };

        heapDumpService.updateVariableContainer(varContainer, extentValue);

        expect(updateVariableContainerWithExtentValueStub.calledThrice).to.be
          .true;
        expect(
          (varContainer.variables.get('foo1') as ApexVariableContainer).value
        ).to.equal('new bar');
        expect(
          (varContainer.variables.get('foo2') as ApexVariableContainer).value
        ).to.equal('bar');
      });
    });

    describe('updateVariableContainerWithExtentValue', () => {
      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        adapter.setLogFile(launchRequestArgs);
      });

      it('Should use extent value', () => {
        const varContainer = new ApexVariableContainer('foo', 'bar', 'String');

        heapDumpService.updateVariableContainerWithExtentValue(
          varContainer,
          'new bar',
          undefined
        );

        expect(varContainer.value).to.equal('new bar');
      });

      it('Should use extent entry', () => {
        const varContainer = new ApexVariableContainer('foo', 'bar', 'String');

        heapDumpService.updateVariableContainerWithExtentValue(
          varContainer,
          undefined,
          [
            {
              keyDisplayValue: 'notfoo',
              value: {
                value: 'notfoo'
              }
            },
            {
              keyDisplayValue: 'foo',
              value: {
                value: 'new bar'
              }
            }
          ]
        );

        expect(varContainer.value).to.equal('new bar');
      });

      it('Should find child variable with matching extent entry', () => {
        const varContainer = new ApexVariableContainer('parentfoo', '', 'type');
        varContainer.variables.set(
          'foo',
          new ApexVariableContainer('foo', 'bar', 'String')
        );

        heapDumpService.updateVariableContainerWithExtentValue(
          varContainer,
          undefined,
          [
            {
              keyDisplayValue: 'foo',
              value: {
                value: 'new bar'
              }
            }
          ]
        );

        const childVariable = varContainer.variables.get(
          'foo'
        )! as ApexVariableContainer;
        expect(childVariable.value).to.equal('new bar');
      });
    });

    describe('replaceVariablesWithHeapDump', () => {
      let getTopFrameStub: sinon.SinonStub;
      let getHeapDumpForThisLocationStub: sinon.SinonStub;
      let updateVariableContainerStub: sinon.SinonStub;
      let updateVariableContainerWithExtentValueStub: sinon.SinonStub;
      let getFrameHandlerStub: sinon.SinonStub;
      let getRefsMapStub: sinon.SinonStub;
      const topFrame: StackFrame = {
        id: 0,
        name: 'Foo.cls',
        line: 10,
        column: 0,
        source: new Source('Foo.cls', '/path/Foo.cls')
      };
      let frameHandler: Handles<ApexDebugStackFrameInfo>;
      let refsMap: Map<string, ApexVariableContainer>;

      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        adapter.setLogFile(launchRequestArgs);
        frameHandler = new Handles<ApexDebugStackFrameInfo>();
        refsMap = new Map<string, ApexVariableContainer>();
        getTopFrameStub = sinon
          .stub(LogContext.prototype, 'getTopFrame')
          .returns(topFrame);
        updateVariableContainerStub = sinon.stub(
          HeapDumpService.prototype,
          'updateVariableContainer'
        );
        updateVariableContainerWithExtentValueStub = sinon.stub(
          HeapDumpService.prototype,
          'updateVariableContainerWithExtentValue'
        );
        getFrameHandlerStub = sinon
          .stub(LogContext.prototype, 'getFrameHandler')
          .returns(frameHandler);
        getRefsMapStub = sinon
          .stub(LogContext.prototype, 'getRefsMap')
          .returns(refsMap);
      });

      afterEach(() => {
        getTopFrameStub.restore();
        getHeapDumpForThisLocationStub.restore();
        updateVariableContainerStub.restore();
        updateVariableContainerWithExtentValueStub.restore();
        getFrameHandlerStub.restore();
        getRefsMapStub.restore();
      });

      it('Should not switch variables without a heapdump for current location', () => {
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(undefined);

        heapDumpService.replaceVariablesWithHeapDump();

        expect(updateVariableContainerStub.called).to.be.false;
        expect(updateVariableContainerWithExtentValueStub.called).to.be.false;
      });

      it('Should not switch variables without a successful heapdump for current location', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);

        heapDumpService.replaceVariablesWithHeapDump();

        expect(updateVariableContainerStub.called).to.be.false;
        expect(updateVariableContainerWithExtentValueStub.called).to.be.false;
      });

      it('Should update instance variable', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        heapdump.setOverlaySuccessResult({
          HeapDump: {
            extents: [
              {
                typeName: 'Foo',
                extent: [
                  {
                    address: '0xfoo',
                    value: {
                      entry: [
                        {
                          keyDisplayValue: 'instanceInt',
                          value: {
                            value: 2
                          }
                        }
                      ]
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
        const thisVariable = new ApexVariableContainer('this', '', 'Foo');
        thisVariable.variables.set(
          'instanceInt',
          new ApexVariableContainer('instanceInt', '1', 'Integer')
        );
        refsMap.set('0xfoo', thisVariable);
        const id = frameHandler.create(new ApexDebugStackFrameInfo(0, 'Foo'));
        topFrame.id = id;

        heapDumpService.replaceVariablesWithHeapDump();

        expect(updateVariableContainerStub.called).to.be.false;
        expect(updateVariableContainerWithExtentValueStub.calledOnce).to.be
          .true;
        expect(
          updateVariableContainerWithExtentValueStub.getCall(0).args[1]
        ).to.equal(2);
      });

      it('Should update local variable', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        heapdump.setOverlaySuccessResult({
          HeapDump: {
            extents: [
              {
                typeName: 'String',
                extent: [
                  {
                    address: '0xString',
                    symbols: ['localStr'],
                    value: {
                      value: 'new'
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
        const frameInfo = new ApexDebugStackFrameInfo(0, 'Foo');
        const localVar = new ApexVariableContainer('localStr', 'old', 'String');
        frameInfo.locals.set('localStr', localVar);
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;

        heapDumpService.replaceVariablesWithHeapDump();

        expect(updateVariableContainerWithExtentValueStub.called).to.be.false;
        expect(updateVariableContainerStub.calledOnce).to.be.true;
        expect(updateVariableContainerStub.getCall(0).args[0]).to.equal(
          localVar
        );
        const extentValue = updateVariableContainerStub.getCall(0)
          .args[1] as HeadpDumpExtentValue;
        expect(extentValue.value).to.equal('new');
      });

      it('Should revisit variable with an address', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        heapdump.setOverlaySuccessResult({
          HeapDump: {
            extents: [
              {
                typeName: 'Foo',
                extent: [
                  {
                    address: '0xfoo',
                    value: {
                      entry: [
                        {
                          keyDisplayValue: 'instanceStr',
                          value: {
                            value: '0xRememberMe'
                          }
                        }
                      ]
                    }
                  }
                ]
              },
              {
                typeName: 'String',
                extent: [
                  {
                    address: '0xRememberMe',
                    value: {
                      value: 'new'
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
        const thisVariable = new ApexVariableContainer('this', '', 'Foo');
        const instanceVar = new ApexVariableContainer(
          'instanceStr',
          'old',
          'String'
        );
        thisVariable.variables.set('instanceStr', instanceVar);
        refsMap.set('0xfoo', thisVariable);
        const id = frameHandler.create(new ApexDebugStackFrameInfo(0, 'Foo'));
        topFrame.id = id;

        heapDumpService.replaceVariablesWithHeapDump();

        expect(updateVariableContainerWithExtentValueStub.called).to.be.false;
        expect(updateVariableContainerStub.calledOnce).to.be.true;
        expect(updateVariableContainerStub.getCall(0).args[0]).to.equal(
          instanceVar
        );
        const extentValue = updateVariableContainerStub.getCall(0)
          .args[1] as HeadpDumpExtentValue;
        expect(extentValue.value).to.equal('new');
      });
    });
  });
});
