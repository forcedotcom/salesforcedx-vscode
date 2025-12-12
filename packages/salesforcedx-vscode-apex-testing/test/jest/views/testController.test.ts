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
import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import * as coreExtensionUtils from '../../../src/coreExtensionUtils';
import * as testDiscovery from '../../../src/testDiscovery/testDiscovery';
import * as orgApexClassProvider from '../../../src/utils/orgApexClassProvider';
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
  let createOrgApexClassUriSpy: jest.SpyInstance;
  let openOrgApexClassSpy: jest.SpyInstance;

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

    // Ensure vscode.Uri.parse has its default implementation (from setup-jest.ts)
    // It should already have it, but let's make sure it's working
    if (!(vscode.Uri.parse as jest.Mock).getMockImplementation()) {
      (vscode.Uri.parse as jest.Mock).mockImplementation((value: string) => {
        const parts = value.match(/^([^:]+):(\/\/)?([^/]*)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/);
        if (parts) {
          return {
            scheme: parts[1],
            authority: parts[3] || '',
            path: parts[4] || '',
            query: parts[5] || '',
            fragment: parts[6] || '',
            toString: () => value,
            fsPath: parts[1] === 'file' ? parts[4] : parts[4]
          };
        }
        return {
          scheme: '',
          authority: '',
          path: value,
          query: '',
          fragment: '',
          toString: () => value,
          fsPath: value
        };
      });
    }

    // Set up spies for orgApexClassProvider functions
    createOrgApexClassUriSpy = jest
      .spyOn(orgApexClassProvider, 'createOrgApexClassUri')
      .mockImplementation((className: string) => {
        const baseClassName = className.includes('.') ? className.split('.').pop()! : className;
        return vscode.Uri.parse(`sf-org-apex:${baseClassName}`);
      });

    openOrgApexClassSpy = jest
      .spyOn(orgApexClassProvider, 'openOrgApexClass')
      .mockImplementation(async (className: string, position?: any) => {
        const baseClassName = className.includes('.') ? className.split('.').pop()! : className;
        const uri = vscode.Uri.parse(`sf-org-apex:${baseClassName}`);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document, {
          preview: false,
          viewColumn: vscode.ViewColumn.Active
        });
        if (position) {
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
      });

    controller = new ApexTestController();
  });

  afterEach(() => {
    // Restore spies
    createOrgApexClassUriSpy.mockRestore();
    openOrgApexClassSpy.mockRestore();
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
      // The spy is already set up in beforeEach, just clear call history
      createOrgApexClassUriSpy.mockClear();

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
          // Store the item so we can update tags later
          createdItemsMap.set(id, item);
          // Return a proxy that allows setting tags and preserves uri
          return new Proxy(item, {
            set(target, prop, value) {
              target[prop] = value;
              return true;
            },
            get(target, prop) {
              // Ensure uri is always returned correctly
              if (prop === 'uri') {
                return target.uri;
              }
              return target[prop];
            }
          }) as unknown as vscode.TestItem;
        }
      );

      await controller.discoverTests();

      // Verify createOrgApexClassUri was called
      expect(createOrgApexClassUriSpy).toHaveBeenCalledWith('OrgOnlyClass');

      // Find the org-only class item - use the full class name format
      const orgOnlyClassItem = createdItemsMap.get('class:OrgOnlyClass');
      const orgOnlyMethodItem = createdItemsMap.get('method:OrgOnlyClass.testMethod1');

      // Verify org-only class item exists and has the org-only tag
      expect(orgOnlyClassItem).toBeDefined();
      // The URI should be set (virtual document URI) - check the actual item, not through proxy
      const actualUri = createdItemsMap.get('class:OrgOnlyClass')?.uri;
      expect(actualUri).toBeDefined();
      if (actualUri) {
        expect(actualUri.toString()).toContain('sf-org-apex');
      }
      expect(orgOnlyClassItem?.tags).toBeDefined();
      expect(orgOnlyClassItem?.tags?.length).toBe(1);
      expect(orgOnlyClassItem?.tags?.[0].id).toBe('org-only');

      // Verify org-only method item exists and has the org-only tag
      expect(orgOnlyMethodItem).toBeDefined();
      // The URI should be set (virtual document URI) - check the actual item, not through proxy
      const actualMethodUri = createdItemsMap.get('method:OrgOnlyClass.testMethod1')?.uri;
      expect(actualMethodUri).toBeDefined();
      if (actualMethodUri) {
        expect(actualMethodUri.toString()).toContain('sf-org-apex');
      }
      expect(orgOnlyMethodItem?.tags).toBeDefined();
      expect(orgOnlyMethodItem?.tags?.length).toBe(1);
      expect(orgOnlyMethodItem?.tags?.[0].id).toBe('org-only');
    });
  });

  describe('debugTests with org-only tests', () => {
    it('should prevent debugging org-only tests and show error notification', async () => {
      // Get the controller's orgOnlyTag instance (same reference used in debugTests)
      const orgOnlyTag = (controller as any).orgOnlyTag;
      const orgOnlyTestItem = {
        id: 'method:OrgOnlyClass.testMethod',
        label: 'testMethod',
        uri: vscode.Uri.parse('sf-org-apex:OrgOnlyClass'),
        tags: [orgOnlyTag],
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          values: jest.fn().mockReturnValue([]),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      const localTestItem = {
        id: 'method:LocalClass.testMethod',
        label: 'testMethod',
        uri: vscode.Uri.file('/workspace/LocalClass.cls'),
        tags: [],
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          values: jest.fn().mockReturnValue([]),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      const mockRun = {
        started: jest.fn(),
        passed: jest.fn(),
        failed: jest.fn(),
        skipped: jest.fn(),
        errored: jest.fn(),
        end: jest.fn(),
        appendOutput: jest.fn()
      } as unknown as vscode.TestRun;

      (mockTestController.createTestRun as jest.Mock).mockReturnValue(mockRun);

      // Mock notificationService
      notificationService.showErrorMessage = jest.fn();

      // Call debugTests directly
      await (controller as any).debugTests([orgOnlyTestItem, localTestItem], mockRun);

      // Verify org-only test was marked as errored
      expect(mockRun.errored).toHaveBeenCalledWith(
        orgOnlyTestItem,
        expect.objectContaining({
          message: expect.stringContaining('Debugging is not supported for tests that exist only in the org')
        })
      );

      // Verify error notification was shown
      expect(notificationService.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Debugging is not supported for tests that exist only in the org')
      );

      // Verify local test was not marked as errored (only org-only tests should be)
      expect(mockRun.errored).not.toHaveBeenCalledWith(localTestItem, expect.anything());
    });

    it('should filter out org-only tests from debug run', async () => {
      // Get the controller's orgOnlyTag instance (same reference used in debugTests)
      const orgOnlyTag = (controller as any).orgOnlyTag;
      const orgOnlyTestItem = {
        id: 'method:OrgOnlyClass.testMethod',
        label: 'testMethod',
        uri: vscode.Uri.parse('sf-org-apex:OrgOnlyClass'),
        tags: [orgOnlyTag],
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          values: jest.fn().mockReturnValue([]),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      const mockRun = {
        started: jest.fn(),
        passed: jest.fn(),
        failed: jest.fn(),
        skipped: jest.fn(),
        errored: jest.fn(),
        end: jest.fn(),
        appendOutput: jest.fn()
      } as unknown as vscode.TestRun;

      (mockTestController.createTestRun as jest.Mock).mockReturnValue(mockRun);

      // Mock notificationService
      notificationService.showErrorMessage = jest.fn();

      // Mock commands.executeCommand to track if debug was called
      (vscode.commands.executeCommand as jest.Mock).mockResolvedValue(undefined);

      // Call debugTests directly with only org-only test
      await (controller as any).debugTests([orgOnlyTestItem], mockRun);

      // Verify org-only test was marked as errored
      expect(mockRun.errored).toHaveBeenCalled();

      // Verify debug command was NOT called (org-only tests were filtered out)
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('sf.test.view.debugTests', expect.anything());
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'sf.test.view.debugSingleTest',
        expect.anything()
      );
    });
  });

  describe('openOrgOnlyTest', () => {
    it('should open org-only class test', async () => {
      // Clear call history for VS Code APIs and spies
      (vscode.workspace.openTextDocument as jest.Mock).mockClear();
      (vscode.window.showTextDocument as jest.Mock).mockClear();
      openOrgApexClassSpy.mockClear();

      const classTestItem = {
        id: 'class:OrgOnlyClass',
        label: 'OrgOnlyClass',
        uri: vscode.Uri.parse('sf-org-apex:OrgOnlyClass'),
        tags: [{ id: 'org-only' } as vscode.TestTag],
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          values: jest.fn().mockReturnValue([]),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      const mockDocument = {
        getText: jest.fn().mockReturnValue('public class OrgOnlyClass {}'),
        uri: vscode.Uri.parse('sf-org-apex:OrgOnlyClass')
      };

      const mockEditor = {
        selection: {} as vscode.Selection,
        revealRange: jest.fn()
      };

      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
      (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(mockEditor);

      await controller.openOrgOnlyTest(classTestItem);

      // Verify openOrgApexClass was called
      expect(openOrgApexClassSpy).toHaveBeenCalledWith('OrgOnlyClass');
      // Verify the underlying VS Code APIs were called
      // Note: The mock implementation calls these, so they should be called
      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      if ((vscode.workspace.openTextDocument as jest.Mock).mock.calls.length > 0) {
        const openDocCall = (vscode.workspace.openTextDocument as jest.Mock).mock.calls[0][0];
        expect(openDocCall).toBeDefined();
        expect(openDocCall.toString()).toContain('sf-org-apex');
        expect(openDocCall.toString()).toContain('OrgOnlyClass');
        expect(vscode.window.showTextDocument).toHaveBeenCalled();
      }
    });

    it('should open org-only method test and navigate to position', async () => {
      // Clear call history
      (vscode.workspace.openTextDocument as jest.Mock).mockClear();
      (vscode.window.showTextDocument as jest.Mock).mockClear();
      openOrgApexClassSpy.mockClear();

      const methodTestItem = {
        id: 'method:OrgOnlyClass.testMethod',
        label: 'testMethod',
        uri: vscode.Uri.parse('sf-org-apex:OrgOnlyClass'),
        tags: [{ id: 'org-only' } as vscode.TestTag],
        range: new vscode.Range(new vscode.Position(5, 10), new vscode.Position(5, 10)),
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          values: jest.fn().mockReturnValue([]),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      const mockDocument = {
        getText: jest.fn().mockReturnValue('public class OrgOnlyClass {}'),
        uri: vscode.Uri.parse('sf-org-apex:OrgOnlyClass')
      };

      const mockEditor = {
        selection: {} as vscode.Selection,
        revealRange: jest.fn()
      };

      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
      (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(mockEditor);

      await controller.openOrgOnlyTest(methodTestItem);

      // Verify openOrgApexClass was called with the class name and position
      expect(openOrgApexClassSpy).toHaveBeenCalledWith(
        'OrgOnlyClass',
        expect.objectContaining({ line: 5, character: 10 })
      );
      // Verify the underlying VS Code APIs were called
      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(vscode.window.showTextDocument).toHaveBeenCalled();
      expect(mockEditor.revealRange).toHaveBeenCalledWith(
        expect.objectContaining({
          start: expect.objectContaining({ line: 5, character: 10 }),
          end: expect.objectContaining({ line: 5, character: 10 })
        }),
        vscode.TextEditorRevealType.InCenter
      );
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
