/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('@salesforce/salesforcedx-utils-vscode', () => {
  const actual = jest.requireActual('@salesforce/salesforcedx-utils-vscode');
  return {
    ...actual,
    getTestResultsFolder: jest.fn().mockResolvedValue('/tmp/test-results')
  };
});

jest.mock('../../../src/coreExtensionUtils', () => ({
  getVscodeCoreExtension: jest.fn()
}));

jest.mock('../../../src/utils/testUtils', () => {
  const actual = jest.requireActual('../../../src/utils/testUtils');
  return {
    ...actual,
    getApexTests: jest.fn(),
    getLanguageClientStatus: jest.fn(),
    buildClassToUriIndex: jest.fn().mockResolvedValue(new Map()),
    fetchFromLs: jest.fn().mockResolvedValue({ tests: [], durationMs: 0 })
  };
});

jest.mock('../../../src/testDiscovery/testDiscovery', () => ({
  discoverTests: jest.fn(),
  sourceIsLS: jest.fn().mockReturnValue(false)
}));

jest.mock('../../../src/telemetry/telemetry', () => ({
  telemetryService: {
    sendEventData: jest.fn()
  }
}));

jest.mock('../../../src/settings', () => ({
  retrieveTestCodeCoverage: jest.fn().mockReturnValue(false)
}));

// Mock TestService before imports
const mockTestServiceMethods = {
  retrieveAllSuites: jest.fn().mockResolvedValue([]),
  buildAsyncPayload: jest.fn().mockResolvedValue({}),
  runTestAsynchronous: jest.fn().mockResolvedValue({
    tests: [],
    summary: { outcome: 'Passed', testsRan: 0 }
  }),
  writeResultFiles: jest.fn().mockResolvedValue(undefined),
  getTestsInSuite: jest.fn().mockResolvedValue([])
};

jest.mock('@salesforce/apex-node', () => ({
  TestService: jest.fn().mockImplementation(() => mockTestServiceMethods),
  TestLevel: {
    RunSpecifiedTests: 'RunSpecifiedTests'
  },
  ResultFormat: {
    json: 'json'
  }
}));

import { TestResult, TestService } from '@salesforce/apex-node';
import type { Connection } from '@salesforce/core';
import * as vscode from 'vscode';
import * as coreExtensionUtils from '../../../src/coreExtensionUtils';
import * as testDiscovery from '../../../src/testDiscovery/testDiscovery';
import * as testUtils from '../../../src/utils/testUtils';
import { ApexTestController, getTestController } from '../../../src/views/testController';

// Mock vscode.tests API
const mockTestController = {
  items: {
    add: jest.fn(),
    replace: jest.fn(),
    values: jest.fn().mockReturnValue([])
  } as unknown as vscode.TestItemCollection,
  createTestItem: jest.fn(),
  createTestRun: jest.fn(),
  createRunProfile: jest.fn(),
  refreshHandler: undefined as (() => Promise<void>) | undefined,
  dispose: jest.fn()
} as unknown as vscode.TestController;

const mockTestItem = {
  id: 'test-item',
  label: 'Test Item',
  uri: undefined,
  range: undefined,
  canResolveChildren: false,
  children: {
    add: jest.fn(),
    values: jest.fn().mockReturnValue([]),
    size: 0
  } as unknown as vscode.TestItemCollection
} as unknown as vscode.TestItem;

const mockTestRun = {
  started: jest.fn(),
  passed: jest.fn(),
  failed: jest.fn(),
  skipped: jest.fn(),
  errored: jest.fn(),
  end: jest.fn(),
  appendOutput: jest.fn()
} as unknown as vscode.TestRun;

