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
import {
  ApexExecutionOverlayResultCommandSuccess,
  HeapDumpCollectionTypeDefinition,
  HeapDumpExtentValue,
  HeapDumpExtentValueEntry
} from '../../../src/commands/apexExecutionOverlayResultCommand';
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

    describe('updateContainer', () => {
      let updateContainerWithExtentValueSpy: sinon.SinonSpy;
      let updateContainerChildrenWithEntriesSpy: sinon.SinonSpy;

      beforeEach(() => {
        updateContainerWithExtentValueSpy = sinon.spy(
          HeapDumpService.prototype,
          'updateContainerWithExtentValue'
        );
        updateContainerChildrenWithEntriesSpy = sinon.spy(
          HeapDumpService.prototype,
          'updateContainerChildrenWithEntries'
        );
      });

      afterEach(() => {
        updateContainerWithExtentValueSpy.restore();
        updateContainerChildrenWithEntriesSpy.restore();
      });

      it('Should update variable if extent has a string value', () => {
        const varContainer = new ApexVariableContainer('foo', 'bar', '');
        const extentValue: HeapDumpExtentValue = {
          value: 'new bar'
        };

        heapDumpService.updateContainer(
          varContainer,
          extentValue,
          new Map(),
          new Map(),
          new Map([['foo', 'String']])
        );

        expect(varContainer.value).to.equal(`'new bar'`);
        expect(varContainer.type).to.equal('String');
        expect(updateContainerWithExtentValueSpy.calledOnce).to.be.true;
        expect(updateContainerChildrenWithEntriesSpy.called).to.be.false;
      });

      it('Should update variable if extent has a non string value', () => {
        const varContainer = new ApexVariableContainer('foo', '5', 'Integer');
        const extentValue: HeapDumpExtentValue = {
          value: 10
        };

        heapDumpService.updateContainer(
          varContainer,
          extentValue,
          new Map(),
          new Map(),
          new Map()
        );

        expect(varContainer.value).to.equal('10');
        expect(updateContainerWithExtentValueSpy.calledOnce).to.be.true;
        expect(updateContainerChildrenWithEntriesSpy.called).to.be.false;
      });

      it('Should update a child variable with extent entry', () => {
        const varContainer = new ApexVariableContainer('parentfoo', '', 'type');
        varContainer.variables.set(
          'foo1',
          new ApexVariableContainer('foo1', 'bar', 'String')
        );
        varContainer.variables.set(
          'foo2',
          new ApexVariableContainer('foo2', 'bar', 'String')
        );
        const extentValue: HeapDumpExtentValue = {
          entry: [
            {
              keyDisplayValue: 'foo1',
              value: {
                value: 'new bar'
              }
            },
            {
              keyDisplayValue: 'foo2',
              value: {
                value: 'bar'
              }
            }
          ]
        };

        heapDumpService.updateContainer(
          varContainer,
          extentValue,
          new Map(),
          new Map(),
          new Map()
        );

        expect(updateContainerWithExtentValueSpy.calledTwice).to.be.true;
        expect(updateContainerChildrenWithEntriesSpy.calledOnce).to.be.true;
        expect(
          (varContainer.variables.get('foo1') as ApexVariableContainer).value
        ).to.equal(`'new bar'`);
        expect(
          (varContainer.variables.get('foo2') as ApexVariableContainer).value
        ).to.equal(`'bar'`);
      });
    });

    describe('updateContainerChildrenWithEntries', () => {
      it('Should add to container child variables', () => {
        const varContainer = new ApexVariableContainer(
          'MyAccount',
          '',
          'Account'
        );
        const extentValueEntries = [
          {
            keyDisplayValue: 'Name',
            value: {
              value: 'MyAccountName'
            }
          },
          {
            keyDisplayValue: 'Id',
            value: {
              value: '001x'
            }
          }
        ] as HeapDumpExtentValueEntry[];

        heapDumpService.updateContainerChildrenWithEntries(
          varContainer,
          extentValueEntries,
          new Map(),
          new Map(),
          new Map([['Name', 'String'], ['Id', 'ID']])
        );

        expect(varContainer.variables.size).to.equal(2);
        expect(varContainer.variables.has('Name')).to.be.true;
        expect(varContainer.variables.has('Id')).to.be.true;
      });
    });

    describe('updateContainerWithExtentValueOrEntry', () => {
      beforeEach(() => {
        adapter = new MockApexReplayDebug();
        adapter.setLogFile(launchRequestArgs);
      });

      it('Should use extent value', () => {
        const varContainer = new ApexVariableContainer('foo', 'bar', 'String');

        heapDumpService.updateContainerWithExtentValueOrEntry(
          varContainer,
          'new bar',
          undefined
        );

        expect(varContainer.value).to.equal(`'new bar'`);
      });

      it('Should use extent entry', () => {
        const varContainer = new ApexVariableContainer('foo', 'bar', 'String');

        heapDumpService.updateContainerWithExtentValueOrEntry(
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

        expect(varContainer.value).to.equal(`'new bar'`);
      });

      it('Should find child variable with matching extent entry', () => {
        const varContainer = new ApexVariableContainer('parentfoo', '', 'type');
        varContainer.variables.set(
          'foo',
          new ApexVariableContainer('foo', 'bar', 'String')
        );

        heapDumpService.updateContainerWithExtentValueOrEntry(
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
        expect(childVariable.value).to.equal(`'new bar'`);
      });
    });

    describe('replaceVariablesWithHeapDump', () => {
      let getTopFrameStub: sinon.SinonStub;
      let getHeapDumpForThisLocationStub: sinon.SinonStub;
      let updateContainerStub: sinon.SinonStub;
      let updateContainerWithExtentValueOrEntryStub: sinon.SinonStub;
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
        staticVariablesClassMap = new Map<
          string,
          Map<string, ApexVariableContainer>
        >();
        getTopFrameStub = sinon
          .stub(LogContext.prototype, 'getTopFrame')
          .returns(topFrame);
        updateContainerStub = sinon.stub(
          HeapDumpService.prototype,
          'updateContainer'
        );
        updateContainerWithExtentValueOrEntryStub = sinon.stub(
          HeapDumpService.prototype,
          'updateContainerWithExtentValueOrEntry'
        );
        getFrameHandlerStub = sinon
          .stub(LogContext.prototype, 'getFrameHandler')
          .returns(frameHandler);
        getRefsMapStub = sinon
          .stub(LogContext.prototype, 'getRefsMap')
          .returns(refsMap);
        getStaticVariablesClassMapStub = sinon
          .stub(LogContext.prototype, 'getStaticVariablesClassMap')
          .returns(staticVariablesClassMap);
      });

      afterEach(() => {
        getTopFrameStub.restore();
        getHeapDumpForThisLocationStub.restore();
        updateContainerStub.restore();
        updateContainerWithExtentValueOrEntryStub.restore();
        getFrameHandlerStub.restore();
        getRefsMapStub.restore();
        getStaticVariablesClassMapStub.restore();
      });

      it('Should not switch variables without a heapdump for current location', () => {
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(undefined);

        heapDumpService.replaceVariablesWithHeapDump();

        expect(updateContainerStub.called).to.be.false;
        expect(updateContainerWithExtentValueOrEntryStub.called).to.be.false;
      });

      it('Should not switch variables without a successful heapdump for current location', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        getHeapDumpForThisLocationStub = sinon
          .stub(LogContext.prototype, 'getHeapDumpForThisLocation')
          .returns(heapdump);

        heapDumpService.replaceVariablesWithHeapDump();

        expect(updateContainerStub.called).to.be.false;
        expect(updateContainerWithExtentValueOrEntryStub.called).to.be.false;
      });

      it('Should update instance variable', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        heapdump.setOverlaySuccessResult({
          HeapDump: {
            extents: [
              {
                typeName: 'Foo',
                definition: [{}],
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

        expect(updateContainerStub.called).to.be.false;
        expect(updateContainerWithExtentValueOrEntryStub.calledOnce).to.be.true;
        expect(
          updateContainerWithExtentValueOrEntryStub.getCall(0).args[1]
        ).to.equal(2);
      });

      it('Should update local variable', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        heapdump.setOverlaySuccessResult({
          HeapDump: {
            extents: [
              {
                typeName: 'String',
                definition: [
                  {
                    name: 'localStr',
                    type: 'String'
                  }
                ],
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

        expect(updateContainerWithExtentValueOrEntryStub.called).to.be.false;
        expect(updateContainerStub.calledOnce).to.be.true;
        expect(updateContainerStub.getCall(0).args[0]).to.equal(localVar);
        const extentValue = updateContainerStub.getCall(0)
          .args[1] as HeapDumpExtentValue;
        expect(extentValue.value).to.equal('new');
      });

      it('Should update static variable', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        heapdump.setOverlaySuccessResult({
          HeapDump: {
            extents: [
              {
                typeName: 'String',
                definition: [{}],
                extent: [
                  {
                    address: '0xString',
                    symbols: ['Foo.staticStr'],
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
        const staticVar = new ApexVariableContainer(
          'staticStr',
          'old',
          'String'
        );
        staticVariablesClassMap.set('Foo', new Map([['staticStr', staticVar]]));
        frameInfo.statics.set('staticStr', staticVar);
        const id = frameHandler.create(frameInfo);
        topFrame.id = id;

        heapDumpService.replaceVariablesWithHeapDump();

        expect(updateContainerWithExtentValueOrEntryStub.called).to.be.false;
        expect(updateContainerStub.calledOnce).to.be.true;
        expect(updateContainerStub.getCall(0).args[0]).to.equal(staticVar);
        const extentValue = updateContainerStub.getCall(0)
          .args[1] as HeapDumpExtentValue;
        expect(extentValue.value).to.equal('new');
      });

      it('Should revisit variable with an address', () => {
        const heapdump = new ApexHeapDump('some ID', 'Foo', '', 10);
        heapdump.setOverlaySuccessResult({
          HeapDump: {
            extents: [
              {
                typeName: 'Foo',
                definition: [{}],
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
                definition: [{}],
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

        expect(updateContainerWithExtentValueOrEntryStub.called).to.be.false;
        expect(updateContainerStub.calledOnce).to.be.true;
        expect(updateContainerStub.getCall(0).args[0]).to.equal(instanceVar);
        const extentValue = updateContainerStub.getCall(0)
          .args[1] as HeapDumpExtentValue;
        expect(extentValue.value).to.equal('new');
      });
    });

    describe('getStringVariableNamesAndValues', () => {
      it('Should get a list of strings', () => {
        const heapdump = {
          HeapDump: {
            extents: [
              {
                typeName: 'Account',
                extent: [
                  {
                    value: {
                      entry: [
                        {
                          keyDisplayValue: 'Name',
                          value: {
                            value: 'MyAccount'
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
                    value: {
                      value: 'Name'
                    }
                  },
                  {
                    value: {
                      value: 'MyAccount'
                    }
                  }
                ]
              }
            ]
          }
        } as ApexExecutionOverlayResultCommandSuccess;

        const strings = heapDumpService.getStringVariableNamesAndValues(
          heapdump
        );
        expect(strings.size).to.equal(2);
        expect(strings.get('Name')).to.equal('String');
        expect(strings.get('MyAccount')).to.equal('String');
      });
    });

    describe('addVariableTypesFromExtentDefinition', () => {
      it('Should add definitions to map of types', () => {
        let variableTypes = new Map([['foo', 'String']]);
        const definitions = [
          {
            name: 'MyAccount',
            type: 'Account'
          },
          {
            name: 'MyInteger',
            type: 'Integer'
          }
        ] as HeapDumpCollectionTypeDefinition[];

        variableTypes = heapDumpService.addVariableTypesFromExtentDefinition(
          variableTypes,
          definitions
        );

        expect(variableTypes.size).to.equal(3);
        expect(variableTypes.get('foo')).to.equal('String');
        expect(variableTypes.get('MyAccount')).to.equal('Account');
        expect(variableTypes.get('MyInteger')).to.equal('Integer');
      });
    });

    describe('isContainerForExtentEntry', () => {
      it('Should match container name with extent keyDisplayValue', () => {
        const varContainer = new ApexVariableContainer('foo', '', 'type');
        const extentValueEntry = {
          keyDisplayValue: 'foo'
        } as HeapDumpExtentValueEntry;

        expect(
          heapDumpService.isContainerForExtentEntry(
            varContainer,
            extentValueEntry
          )
        ).to.be.true;
      });

      it('Should not match container name with extent keyDisplayValue', () => {
        const varContainer = new ApexVariableContainer('foo', '', 'type');
        const extentValueEntry = {
          keyDisplayValue: 'bar'
        } as HeapDumpExtentValueEntry;

        expect(
          heapDumpService.isContainerForExtentEntry(
            varContainer,
            extentValueEntry
          )
        ).to.be.false;
      });
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
