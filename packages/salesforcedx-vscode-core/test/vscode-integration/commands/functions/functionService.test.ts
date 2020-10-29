import { expect } from 'chai';
import * as path from 'path';
import { assert, createSandbox, match, SinonSandbox, SinonStub } from 'sinon';
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
      }
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
          type: 'node',
          request: 'attach',
          name: 'Debug Invoke',
          resolveSourceMapLocations: ['**', '!**/node_modules/**'],
          console: 'integratedTerminal',
          internalConsoleOptions: 'openOnSessionStart',
          localRoot: rootDir,
          remoteRoot: '/workspace',
          port: debugPort
        }
      );
    });

    it('Should stop debug session', async () => {
      const rootDir = path.join(
        getRootWorkspacePath(),
        'functions/demoJavaScriptFunction'
      );
      const customRequestStub = sandbox.stub(mockDebugSession, 'customRequest');
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

      assert.calledOnce(customRequestStub);
      assert.calledWith(customRequestStub, 'disconnect');
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
  });
});
