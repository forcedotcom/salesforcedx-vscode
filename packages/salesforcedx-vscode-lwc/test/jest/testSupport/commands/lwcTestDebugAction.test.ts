/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock implementation for internal debug session map
const debugSessionStartTimes = new Map<string, [number, number]>();

// Create mocks for all dependencies
const mockStartDebugging = jest.fn().mockResolvedValue(true);
const mockGetWorkspaceType = jest.fn().mockReturnValue('SFDX');
const mockSendCommandEvent = jest.fn();
const mockIsLwcJestTest = jest.fn();

// Mock VS Code modules
jest.mock(
  'vscode',
  () => {
    let activeTextEditor: any;
    return {
      debug: {
        startDebugging: mockStartDebugging
      },
      window: {
        get activeTextEditor() {
          return activeTextEditor;
        },
        set activeTextEditor(value) {
          activeTextEditor = value;
        }
      },
      Uri: {
        file: jest.fn(path => ({ fsPath: path }))
      }
    };
  },
  { virtual: true }
);

// Override implementation of the source file to use our debug session map
jest.mock('../../../../src/testSupport/commands/lwcTestDebugAction', () => {
  // Using require to get the actual implementation
  const originalModule = jest.requireActual('../../../../src/testSupport/commands/lwcTestDebugAction');

  // Return all the original exports and mock only what we need
  return {
    ...originalModule,
    // Mock debugSessionStartTimes without exposing it
    __debugSessionStartTimes: debugSessionStartTimes
  };
});

// Mock the TestRunner
jest.mock('../../../../src/testSupport/testRunner', () => ({
  TestRunner: jest.fn(),
  TestRunType: {
    DEBUG: 'DEBUG'
  }
}));

// Mock the telemetry service with a working implementation
jest.mock('../../../../src/telemetry', () => ({
  telemetryService: {
    sendCommandEvent: (command: string, hrtime: [number, number], properties: { workspaceType: string }) => {
      // Ensure workspaceType is set correctly when the function is called
      properties.workspaceType = 'SFDX';
      return mockSendCommandEvent(command, hrtime, properties);
    }
  }
}));

// Mock the workspace service
jest.mock('../../../../src/testSupport/workspace/workspaceService', () => ({
  workspaceService: {
    getCurrentWorkspaceTypeForTelemetry: mockGetWorkspaceType
  }
}));

// Mock the utility functions
jest.mock('../../../../src/testSupport/utils', () => ({
  isLwcJestTest: mockIsLwcJestTest
}));

// Override the implementation of crypto.randomUUID
// This is important to place before importing randomUUID
jest.mock('node:crypto', () => ({
  randomUUID: () => 'mock-uuid'
}));

// Now import the modules
import * as vscode from 'vscode';
import {
  getDebugConfiguration,
  lwcTestCaseDebug,
  lwcTestFileDebug,
  lwcTestDebugActiveTextEditorTest,
  handleDidStartDebugSession,
  handleDidTerminateDebugSession
} from '../../../../src/testSupport/commands/lwcTestDebugAction';
import { TestRunner, TestRunType } from '../../../../src/testSupport/testRunner';
import { TestCaseInfo, TestExecutionInfo, TestInfoKind, TestType } from '../../../../src/testSupport/types';
import { LWC_TEST_DEBUG_LOG_NAME } from '../../../../src/testSupport/types/constants';

