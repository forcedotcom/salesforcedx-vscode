import { expect } from 'chai';
import * as path from 'path';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { FunctionService } from '../../../../src/commands/functions/functionService';
import {
  FUNCTION_DEFAULT_DEBUG_PORT,
  FUNCTION_DEFAULT_PORT
} from '../../../../src/commands/functions/types/constants';
import { getRootWorkspace, getRootWorkspacePath } from '../../../../src/util';
import { MockContext } from '../../telemetry/MockContext';

describe('Function Service', () => {
  let sandbox: SinonSandbox;
  beforeEach(() => {
    sandbox = createSandbox();
  });
  afterEach(() => {
    sandbox.restore();
  });

  describe('Debug', () => {
    const vscodeDebugStubs: {
      [key: string]: SinonStub;
    } = {};

    beforeEach(() => {
      vscodeDebugStubs.startDebuggingStub = sandbox.stub(
        vscode.debug,
        'startDebugging'
      );
      vscodeDebugStubs.stopDebuggingStub = sandbox.stub(
        vscode.debug,
        'stopDebugging'
      );
      vscodeDebugStubs.onDidStartDebugSessionStub = sandbox.stub(
        vscode.debug,
        'onDidStartDebugSession'
      );
      vscodeDebugStubs.onDidTerminateDebugSessionStub = sandbox.stub(
        vscode.debug,
        'onDidTerminateDebugSession'
      );
    });

    const mockDebugSession: vscode.DebugSession = {
      id: '',
      name: 'Debug Invoke',
      type: 'node',
      workspaceFolder: getRootWorkspace(),
      configuration: {
        type: 'node',
        name: 'Debug Invoke',
        request: 'attach'
      },
      customRequest: () => {
        return Promise.resolve();
      },
      getDebugProtocolBreakpoint: () => Promise.resolve(undefined)
    };

    it('Should start a debug session and attach to debug port', async () => {
      const rootDir = path.join(
        getRootWorkspacePath(),
        'functions/demoJavaScriptFunction'
      );
      const debugPort = FUNCTION_DEFAULT_DEBUG_PORT;
      const getStartedFunctionStub = sandbox.stub(
        FunctionService.prototype,
        'getStartedFunction'
      );
      getStartedFunctionStub.returns({
        rootDir,
        port: FUNCTION_DEFAULT_PORT,
        debugPort
      });

      await FunctionService.instance.debugFunction(rootDir);

      assert.calledOnce(vscodeDebugStubs.startDebuggingStub);
      assert.calledWith(
        vscodeDebugStubs.startDebuggingStub,
        getRootWorkspace(),
        {
          type: undefined,
          request: 'attach',
          name: 'Debug Invoke',
          resolveSourceMapLocations: ['**', '!**/node_modules/**'],
          console: 'integratedTerminal',
          internalConsoleOptions: 'openOnSessionStart',
          localRoot: rootDir,
          remoteRoot: '/workspace',
          port: debugPort,
          hostName: '127.0.0.1'
        }
      );
    });

    it('Should stop debug session', async () => {
      const rootDir = path.join(
        getRootWorkspacePath(),
        'functions/demoJavaScriptFunction'
      );
      const getStartedFunctionStub = sandbox.stub(
        FunctionService.prototype,
        'getStartedFunction'
      );
      getStartedFunctionStub.returns({
        rootDir,
        port: FUNCTION_DEFAULT_PORT,
        debugPort: FUNCTION_DEFAULT_DEBUG_PORT,
        debugSession: mockDebugSession
      });

      await FunctionService.instance.stopDebuggingFunction(rootDir);

      assert.calledOnce(vscodeDebugStubs.stopDebuggingStub);
      assert.calledWith(vscodeDebugStubs.stopDebuggingStub, mockDebugSession);
    });

    it('Should set active debug session of function', () => {
      const mockEventEmitter = new vscode.EventEmitter<vscode.DebugSession>();
      vscodeDebugStubs.onDidStartDebugSessionStub.callsFake(
        (
          listener: (e: vscode.DebugSession) => any,
          thisArgs?: any,
          disposables?: vscode.Disposable[]
        ) => {
          mockEventEmitter.event(listener, thisArgs, disposables);
        }
      );
      const rootDir = path.join(
        getRootWorkspacePath(),
        'functions/demoJavaScriptFunction'
      );
      const getStartedFunctionStub = sandbox.stub(
        FunctionService.prototype,
        'getStartedFunction'
      );
      getStartedFunctionStub.returns({
        rootDir,
        port: FUNCTION_DEFAULT_PORT,
        debugPort: FUNCTION_DEFAULT_DEBUG_PORT
      });
      const mockContext = new MockContext(false);

      FunctionService.instance.handleDidStartTerminateDebugSessions(
        mockContext
      );
      mockEventEmitter.fire(mockDebugSession);

      expect(
        FunctionService.instance.getStartedFunction(rootDir)
      ).to.have.deep.property('debugSession', mockDebugSession);
    });

    it('Should remove active debug session of function', () => {
      const mockEventEmitter = new vscode.EventEmitter<vscode.DebugSession>();
      vscodeDebugStubs.onDidTerminateDebugSessionStub.callsFake(
        (
          listener: (e: vscode.DebugSession) => any,
          thisArgs?: any,
          disposables?: vscode.Disposable[]
        ) => {
          mockEventEmitter.event(listener, thisArgs, disposables);
        }
      );
      const rootDir = path.join(
        getRootWorkspacePath(),
        'functions/demoJavaScriptFunction'
      );
      const getStartedFunctionStub = sandbox.stub(
        FunctionService.prototype,
        'getStartedFunction'
      );
      getStartedFunctionStub.returns({
        rootDir,
        port: FUNCTION_DEFAULT_PORT,
        debugPort: FUNCTION_DEFAULT_DEBUG_PORT,
        debugSession: mockDebugSession
      });
      const mockContext = new MockContext(false);

      FunctionService.instance.handleDidStartTerminateDebugSessions(
        mockContext
      );
      mockEventEmitter.fire(mockDebugSession);

      expect(
        FunctionService.instance.getStartedFunction(rootDir)
      ).to.have.property('debugSession', undefined);
    });

    it('Should update debugType of a Java function', () => {
      const service = new FunctionService();
      service.registerStartedFunction({
        rootDir: 'Foo',
        debugPort: 7777,
        port: 8080,
        debugType: 'unknown',
        terminate: () => Promise.resolve()
      });

      service.updateFunction('Foo', 'Java');
      expect(service.getStartedFunction('Foo')?.debugType).to.equal('java');
      expect(service.getFunctionLanguage()).to.equal('java');
    });

    it('Should update debugType of a Java JVM function', () => {
      const service = new FunctionService();
      service.registerStartedFunction({
        rootDir: 'Foo',
        debugPort: 7777,
        port: 8080,
        debugType: 'unknown',
        terminate: () => Promise.resolve()
      });

      service.updateFunction('Foo', 'jvm');
      expect(service.getStartedFunction('Foo')?.debugType).to.equal('java');
      expect(service.getFunctionLanguage()).to.equal('java');
    });

    it('Should update debugType of a Node function', () => {
      const service = new FunctionService();
      service.registerStartedFunction({
        rootDir: 'Bar',
        debugPort: 7777,
        port: 8080,
        debugType: 'unknown',
        terminate: () => Promise.resolve()
      });

      service.updateFunction('Bar', 'Node.js');
      expect(service.getStartedFunction('Bar')?.debugType).to.equal('node');
      expect(service.getFunctionLanguage()).to.equal('node');
    });

    it('Should not update debugType of an unknown function', () => {
      const service = new FunctionService();
      service.registerStartedFunction({
        rootDir: 'FirstFunction',
        debugPort: 7777,
        port: 8080,
        debugType: 'unknown',
        terminate: () => Promise.resolve()
      });

      // right function, wrong type
      service.updateFunction('FirstFunction', 'random');
      expect(service.getStartedFunction('FirstFunction')?.debugType).to.equal(
        'unknown'
      );
      expect(service.getFunctionLanguage()).to.equal('unknown');

      // wrong function, right type
      service.updateFunction('Foo', 'Java');
      expect(service.getStartedFunction('FirstFunction')?.debugType).to.equal(
        'unknown'
      );
      expect(service.getFunctionLanguage()).to.equal('unknown');
    });
  });
});
