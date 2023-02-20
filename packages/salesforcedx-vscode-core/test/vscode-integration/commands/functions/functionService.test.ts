import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import {
  FunctionExecution,
  FunctionService,
  functionType
} from '../../../../src/commands/functions/functionService';
import {
  FUNCTION_DEFAULT_DEBUG_PORT,
  FUNCTION_DEFAULT_PORT
} from '../../../../src/commands/functions/types/constants';
import { nls } from '../../../../src/messages';
import { workspaceUtils } from '../../../../src/util';
import { MockExtensionContext } from '../../telemetry/MockExtensionContext';

describe('Function Service', () => {
  let sandbox: SinonSandbox;
  beforeEach(() => {
    sandbox = createSandbox();
  });
  afterEach(() => {
    // Reset the instance var on the FunctionService so we're starting fresh as the tests expect.
    (FunctionService as any)._instance = undefined;
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
      workspaceFolder: workspaceUtils.getRootWorkspace(),
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
        workspaceUtils.getRootWorkspacePath(),
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

      const getFunctionTypeStub = sandbox.stub(
        FunctionService.prototype,
        'getFunctionType'
      );
      getFunctionTypeStub.returns(functionType.JAVASCRIPT);

      await FunctionService.instance.debugFunction(rootDir);

      assert.calledOnce(vscodeDebugStubs.startDebuggingStub);
      assert.calledWith(
        vscodeDebugStubs.startDebuggingStub,
        workspaceUtils.getRootWorkspace(),
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
        workspaceUtils.getRootWorkspacePath(),
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
        workspaceUtils.getRootWorkspacePath(),
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
      const mockExtensionContext = new MockExtensionContext(false);

      FunctionService.instance.handleDidStartTerminateDebugSessions(
        mockExtensionContext
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
        workspaceUtils.getRootWorkspacePath(),
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
      const mockExtensionContext = new MockExtensionContext(false);

      FunctionService.instance.handleDidStartTerminateDebugSessions(
        mockExtensionContext
      );
      mockEventEmitter.fire(mockDebugSession);

      expect(
        FunctionService.instance.getStartedFunction(rootDir)
      ).to.have.property('debugSession', undefined);
    });

    it('Should update debugType of a Java function', () => {
      const service = FunctionService.instance;
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
      const service = FunctionService.instance;
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
      const service = FunctionService.instance;
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
      const service = FunctionService.instance;
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

  describe('Function type.', () => {
    let fsSyncStub: SinonStub;

    const functionDef: FunctionExecution = {
      rootDir: 'FirstFunction',
      debugPort: 7777,
      port: 8080,
      debugType: 'unknown',
      terminate: () => Promise.resolve()
    };

    beforeEach(() => {
      fsSyncStub = sandbox.stub(fs, 'existsSync');
    });

    it('Should throw error if no started function.', () => {
      const service = FunctionService.instance;
      expect(() => {
        service.getFunctionType();
      }).to.throw(nls.localize('error_function_type'));
    });

    it('Should identify a typscript function.', () => {
      fsSyncStub.returns(true);
      const service = FunctionService.instance;
      service.registerStartedFunction(functionDef);
      const functionTypeVal = service.getFunctionType();
      expect(functionTypeVal).to.equal(functionType.TYPESCRIPT);
      expect(fsSyncStub.callCount).to.equal(1);
      expect(fsSyncStub.getCall(0).args[0]).to.equal(
        `${functionDef.rootDir}/tsconfig.json`
      );
    });

    it('Should identify a javascript function.', () => {
      fsSyncStub.onCall(0).returns(false);
      fsSyncStub.onCall(1).returns(true);
      const service = FunctionService.instance;
      service.registerStartedFunction(functionDef);
      const functionTypeVal = service.getFunctionType();
      expect(functionTypeVal).to.equal(functionType.JAVASCRIPT);
      expect(fsSyncStub.callCount).to.equal(2);
      expect(fsSyncStub.getCall(1).args[0]).to.equal(
        `${functionDef.rootDir}/package.json`
      );
    });

    it('Should identify a java function.', () => {
      fsSyncStub.onCall(0).returns(false);
      fsSyncStub.onCall(1).returns(false);
      const service = FunctionService.instance;
      service.registerStartedFunction(functionDef);
      const functionTypeVal = service.getFunctionType();
      expect(functionTypeVal).to.equal(functionType.JAVA);
      expect(fsSyncStub.callCount).to.equal(2);
    });
  });

  describe('Debug Configuration', () => {
    let getFunctionTypeStub: SinonStub;

    beforeEach(() => {
      getFunctionTypeStub = sandbox.stub(
        FunctionService.prototype,
        'getFunctionType'
      );
    });

    afterEach(() => {
      getFunctionTypeStub.restore();
    });

    it('Should validate that remoteRoot is not defined when JavaScript and running containerless.', () => {
      const functionDef: FunctionExecution = {
        rootDir: 'FirstFunction',
        debugPort: 7777,
        port: 8080,
        debugType: 'unknown',
        terminate: () => Promise.resolve()
      };
      getFunctionTypeStub.returns(functionType.JAVASCRIPT);

      const service = FunctionService.instance;
      service.registerStartedFunction(functionDef);
      const rootDir = 'FirstFunction';
      const functionExecution = service.getStartedFunction(rootDir);
      const debugConfiguration = service.getDebugConfiguration(
        functionExecution!,
        rootDir
      );
      expect(debugConfiguration.hasOwnProperty('remoteRoot')).to.equal(false);
    });

    it('Should validate that remoteRoot is not defined when TypeScript and running containerless.', () => {
      const functionDef: FunctionExecution = {
        rootDir: 'FirstFunction',
        debugPort: 7777,
        port: 8080,
        debugType: 'unknown',
        terminate: () => Promise.resolve()
      };
      getFunctionTypeStub.returns(functionType.TYPESCRIPT);

      const service = FunctionService.instance;
      service.registerStartedFunction(functionDef);
      const rootDir = 'FirstFunction';
      const functionExecution = service.getStartedFunction(rootDir);
      const debugConfiguration = service.getDebugConfiguration(
        functionExecution!,
        rootDir
      );
      expect(debugConfiguration.hasOwnProperty('remoteRoot')).to.equal(false);
    });

    it('Should validate that remoteRoot is not defined when Java and running containerless.', () => {
      const functionDef: FunctionExecution = {
        rootDir: 'FirstFunction',
        debugPort: 7777,
        port: 8080,
        debugType: 'unknown',
        terminate: () => Promise.resolve()
      };
      getFunctionTypeStub.returns(functionType.JAVA);

      const service = FunctionService.instance;
      service.registerStartedFunction(functionDef);
      const rootDir = 'FirstFunction';
      const functionExecution = service.getStartedFunction(rootDir);
      const debugConfiguration = service.getDebugConfiguration(
        functionExecution!,
        rootDir
      );
      expect(debugConfiguration.hasOwnProperty('remoteRoot')).to.equal(false);
    });
  });
});
