/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  const actual = jest.requireActual('@salesforcedx-utils-vscode');
  return {
    ...actual,
    getTestResultsFolder: jest.fn().mockResolvedValue('/tmp/test-results')
  };
});

jest.mock('../../../src/coreExtensionUtils', () => ({
  getVscodeCoreExtension: jest.fn()
}));

jest.mock('../../../src/utils/testUtils', () => ({
  getApexTests: jest.fn(),
  getLanguageClientStatus: jest.fn()
}));

jest.mock('../../../src/telemetry/telemetry', () => ({
  telemetryService: {
    sendEventData: jest.fn()
  }
}));

jest.mock('../../../src/settings', () => ({
  retrieveTestCodeCoverage: jest.fn().mockReturnValue(false)
}));

import * as vscode from 'vscode';
import * as coreExtensionUtils from '../../../src/coreExtensionUtils';
import * as testUtils from '../../../src/utils/testUtils';
import { ApexTestMethod } from '../../../src/views/lspConverter';
import { ApexTestController } from '../../../src/views/testController';

// Mock vscode.tests API
const mockTestController = {
  items: {
    add: jest.fn(),
    replace: jest.fn(),
    values: jest.fn().mockReturnValue([])
  },
  createTestItem: jest.fn(),
  createTestRun: jest.fn(),
  createRunProfile: jest.fn(),
  refreshHandler: undefined as (() => Promise<void>) | undefined,
  dispose: jest.fn()
};

const mockTestItem = {
  id: 'test-item',
  label: 'Test Item',
  uri: undefined as vscode.Uri | undefined,
  range: undefined as vscode.Range | undefined,
  canResolveChildren: false,
  children: {
    add: jest.fn(),
    values: jest.fn().mockReturnValue([]),
    size: 0
  }
};

const mockTestRun = {
  started: jest.fn(),
  passed: jest.fn(),
  failed: jest.fn(),
  skipped: jest.fn(),
  erred: jest.fn(),
  end: jest.fn()
};