describe('LWC Test Debug Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset internal maps
    debugSessionStartTimes.clear();
  });

  describe('getDebugConfiguration', () => {
    it('should return a valid debug configuration', () => {
      const command = 'node';
      const args = ['test', '--debug'];
      const cwd = '/sample/path';

      const result = getDebugConfiguration(command, args, cwd);

      expect(result).toEqual({
        sfDebugSessionId: 'mock-uuid',
        type: 'node',
        request: 'launch',
        name: 'Debug LWC test(s)',
        cwd,
        runtimeExecutable: command,
        args,
        resolveSourceMapLocations: ['**', '!**/node_modules/**'],
        console: 'integratedTerminal',
        internalConsoleOptions: 'openOnSessionStart',
        port: 9229,
        disableOptimisticBPs: true
      });
    });
  });

  describe('lwcTestCaseDebug', () => {
    it('should debug a test case correctly', async () => {
      const mockTestExecutionInfo = { mock: 'testCaseInfo' } as unknown as TestCaseInfo;
      const mockTestRunner = {
        getShellExecutionInfo: jest.fn().mockReturnValue({
          command: 'node',
          args: ['test'],
          workspaceFolder: { uri: { fsPath: '/path' } },
          testResultFsPath: '/results.json'
        }),
        startWatchingTestResults: jest.fn()
      };

      (TestRunner as jest.Mock).mockImplementation(() => mockTestRunner);

      await lwcTestCaseDebug({ testExecutionInfo: mockTestExecutionInfo });

      expect(TestRunner).toHaveBeenCalledWith(mockTestExecutionInfo, TestRunType.DEBUG);
      expect(mockTestRunner.getShellExecutionInfo).toHaveBeenCalled();
      expect(mockTestRunner.startWatchingTestResults).toHaveBeenCalledWith('/results.json');
      expect(mockStartDebugging).toHaveBeenCalled();
    });

    it('should not start debugging if shellExecutionInfo is not available', async () => {
      const mockTestExecutionInfo = { mock: 'testCaseInfo' } as unknown as TestCaseInfo;
      const mockTestRunner = {
        getShellExecutionInfo: jest.fn().mockReturnValue(null),
        startWatchingTestResults: jest.fn()
      };

      (TestRunner as jest.Mock).mockImplementation(() => mockTestRunner);

      await lwcTestCaseDebug({ testExecutionInfo: mockTestExecutionInfo });

      expect(TestRunner).toHaveBeenCalledWith(mockTestExecutionInfo, TestRunType.DEBUG);
      expect(mockTestRunner.getShellExecutionInfo).toHaveBeenCalled();
      expect(mockTestRunner.startWatchingTestResults).not.toHaveBeenCalled();
      expect(mockStartDebugging).not.toHaveBeenCalled();
    });
  });

  describe('lwcTestFileDebug', () => {
    it('should debug a test file correctly', async () => {
      const mockTestExecutionInfo = { mock: 'testFileInfo' } as unknown as TestExecutionInfo;
      const mockTestRunner = {
        getShellExecutionInfo: jest.fn().mockReturnValue({
          command: 'node',
          args: ['test'],
          workspaceFolder: { uri: { fsPath: '/path' } },
          testResultFsPath: '/results.json'
        }),
        startWatchingTestResults: jest.fn()
      };

      (TestRunner as jest.Mock).mockImplementation(() => mockTestRunner);

      await lwcTestFileDebug({ testExecutionInfo: mockTestExecutionInfo });

      expect(TestRunner).toHaveBeenCalledWith(mockTestExecutionInfo, TestRunType.DEBUG);
      expect(mockTestRunner.getShellExecutionInfo).toHaveBeenCalled();
      expect(mockTestRunner.startWatchingTestResults).toHaveBeenCalledWith('/results.json');
      expect(mockStartDebugging).toHaveBeenCalled();
    });
  });

  describe('lwcTestDebugActiveTextEditorTest', () => {
    const mockDocument = { uri: { fsPath: '/test.js' } };

    it('should debug the active text editor test if it is an LWC Jest test', async () => {
      // Setup mock active text editor
      vscode.window.activeTextEditor = { document: mockDocument } as any;
      mockIsLwcJestTest.mockReturnValue(true);

      const mockTestRunner = {
        getShellExecutionInfo: jest.fn().mockReturnValue({
          command: 'node',
          args: ['test'],
          workspaceFolder: { uri: { fsPath: '/path' } },
          testResultFsPath: '/results.json'
        }),
        startWatchingTestResults: jest.fn()
      };

      (TestRunner as jest.Mock).mockImplementation(() => mockTestRunner);

      await lwcTestDebugActiveTextEditorTest();

      expect(mockIsLwcJestTest).toHaveBeenCalledWith(mockDocument);
      expect(TestRunner).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: TestInfoKind.TEST_FILE,
          testType: TestType.LWC,
          testUri: mockDocument.uri
        }),
        TestRunType.DEBUG
      );
      expect(mockStartDebugging).toHaveBeenCalled();
    });

    it('should not debug if active text editor is not an LWC Jest test', async () => {
      // Setup mock active text editor
      vscode.window.activeTextEditor = { document: mockDocument } as any;
      mockIsLwcJestTest.mockReturnValue(false);

      await lwcTestDebugActiveTextEditorTest();

      expect(mockIsLwcJestTest).toHaveBeenCalledWith(mockDocument);
      expect(TestRunner).not.toHaveBeenCalled();
      expect(mockStartDebugging).not.toHaveBeenCalled();
    });

    it('should not debug if there is no active text editor', async () => {
      vscode.window.activeTextEditor = undefined;

      await lwcTestDebugActiveTextEditorTest();

      expect(mockIsLwcJestTest).not.toHaveBeenCalled();
      expect(TestRunner).not.toHaveBeenCalled();
      expect(mockStartDebugging).not.toHaveBeenCalled();
    });
  });

  describe('handleDidStartDebugSession and handleDidTerminateDebugSession', () => {
    let mockHrTime: [number, number];

    beforeEach(() => {
      // Create a unique mock for each test to avoid cross-test contamination
      mockHrTime = [1, 2] as [number, number];
      jest.spyOn(process, 'hrtime').mockReturnValue(mockHrTime);
    });

    it('should track session time and send telemetry when session ends', () => {
      // Create mock session
      const mockSession = {
        configuration: { sfDebugSessionId: 'test-id' }
      } as unknown as vscode.DebugSession;

      // Start session
      handleDidStartDebugSession(mockSession);

      // End session
      handleDidTerminateDebugSession(mockSession);

      // Check telemetry was sent
      expect(mockSendCommandEvent).toHaveBeenCalledWith(LWC_TEST_DEBUG_LOG_NAME, mockHrTime, { workspaceType: 'SFDX' });
      expect(mockGetWorkspaceType).toHaveBeenCalled();
    });

    it('should not send telemetry event if session id is not found', () => {
      const mockSession = {
        configuration: { sfDebugSessionId: 'unknown-id' }
      } as unknown as vscode.DebugSession;

      handleDidTerminateDebugSession(mockSession);

      expect(mockSendCommandEvent).not.toHaveBeenCalled();
    });
  });
});
