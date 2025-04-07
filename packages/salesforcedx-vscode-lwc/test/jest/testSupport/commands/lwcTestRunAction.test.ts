/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Import types for type annotations
import { TestDirectoryInfo, TestExecutionInfo, TestInfoKind, TestType } from '../../../../src/testSupport/types';

// Create a proper mock Uri that satisfies type requirements
const createMockUri = (path: string) => ({
  scheme: 'file',
  authority: '',
  path,
  query: '',
  fragment: '',
  fsPath: path,
  with: jest.fn(),
  toString: jest.fn().mockReturnValue(path),
  toJSON: jest.fn().mockReturnValue({
    scheme: 'file',
    authority: '',
    path,
    query: '',
    fragment: ''
  })
});

// Set up a mock for the active text editor
let mockActiveTextEditor: any;

// Mock VS Code modules
jest.mock(
  'vscode',
  () => ({
    window: {
      get activeTextEditor() {
        return mockActiveTextEditor;
      },
      set activeTextEditor(value) {
        mockActiveTextEditor = value;
      }
    },
    Uri: {
      file: jest.fn(path => createMockUri(path))
    }
  }),
  { virtual: true }
);

// Setup function mocks
const mockExecuteAsSfTask = jest.fn().mockResolvedValue(undefined);

// Mock the TestRunner class
class MockTestRunner {
  constructor() {
    return {
      executeAsSfTask: mockExecuteAsSfTask
    };
  }
}

const mockIsLwcJestTest = jest.fn();
const mockGetTestWorkspaceFolder = jest.fn();

// Mock the TestRunner
jest.mock('../../../../src/testSupport/testRunner', () => ({
  TestRunner: MockTestRunner,
  TestRunType: {
    RUN: 'RUN'
  }
}));

// Mock functions that are imported and used by lwcTestRunAction
jest.mock('../../../../src/testSupport/utils', () => ({
  isLwcJestTest: mockIsLwcJestTest
}));

jest.mock('../../../../src/testSupport/workspace', () => ({
  workspace: {
    getTestWorkspaceFolder: mockGetTestWorkspaceFolder
  }
}));

// This is our real implementation that we're testing
// eslint-disable-next-line import/order
import * as LwcTestRunModule from '../../../../src/testSupport/commands/lwcTestRunAction';

describe('LWC Test Run Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('lwcTestRun', () => {
    it('should run tests using the TestRunner', async () => {
      const mockTestExecutionInfo = { mock: 'testInfo' } as unknown as TestExecutionInfo;

      await LwcTestRunModule.lwcTestRun(mockTestExecutionInfo);

      // Verify that executeAsSfTask was called
      expect(mockExecuteAsSfTask).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const mockTestExecutionInfo = { mock: 'testInfo' } as unknown as TestExecutionInfo;
      const mockError = new Error('Test error');

      // Make executeAsSfTask reject with an error
      mockExecuteAsSfTask.mockRejectedValueOnce(mockError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      try {
        await LwcTestRunModule.lwcTestRun(mockTestExecutionInfo);
      } catch {
        // Swallow error
      }

      // Verify that executeAsSfTask was called and error was logged
      expect(mockExecuteAsSfTask).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(mockError);

      consoleSpy.mockRestore();
    });
  });

  describe('lwcTestCaseRun', () => {
    it('should run a test case correctly', async () => {
      const mockTestExecutionInfo = { mock: 'testCaseInfo' } as unknown as TestExecutionInfo;
      const spy = jest.spyOn(LwcTestRunModule, 'lwcTestRun');

      await LwcTestRunModule.lwcTestCaseRun({ testExecutionInfo: mockTestExecutionInfo });

      expect(spy).toHaveBeenCalledWith(mockTestExecutionInfo);
      spy.mockRestore();
    });
  });

  describe('lwcTestFileRun', () => {
    it('should run a test file correctly', async () => {
      const mockTestExecutionInfo = { mock: 'testFileInfo' } as unknown as TestExecutionInfo;
      const spy = jest.spyOn(LwcTestRunModule, 'lwcTestRun');

      await LwcTestRunModule.lwcTestFileRun({ testExecutionInfo: mockTestExecutionInfo });

      expect(spy).toHaveBeenCalledWith(mockTestExecutionInfo);
      spy.mockRestore();
    });
  });

  describe('lwcTestRunAllTests', () => {
    it('should run all tests in the workspace folder', async () => {
      const mockUri = createMockUri('/workspace');
      const mockWorkspaceFolder = { uri: mockUri };
      mockGetTestWorkspaceFolder.mockReturnValue(mockWorkspaceFolder);

      const spy = jest.spyOn(LwcTestRunModule, 'lwcTestRun');

      await LwcTestRunModule.lwcTestRunAllTests();

      const expectedTestExecutionInfo: TestDirectoryInfo = {
        kind: TestInfoKind.TEST_DIRECTORY,
        testType: TestType.LWC,
        testUri: mockUri
      };

      expect(mockGetTestWorkspaceFolder).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expect.objectContaining(expectedTestExecutionInfo));
      spy.mockRestore();
    });

    it('should not run tests if no workspace folder is available', async () => {
      mockGetTestWorkspaceFolder.mockReturnValue(undefined);

      const spy = jest.spyOn(LwcTestRunModule, 'lwcTestRun');

      await LwcTestRunModule.lwcTestRunAllTests();

      expect(mockGetTestWorkspaceFolder).toHaveBeenCalled();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('lwcTestRunActiveTextEditorTest', () => {
    const mockUri = createMockUri('/test.js');
    const mockDocument = { uri: mockUri };

    it('should run the active text editor test if it is an LWC Jest test', async () => {
      // Setup mock active text editor
      mockActiveTextEditor = { document: mockDocument };
      mockIsLwcJestTest.mockReturnValue(true);

      const spy = jest.spyOn(LwcTestRunModule, 'lwcTestRun');

      await LwcTestRunModule.lwcTestRunActiveTextEditorTest();

      expect(mockIsLwcJestTest).toHaveBeenCalledWith(mockDocument);
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: TestInfoKind.TEST_FILE,
          testType: TestType.LWC,
          testUri: mockUri
        })
      );
      spy.mockRestore();
    });

    it('should not run test if active text editor is not an LWC Jest test', async () => {
      // Setup mock active text editor
      mockActiveTextEditor = { document: mockDocument };
      mockIsLwcJestTest.mockReturnValue(false);

      const spy = jest.spyOn(LwcTestRunModule, 'lwcTestRun');

      await LwcTestRunModule.lwcTestRunActiveTextEditorTest();

      expect(mockIsLwcJestTest).toHaveBeenCalledWith(mockDocument);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should not run test if there is no active text editor', async () => {
      mockActiveTextEditor = undefined;

      const spy = jest.spyOn(LwcTestRunModule, 'lwcTestRun');

      await LwcTestRunModule.lwcTestRunActiveTextEditorTest();

      expect(mockIsLwcJestTest).not.toHaveBeenCalled();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