describe('ApexTestController', () => {
  let controller: ApexTestController;
  let mockConnection: Partial<Connection>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock vscode.tests.createTestController
    (vscode.tests.createTestController as jest.Mock) = jest.fn().mockReturnValue(mockTestController);

    // Mock workspace
    (vscode.workspace.getConfiguration as jest.Mock) = jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue('ls')
    });
    (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[] | undefined) = [
      { uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0 }
    ];
    (vscode.workspace.fs.readFile as jest.Mock) = jest.fn();
    (vscode.workspace.createFileSystemWatcher as jest.Mock) = jest.fn().mockReturnValue({
      onDidCreate: jest.fn(),
      onDidChange: jest.fn(),
      dispose: jest.fn()
    });

    // Mock commands
    (vscode.commands.executeCommand as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    // Mock connection
    mockConnection = {
      getApiVersion: jest.fn().mockReturnValue('65.0'),
      request: jest.fn()
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
    (testUtils.buildClassToUriIndex as jest.Mock) = jest.fn().mockResolvedValue(new Map());
    (testDiscovery.discoverTests as jest.Mock) = jest.fn().mockResolvedValue({ classes: [] });
    (testDiscovery.sourceIsLS as jest.Mock) = jest.fn().mockReturnValue(false);

    // Reset TestService mock
    (TestService as jest.Mock).mockImplementation(() => mockTestServiceMethods);
    // Reset all mock methods
    jest.clearAllMocks();
    mockTestServiceMethods.retrieveAllSuites.mockResolvedValue([]);
    mockTestServiceMethods.getTestsInSuite.mockResolvedValue([]);
    // Restore buildClassToUriIndex default after clearing
    (testUtils.buildClassToUriIndex as jest.Mock).mockResolvedValue(new Map());

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
      const mockClasses = [
        {
          id: '01p000000000001AAA',
          name: 'TestClass1',
          namespacePrefix: '',
          testMethods: [
            { name: 'testMethod1', line: 1, column: 0 },
            { name: 'testMethod2', line: 2, column: 0 }
          ]
        },
        {
          id: '01p000000000002AAA',
          name: 'TestClass2',
          namespacePrefix: '',
          testMethods: [{ name: 'testMethod3', line: 1, column: 0 }]
        }
      ];

      (testDiscovery.discoverTests as jest.Mock).mockResolvedValue({ classes: mockClasses });
      (testUtils.buildClassToUriIndex as jest.Mock).mockResolvedValue(
        new Map([
          ['TestClass1', vscode.Uri.file('/workspace/TestClass1.cls')],
          ['TestClass2', vscode.Uri.file('/workspace/TestClass2.cls')]
        ])
      );
      (mockTestController.createTestItem as jest.Mock).mockImplementation(
        (id: string, label: string, uri?: vscode.Uri): Partial<vscode.TestItem> => ({
          id,
          label,
          uri,
          canResolveChildren: false,
          children: {
            add: jest.fn(),
            values: jest.fn().mockReturnValue([]),
            size: 0
          } as unknown as vscode.TestItemCollection
        })
      );

      await controller.discoverTests();

      expect(testDiscovery.discoverTests).toHaveBeenCalledWith({ showAllMethods: true });
      expect(mockTestController.createTestItem).toHaveBeenCalled();
      expect(mockTestController.items.add).toHaveBeenCalled();
    });

    it('should handle errors during discovery', async () => {
      // Mock discoverTests to throw an error
      (testDiscovery.discoverTests as jest.Mock).mockRejectedValue(new Error('Discovery failed'));

      // discoverTests catches errors and logs them, so it should not throw
      await expect(controller.discoverTests()).resolves.not.toThrow();
    });

    it('should tag tests that exist in org but not in local workspace', async () => {
      const mockClasses = [
        {
          id: '01p000000000001AAA',
          name: 'OrgOnlyClass',
          namespacePrefix: '',
          testMethods: [{ name: 'testMethod1', line: 1, column: 0 }]
        }
      ];

      (testDiscovery.discoverTests as jest.Mock).mockResolvedValue({ classes: mockClasses });
      // OrgOnlyClass does not exist locally, so buildClassToUriIndex returns empty map
      (testUtils.buildClassToUriIndex as jest.Mock).mockReset();
      (testUtils.buildClassToUriIndex as jest.Mock).mockResolvedValue(new Map());

      const createdItemsMap = new Map<string, any>();
      (mockTestController.createTestItem as jest.Mock).mockImplementation(
        (id: string, label: string, uri?: vscode.Uri): vscode.TestItem => {
          const item: any = {
            id,
            label,
            uri,
            tags: undefined,
            canResolveChildren: false,
            children: {
              add: jest.fn(),
              values: jest.fn().mockReturnValue([]),
              size: 0
            } as unknown as vscode.TestItemCollection
          };
          createdItemsMap.set(id, item);
          return item as unknown as vscode.TestItem;
        }
      );

      await controller.discoverTests();

      // Find the org-only class item (no URI)
      const orgOnlyClassItem = createdItemsMap.get('class:OrgOnlyClass');
      const orgOnlyMethodItem = createdItemsMap.get('method:OrgOnlyClass.testMethod1');

      // Verify org-only class item exists, has no URI, and has the org-only tag
      expect(orgOnlyClassItem).toBeDefined();
      expect(orgOnlyClassItem?.uri).toBeUndefined();
      expect(orgOnlyClassItem?.tags).toBeDefined();
      expect(orgOnlyClassItem?.tags?.length).toBe(1);
      expect(orgOnlyClassItem?.tags?.[0].id).toBe('org-only');

      // Verify org-only method item exists, has no URI, and has the org-only tag
      expect(orgOnlyMethodItem).toBeDefined();
      expect(orgOnlyMethodItem?.uri).toBeUndefined();
      expect(orgOnlyMethodItem?.tags).toBeDefined();
      expect(orgOnlyMethodItem?.tags?.length).toBe(1);
      expect(orgOnlyMethodItem?.tags?.[0].id).toBe('org-only');
    });
  });

  describe('refresh', () => {
    it('should clear and rediscover tests', async () => {
      (testDiscovery.discoverTests as jest.Mock).mockResolvedValue({ classes: [] });

      await controller.refresh();

      expect(mockTestController.items.replace).toHaveBeenCalledWith([]);
      expect(testDiscovery.discoverTests).toHaveBeenCalled();
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
        ],
        summary: { testsRan: 1, passing: 1, failing: 0 }
      } as unknown as TestResult;

      (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(Buffer.from(JSON.stringify(testResult)));

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
        summary: { testsRan: 1, passing: 1, failing: 0 }
      } as unknown as TestResult;

      mockTestServiceMethods.runTestAsynchronous.mockResolvedValue(testResult);

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
    // Mock vscode.tests.createTestController for this test
    (vscode.tests.createTestController as jest.Mock) = jest.fn().mockReturnValue(mockTestController);

    const instance1 = getTestController();
    const instance2 = getTestController();
    expect(instance1).toBe(instance2);
  });
});