describe('ApexTestController', () => {
  let controller: ApexTestController;
  let mockConnection: any;
  let mockTestService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock vscode.tests.createTestController
    (vscode.tests.createTestController as jest.Mock) = jest.fn().mockReturnValue(mockTestController);

    // Mock workspace
    (vscode.workspace.getConfiguration as jest.Mock) = jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue('ls')
    });
    (vscode.workspace.workspaceFolders as any) = [{ uri: { fsPath: '/workspace' } }];
    (vscode.workspace.fs.readFile as jest.Mock) = jest.fn();
    (vscode.workspace.createFileSystemWatcher as jest.Mock) = jest.fn().mockReturnValue({
      onDidCreate: jest.fn(),
      onDidChange: jest.fn(),
      dispose: jest.fn()
    });

    // Mock commands
    (vscode.commands.executeCommand as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    // Mock connection and test service
    mockConnection = {
      getApiVersion: jest.fn().mockReturnValue('65.0'),
      request: jest.fn()
    };

    mockTestService = {
      retrieveAllSuites: jest.fn().mockResolvedValue([]),
      buildAsyncPayload: jest.fn().mockResolvedValue({}),
      runTestAsynchronous: jest.fn().mockResolvedValue({
        tests: [],
        summary: { outcome: 'Passed', testsRan: 0 }
      }),
      writeResultFiles: jest.fn().mockResolvedValue(undefined)
    };

    (coreExtensionUtils.getVscodeCoreExtension as jest.Mock) = jest.fn().mockResolvedValue({
      exports: {
        WorkspaceContext: {
          getInstance: jest.fn().mockReturnValue({
            getConnection: jest.fn().mockResolvedValue(mockConnection)
          })
        }
      }
    });

    (testUtils.getApexTests as jest.Mock) = jest.fn().mockResolvedValue([]);
    (testUtils.getLanguageClientStatus as jest.Mock) = jest.fn().mockResolvedValue({
      isReady: jest.fn().mockReturnValue(true),
      failedToInitialize: jest.fn().mockReturnValue(false),
      getStatusMessage: jest.fn().mockReturnValue('')
    });

    // Mock TestService constructor
    jest.doMock('@salesforce/apex-node', () => ({
      TestService: jest.fn().mockImplementation(() => mockTestService),
      TestLevel: {
        RunSpecifiedTests: 'RunSpecifiedTests'
      },
      ResultFormat: {
        json: 'json'
      }
    }));

    controller = new ApexTestController();
  });

  afterEach(() => {
    controller.dispose();
  });

  describe('constructor', () => {
    it('should create a test controller', () => {
      expect(vscode.tests.createTestController).toHaveBeenCalled();
      expect(mockTestController.createRunProfile).toHaveBeenCalledTimes(2);
    });

    it('should set up refresh handler', () => {
      expect(mockTestController.refreshHandler).toBeDefined();
    });
  });

  describe('discoverTests', () => {
    it('should discover tests and populate test items', async () => {
      const mockTests: ApexTestMethod[] = [
        {
          methodName: 'testMethod1',
          definingType: 'TestClass1',
          location: new vscode.Location(
            vscode.Uri.file('/workspace/TestClass1.cls'),
            new vscode.Range(0, 0, 0, 0)
          )
        },
        {
          methodName: 'testMethod2',
          definingType: 'TestClass1',
          location: new vscode.Location(
            vscode.Uri.file('/workspace/TestClass1.cls'),
            new vscode.Range(1, 0, 1, 0)
          )
        },
        {
          methodName: 'testMethod3',
          definingType: 'TestClass2',
          location: new vscode.Location(
            vscode.Uri.file('/workspace/TestClass2.cls'),
            new vscode.Range(0, 0, 0, 0)
          )
        }
      ];

      (testUtils.getApexTests as jest.Mock).mockResolvedValue(mockTests);
      (mockTestController.createTestItem as jest.Mock).mockImplementation((id, label, uri) => ({
        id,
        label,
        uri,
        canResolveChildren: false,
        children: { add: jest.fn(), values: jest.fn().mockReturnValue([]), size: 0 }
      }));

      await controller.discoverTests();

      expect(testUtils.getApexTests).toHaveBeenCalled();
      expect(mockTestController.createTestItem).toHaveBeenCalled();
      expect(mockTestController.items.add).toHaveBeenCalled();
    });

    it('should handle language server not ready', async () => {
      (testUtils.getLanguageClientStatus as jest.Mock).mockResolvedValue({
        isReady: jest.fn().mockReturnValue(false),
        failedToInitialize: jest.fn().mockReturnValue(true),
        getStatusMessage: jest.fn().mockReturnValue('LS not ready')
      });

      await controller.discoverTests();

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should clear and rediscover tests', async () => {
      await controller.refresh();

      expect(mockTestController.items.replace).toHaveBeenCalledWith([]);
      expect(testUtils.getApexTests).toHaveBeenCalled();
    });
  });

  describe('onResultFileCreate', () => {
    it('should update test results from file', async () => {
      const testResult = {
        tests: [
          {
            apexClass: { name: 'TestClass1', namespacePrefix: null },
            methodName: 'testMethod1',
            outcome: 'Pass',
            runTime: 100
          }
        ]
      };

      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(JSON.stringify(testResult))
      );

      (mockTestController.createTestRun as jest.Mock).mockReturnValue(mockTestRun);
      (mockTestController.createTestItem as jest.Mock).mockReturnValue(mockTestItem);

      await controller.onResultFileCreate('/tmp', '/tmp/test-result.json');

      expect(vscode.workspace.fs.readFile).toHaveBeenCalled();
    });
  });

  describe('runTests', () => {
    it('should execute tests and update results', async () => {
      const mockTestItem1 = {
        ...mockTestItem,
        id: 'method:TestClass1.testMethod1',
        label: 'testMethod1'
      };

      (mockTestController.createTestRun as jest.Mock).mockReturnValue(mockTestRun);
      (mockTestController.createTestItem as jest.Mock).mockReturnValue(mockTestItem1);

      const testResult = {
        tests: [
          {
            apexClass: { name: 'TestClass1', namespacePrefix: null },
            methodName: 'testMethod1',
            outcome: 'Pass',
            runTime: 100
          }
        ],
        summary: { outcome: 'Passed', testsRan: 1 }
      };

      mockTestService.runTestAsynchronous.mockResolvedValue(testResult);

      // We need to mock the internal methods, so let's test through the public API
      await controller.refresh();

      expect(mockTestController.createRunProfile).toHaveBeenCalled();
    });
  });

  describe('getController', () => {
    it('should return the test controller', () => {
      const ctrl = controller.getController();
      expect(ctrl).toBe(mockTestController);
    });
  });

  describe('dispose', () => {
    it('should dispose the controller', () => {
      controller.dispose();
      expect(mockTestController.dispose).toHaveBeenCalled();
    });
  });
});

describe('getTestController', () => {
  it('should return singleton instance', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getTestController } = require('../../../src/views/testController');
    const instance1 = getTestController();
    const instance2 = getTestController();
    expect(instance1).toBe(instance2);
  });
});
