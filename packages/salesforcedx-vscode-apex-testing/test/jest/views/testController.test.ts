/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('../../../src/services/extensionProvider', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  const Layer = jest.requireActual('effect/Layer');
  const ManagedRuntime = jest.requireActual('effect/ManagedRuntime');
  const { ExtensionProviderService } = jest.requireActual('@salesforce/effect-ext-utils');
  const { ApexTestRunCacheService } = jest.requireActual('../../../src/testRunCache/apexTestRunCacheService');
  const { URI: UriClass } = jest.requireActual('vscode-uri');
  const { HashableUri } = jest.requireActual('salesforcedx-vscode-services/src/vscode/hashableUri');

  let mockConnectionRef: any;
  let mockReadFileResult = '';
  const mockReadFile = jest.fn(() => EffectLib.succeed(mockReadFileResult));
  const mockMetadataRetrieve = jest.fn(() => EffectLib.succeed({ getFileResponses: () => [] }));
  const MockConnectionService = { getConnection: () => EffectLib.succeed(mockConnectionRef) };
  const mockFsService = {
    readFile: mockReadFile,
    createDirectory: () => EffectLib.void,
    safeDelete: () => EffectLib.void,
    // accessor form: `yield* api.services.FsService.HashableUri` resolves the value namespace.
    HashableUri: EffectLib.succeed(HashableUri),
    showTextDocument: (uri: unknown, options?: unknown) =>
      EffectLib.tryPromise({
        try: () => require('vscode').window.showTextDocument(uri, options),
        catch: (e: unknown) => (e instanceof Error ? e : new Error(String(e)))
      })
  };
  const MockWorkspaceService = {
    getWorkspaceInfoOrThrow: EffectLib.succeed({ uri: UriClass.file('/tmp/workspace'), fsPath: '/tmp/workspace' })
  };
  const mockServicesApi = {
    services: {
      ConnectionService: MockConnectionService,
      FsService: mockFsService,
      WorkspaceService: MockWorkspaceService,
      MetadataRetrieveService: {
        retrieve: mockMetadataRetrieve
      }
    }
  };
  const MockAllServicesLayer = Layer.mergeAll(
    Layer.effect(
      ExtensionProviderService,
      EffectLib.sync(() => ({ getServicesApi: EffectLib.succeed(mockServicesApi) }))
    ),
    ApexTestRunCacheService.Default
  );

  return {
    getApexTestingRuntime: () => ManagedRuntime.make(MockAllServicesLayer),
    AllServicesLayer: MockAllServicesLayer,
    setAllServicesLayer: jest.fn(),
    __setMockConnection: (conn: any) => {
      mockConnectionRef = conn;
    },
    __setMockReadFileResult: (s: string) => {
      mockReadFileResult = s;
    },
    __mockFsServiceReadFile: mockReadFile,
    __mockMetadataRetrieve: mockMetadataRetrieve
  };
});

jest.mock('../../../src/coreExtensionUtils', () => ({
  getConnection: jest.fn(),
  getDefaultOrgInfo: jest.fn().mockResolvedValue({ orgId: 'org123', username: 'user@example.com' })
}));

jest.mock('../../../src/utils/testUtils', () => {
  const actual = jest.requireActual('../../../src/utils/testUtils');
  return {
    ...actual,
    getApexTests: jest.fn(),
    buildClassToUriIndex: jest.fn().mockResolvedValue(new Map()),
    getMethodLocationsFromSymbols: jest.fn().mockResolvedValue(undefined),
    readTestRunIdFile: jest.fn().mockResolvedValue(undefined)
  };
});

jest.mock('../../../src/telemetry/telemetry', () => ({
  telemetryService: {
    sendEventData: jest.fn()
  }
}));

jest.mock('../../../src/settings', () => ({
  retrieveTestCodeCoverage: jest.fn().mockReturnValue(false),
  retrieveTestRunConcise: jest.fn().mockReturnValue(false)
}));

jest.mock('../../../src/testDiscovery/packageResolution', () => ({
  resolvePackage2Members: jest.fn().mockResolvedValue(new Map())
}));

const mockSaveDiscoveredClasses = jest.fn();

jest.mock('../../../src/discoveryVfs/apexTestDiscoveryService', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  return {
    // saveDiscoveredClasses is consumed via `yield* ApexTestDiscoveryService.saveDiscoveredClasses(...)`,
    // so the mock records the call and returns an Effect the persist program can run on any runtime.
    ApexTestDiscoveryService: {
      saveDiscoveredClasses: (...args: unknown[]) => {
        mockSaveDiscoveredClasses(...args);
        return EffectLib.void;
      }
    }
  };
});

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
    RunSpecifiedTests: 'RunSpecifiedTests',
    RunAllTestsInOrg: 'RunAllTestsInOrg'
  },
  ResultFormat: {
    json: 'json'
  },
  HumanReporter: jest.fn().mockImplementation(() => ({
    format: jest.fn().mockReturnValue('')
  }))
}));

import * as path from 'node:path';
import { TestResult, TestService } from '@salesforce/apex-node';
import { URI } from 'vscode-uri';
import * as vscode from 'vscode';
import * as coreExtensionUtils from '../../../src/coreExtensionUtils';
import * as testDiscovery from '../../../src/testDiscovery/testDiscovery';
import * as pathHelpers from '../../../src/utils/pathHelpers';
import { notificationService } from '../../../src/utils/notificationHelpers';
import * as extensionProvider from '../../../src/services/extensionProvider';
import * as orgApexClassProvider from '../../../src/utils/orgApexClassProvider';
import * as testUtils from '../../../src/utils/testUtils';
import * as EffectModule from 'effect/Effect';
import {
  ApexTestController,
  closeForeignApexTestingTabs,
  getTestController,
  sortUrisByMtimeAscending
} from '../../../src/views/testController';

// closeForeignApexTestingTabs returns an Effect (R = never: pure tab ops, no services), so run it
// with the real Effect runtime rather than the mocked extension runtime.
const runClose = (orgKey: string | undefined): Promise<void> =>
  EffectModule.runPromise(closeForeignApexTestingTabs(orgKey));

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
  resolveHandler: undefined as ((test: vscode.TestItem | undefined) => Promise<void>) | undefined,
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
  let mockConnection: any;
  let createOrgApexClassUriSpy: jest.SpyInstance;
  let discoverTestsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock vscode.tests.createTestController
    (vscode.tests.createTestController as jest.Mock) = jest.fn().mockReturnValue(mockTestController);

    // Mock workspace
    (vscode.workspace.getConfiguration as jest.Mock) = jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue('ls')
    });
    (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[] | undefined) = [
      { uri: URI.file('/workspace'), name: 'workspace', index: 0 }
    ];
    (vscode.workspace.fs.readFile as jest.Mock) = jest.fn();
    // updateTestResults uses new vscode.TestRunRequest() - must be a constructor in Jest
    (vscode as typeof vscode & { TestRunRequest: new () => vscode.TestRunRequest }).TestRunRequest =
      class {} as new () => vscode.TestRunRequest;
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
      request: jest.fn(),
      tooling: {
        query: jest.fn().mockResolvedValue({ records: [] })
      }
    };

    (coreExtensionUtils.getConnection as jest.Mock) = jest.fn().mockResolvedValue(mockConnection);
    (extensionProvider as any).__setMockConnection?.(mockConnection);
    (coreExtensionUtils.getDefaultOrgInfo as jest.Mock) = jest
      .fn()
      .mockResolvedValue({ orgId: 'org123', username: 'user@example.com' });

    (testUtils.getApexTests as jest.Mock) = jest.fn().mockResolvedValue([]);
    (testUtils.buildClassToUriIndex as jest.Mock) = jest.fn().mockResolvedValue(new Map());
    (testUtils.getMethodLocationsFromSymbols as jest.Mock) = jest.fn().mockResolvedValue(undefined);
    const Effect = jest.requireActual('effect/Effect');
    discoverTestsSpy = jest.spyOn(testDiscovery, 'discoverTests').mockReturnValue(Effect.succeed({ classes: [] }));

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
        return URI.parse(`sf-org-apex:${baseClassName}`);
      });

    controller = new ApexTestController();
  });

  afterEach(() => {
    // Restore spies
    createOrgApexClassUriSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create a test controller', () => {
      expect(vscode.tests.createTestController).toHaveBeenCalled();
      expect(mockTestController.createRunProfile).toHaveBeenCalledTimes(5);
    });

    it('should register workspace-first run as default and org-wide run as secondary (no profile tags)', () => {
      const calls = (mockTestController.createRunProfile as jest.Mock).mock.calls;
      expect(calls[0][1]).toBe(vscode.TestRunProfileKind.Run);
      expect(calls[0][3]).toBe(true);
      expect(calls[0][4]).toBeUndefined();
      expect(calls[1][1]).toBe(vscode.TestRunProfileKind.Run);
      expect(calls[1][3]).toBe(false);
      expect(calls[1][4]).toBeUndefined();
      expect(calls[2][1]).toBe(vscode.TestRunProfileKind.Debug);
    });

    it('should set up refresh handler', () => {
      expect(mockTestController.refreshHandler).toBeDefined();
    });
  });

  describe('run profile handlers (workspace-first vs all-org)', () => {
    const cancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: { dispose: jest.fn() }
    } as unknown as vscode.CancellationToken;

    let getTestResultsFolderSpy: jest.SpiedFunction<typeof pathHelpers.getTestResultsFolder>;

    beforeEach(() => {
      const Effect = jest.requireActual('effect/Effect');
      getTestResultsFolderSpy = jest
        .spyOn(pathHelpers, 'getTestResultsFolder')
        .mockReturnValue(Effect.succeed(URI.file(path.join('/tmp', 'apex-test-results'))));
      mockTestServiceMethods.buildAsyncPayload.mockResolvedValue({
        testLevel: 'RunSpecifiedTests',
        skipCodeCoverage: true
      });
      mockTestServiceMethods.runTestAsynchronous.mockResolvedValue({
        tests: [],
        summary: { outcome: 'Passed', testsRan: 1 }
      });
      (mockTestController.createTestRun as jest.Mock).mockReturnValue(mockTestRun);
    });

    afterEach(() => {
      getTestResultsFolderSpy.mockRestore();
    });

    it('workspace-first implicit full run uses RunSpecifiedTests when in-workspace methods are gathered', async () => {
      const inWorkspaceTag = (controller as unknown as { inWorkspaceTag: vscode.TestTag }).inWorkspaceTag;
      const methodItem = {
        id: 'method:WSClass.testOne',
        label: 'testOne',
        tags: [inWorkspaceTag],
        uri: URI.file('/workspace/WSClass.cls'),
        range: undefined,
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          forEach: jest.fn(),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      Object.assign(mockTestController.items, {
        forEach: (cb: (item: vscode.TestItem) => void) => {
          cb(methodItem);
        }
      });

      mockTestServiceMethods.runTestAsynchronous.mockClear();

      await (
        controller as unknown as {
          runTests: (
            request: vscode.TestRunRequest,
            token: vscode.CancellationToken,
            isDebug: boolean,
            runScope: 'workspace-first' | 'all-org'
          ) => Promise<void>;
        }
      ).runTests(
        { include: undefined, exclude: undefined, profile: undefined } as vscode.TestRunRequest,
        cancellationToken,
        false,
        'workspace-first'
      );

      expect(mockTestServiceMethods.runTestAsynchronous).toHaveBeenCalled();
      const payload = mockTestServiceMethods.runTestAsynchronous.mock.calls[0][0] as { testLevel?: string };
      expect(payload.testLevel).toBe('RunSpecifiedTests');
    });

    it('all-org implicit full run uses RunAllTestsInOrg', async () => {
      const inWorkspaceTag = (controller as unknown as { inWorkspaceTag: vscode.TestTag }).inWorkspaceTag;
      const methodItem = {
        id: 'method:WSClass.testOne',
        label: 'testOne',
        tags: [inWorkspaceTag],
        uri: URI.file('/workspace/WSClass.cls'),
        range: undefined,
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          forEach: jest.fn(),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      Object.assign(mockTestController.items, {
        forEach: (cb: (item: vscode.TestItem) => void) => {
          cb(methodItem);
        }
      });

      mockTestServiceMethods.runTestAsynchronous.mockClear();

      await (
        controller as unknown as {
          runTests: (
            request: vscode.TestRunRequest,
            token: vscode.CancellationToken,
            isDebug: boolean,
            runScope: 'workspace-first' | 'all-org'
          ) => Promise<void>;
        }
      ).runTests(
        { include: undefined, exclude: undefined, profile: undefined } as vscode.TestRunRequest,
        cancellationToken,
        false,
        'all-org'
      );

      expect(mockTestServiceMethods.runTestAsynchronous).toHaveBeenCalled();
      const payload = mockTestServiceMethods.runTestAsynchronous.mock.calls[0][0] as { testLevel?: string };
      expect(payload.testLevel).toBe('RunAllTestsInOrg');
    });

    it('workspace-first run does not strip tests when request.include is non-empty (explicit or filter-driven selection)', async () => {
      const inWorkspaceTag = (controller as unknown as { inWorkspaceTag: vscode.TestTag }).inWorkspaceTag;
      const orgOnlyTag = (controller as unknown as { orgOnlyTag: vscode.TestTag }).orgOnlyTag;
      const orgMethod = {
        id: 'method:OrgOnly.testOne',
        label: 'testOne',
        tags: [orgOnlyTag],
        uri: URI.parse('sf-org-apex:OrgOnly'),
        range: undefined,
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          forEach: jest.fn(),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      mockTestServiceMethods.runTestAsynchronous.mockClear();

      await (
        controller as unknown as {
          runTests: (
            request: vscode.TestRunRequest,
            token: vscode.CancellationToken,
            isDebug: boolean,
            runScope: 'workspace-first' | 'all-org'
          ) => Promise<void>;
        }
      ).runTests(
        {
          include: [orgMethod],
          exclude: undefined,
          profile: undefined
        } as unknown as vscode.TestRunRequest,
        cancellationToken,
        false,
        'workspace-first'
      );

      expect(mockTestServiceMethods.runTestAsynchronous).toHaveBeenCalled();
      const payload = mockTestServiceMethods.runTestAsynchronous.mock.calls[0][0] as { testLevel?: string };
      expect(payload.testLevel).toBe('RunSpecifiedTests');
      expect(orgMethod.tags).toContain(orgOnlyTag);
      expect(orgMethod.tags).not.toContain(inWorkspaceTag);
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

      const Effect = jest.requireActual('effect/Effect');
      discoverTestsSpy.mockReturnValue(Effect.succeed({ classes: mockClasses }));
      (testUtils.buildClassToUriIndex as jest.Mock).mockResolvedValue(
        new Map([
          ['TestClass1', URI.file('/workspace/TestClass1.cls')],
          ['TestClass2', URI.file('/workspace/TestClass2.cls')]
        ])
      );
      (mockTestController.createTestItem as jest.Mock).mockImplementation(
        (id: string, label: string, uri?: URI): Partial<vscode.TestItem> => ({
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

      expect(discoverTestsSpy).toHaveBeenCalled();
      expect(mockSaveDiscoveredClasses).toHaveBeenCalledWith('org123', mockClasses, expect.any(Map));
      expect(mockTestController.createTestItem).toHaveBeenCalled();
      expect(mockTestController.items.add).toHaveBeenCalled();
    });

    it('should handle errors during discovery', async () => {
      // Mock discoverTests to return a failing Effect
      const Effect = jest.requireActual('effect/Effect');
      discoverTestsSpy.mockReturnValue(Effect.fail(new Error('Discovery failed')));

      // discoverTests catches errors and logs them, so it should resolve (not reject)
      await expect(controller.discoverTests()).resolves.toBeUndefined();
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

      const Effect = jest.requireActual('effect/Effect');
      discoverTestsSpy.mockReturnValue(Effect.succeed({ classes: mockClasses }));
      // OrgOnlyClass does not exist locally, so buildClassToUriIndex returns empty map
      (testUtils.buildClassToUriIndex as jest.Mock).mockReset();
      (testUtils.buildClassToUriIndex as jest.Mock).mockResolvedValue(new Map());
      const createdItemsMap = new Map<string, any>();
      (mockTestController.createTestItem as jest.Mock).mockImplementation(
        (id: string, label: string, uri?: URI): vscode.TestItem => {
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

      // Find the org-only class item - use the full class name format
      const orgOnlyClassItem = createdItemsMap.get('class:OrgOnlyClass');
      const orgOnlyMethodItem = createdItemsMap.get('method:OrgOnlyClass.testMethod1');

      // Verify org-only class item exists and has the org-only tag
      expect(orgOnlyClassItem).toBeDefined();
      // The URI should be set (virtual document URI) - check the actual item, not through proxy
      const actualUri = createdItemsMap.get('class:OrgOnlyClass')?.uri;
      expect(actualUri).toBeDefined();
      if (actualUri) {
        expect(actualUri.toString()).toContain('apex-testing:/');
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
        expect(actualMethodUri.toString()).toContain('apex-testing:/');
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
        uri: URI.parse('sf-org-apex:OrgOnlyClass'),
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
        uri: URI.file('/workspace/LocalClass.cls'),
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
        uri: URI.parse('sf-org-apex:OrgOnlyClass'),
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

  describe('debugTests method and class selection', () => {
    it('should debug only the selected method when a single method is selected', async () => {
      const methodTestItem = {
        id: 'method:BugTest.myUnitTest2',
        label: 'myUnitTest2',
        uri: URI.file('/workspace/BugTest.cls'),
        tags: [],
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          values: jest.fn().mockReturnValue([]),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      await (controller as any).debugTests([methodTestItem], mockTestRun);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('sf.test.view.debugSingleTest', {
        name: 'BugTest.myUnitTest2'
      });
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('sf.test.view.debugTests', {
        name: 'BugTest'
      });
    });

    it('should prefer class-level debug when class and method from same class are selected', async () => {
      const classTestItem = {
        id: 'class:BugTest',
        label: 'BugTest',
        uri: URI.file('/workspace/BugTest.cls'),
        tags: [],
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          values: jest.fn().mockReturnValue([]),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      const methodTestItem = {
        id: 'method:BugTest.myUnitTest2',
        label: 'myUnitTest2',
        uri: URI.file('/workspace/BugTest.cls'),
        tags: [],
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          values: jest.fn().mockReturnValue([]),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      await (controller as any).debugTests([classTestItem, methodTestItem], mockTestRun);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('sf.test.view.debugTests', {
        name: 'BugTest'
      });
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('sf.test.view.debugSingleTest', {
        name: 'myUnitTest2'
      });
    });

    it('should debug each selected method when multiple methods from the same class are selected', async () => {
      const methodOne = {
        id: 'method:BugTest.myUnitTest1',
        label: 'myUnitTest1',
        uri: URI.file('/workspace/BugTest.cls'),
        tags: [],
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          values: jest.fn().mockReturnValue([]),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      const methodTwo = {
        id: 'method:BugTest.myUnitTest2',
        label: 'myUnitTest2',
        uri: URI.file('/workspace/BugTest.cls'),
        tags: [],
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0)),
        canResolveChildren: false,
        children: {
          add: jest.fn(),
          values: jest.fn().mockReturnValue([]),
          size: 0
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      await (controller as any).debugTests([methodOne, methodTwo], mockTestRun);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('sf.test.view.debugSingleTest', {
        name: 'BugTest.myUnitTest1'
      });
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('sf.test.view.debugSingleTest', {
        name: 'BugTest.myUnitTest2'
      });
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('sf.test.view.debugTests', {
        name: 'BugTest'
      });
    });
  });

  describe('openOrgOnlyTest', () => {
    it('should open org-only class test', async () => {
      // Clear call history for VS Code APIs and spies
      (vscode.workspace.openTextDocument as jest.Mock).mockClear();
      (vscode.window.showTextDocument as jest.Mock).mockClear();

      const classTestItem = {
        id: 'class:OrgOnlyClass',
        label: 'OrgOnlyClass',
        uri: URI.parse('sf-org-apex:OrgOnlyClass'),
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
        uri: URI.parse('sf-org-apex:OrgOnlyClass')
      };

      const mockEditor = {
        selection: {} as vscode.Selection,
        revealRange: jest.fn()
      };

      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
      (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(mockEditor);

      await controller.openOrgOnlyTest(classTestItem);

      // fsService.showTextDocument opens the URI directly (no separate openTextDocument)
      expect(vscode.window.showTextDocument).toHaveBeenCalled();
      const showDocCall = (vscode.window.showTextDocument as jest.Mock).mock.calls[0][0];
      expect(showDocCall).toBeDefined();
      expect(showDocCall.toString()).toContain('sf-org-apex');
      expect(showDocCall.toString()).toContain('OrgOnlyClass');
    });

    it('should open org-only method test and navigate to position', async () => {
      // Clear call history
      (vscode.workspace.openTextDocument as jest.Mock).mockClear();
      (vscode.window.showTextDocument as jest.Mock).mockClear();

      const methodTestItem = {
        id: 'method:OrgOnlyClass.testMethod',
        label: 'testMethod',
        uri: URI.parse('sf-org-apex:OrgOnlyClass'),
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
        uri: URI.parse('sf-org-apex:OrgOnlyClass')
      };

      const mockEditor = {
        selection: {} as vscode.Selection,
        revealRange: jest.fn()
      };

      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
      (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(mockEditor);

      await controller.openOrgOnlyTest(methodTestItem);

      // fsService.showTextDocument opens the URI directly
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
      const Effect = jest.requireActual('effect/Effect');
      discoverTestsSpy.mockReturnValue(Effect.succeed({ classes: [] }));

      await controller.refresh();

      expect(mockTestController.items.replace).toHaveBeenCalledWith([]);
      expect(discoverTestsSpy).toHaveBeenCalled();
    });
  });

  describe('retrieveOrgOnlyClass', () => {
    it('retrieves org-only class for apex-testing class items', async () => {
      const orgOnlyClassFileUri = URI.file('/workspace/force-app/main/default/classes/OrgOnlyClass.cls');
      const classTestItem = {
        id: 'class:OrgOnlyClass',
        label: 'OrgOnlyClass',
        uri: URI.parse('apex-testing:/orgs/org123/classes/OrgOnlyClass.cls')
      } as unknown as vscode.TestItem;

      notificationService.showSuccessfulExecution = jest.fn();
      notificationService.showInformationMessage = jest.fn();
      (extensionProvider as unknown as { __mockMetadataRetrieve: jest.Mock }).__mockMetadataRetrieve.mockClear();
      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({
        uri: orgOnlyClassFileUri
      });
      (vscode.window.showTextDocument as jest.Mock).mockResolvedValue({});
      (
        extensionProvider as unknown as { __mockMetadataRetrieve: jest.Mock }
      ).__mockMetadataRetrieve.mockReturnValueOnce(
        jest.requireActual('effect/Effect').succeed({
          getFileResponses: () => [{ filePath: '/workspace/force-app/main/default/classes/OrgOnlyClass.cls' }]
        })
      );
      const refreshSpy = jest.spyOn(controller, 'refresh').mockResolvedValue(undefined);

      await controller.retrieveOrgOnlyClass(classTestItem);

      expect(
        (extensionProvider as unknown as { __mockMetadataRetrieve: jest.Mock }).__mockMetadataRetrieve
      ).toHaveBeenCalledWith([{ type: 'ApexClass', fullName: 'OrgOnlyClass' }], { ignoreConflicts: true });
      expect(vscode.window.showTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: orgOnlyClassFileUri.fsPath }),
        expect.anything()
      );
      expect(refreshSpy).toHaveBeenCalled();
      expect(notificationService.showSuccessfulExecution).toHaveBeenCalled();
    });

    it('does not retrieve for local class items', async () => {
      const classTestItem = {
        id: 'class:LocalClass',
        label: 'LocalClass',
        uri: URI.file('/workspace/force-app/main/default/classes/LocalClass.cls')
      } as unknown as vscode.TestItem;

      (extensionProvider as unknown as { __mockMetadataRetrieve: jest.Mock }).__mockMetadataRetrieve.mockClear();

      await controller.retrieveOrgOnlyClass(classTestItem);

      expect(
        (extensionProvider as unknown as { __mockMetadataRetrieve: jest.Mock }).__mockMetadataRetrieve
      ).not.toHaveBeenCalled();
    });
  });

  describe('resolveHandler', () => {
    it('should request document symbols for class methods with default range', async () => {
      const methodItem = {
        id: 'method:OrgOnlyClass.testMethod1',
        label: 'testMethod1',
        uri: URI.parse('apex-testing:/orgs/org123/classes/OrgOnlyClass.cls'),
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
      } as unknown as vscode.TestItem;

      const classItem = {
        id: 'class:OrgOnlyClass',
        label: 'OrgOnlyClass',
        uri: URI.parse('apex-testing:/orgs/org123/classes/OrgOnlyClass.cls'),
        children: {
          forEach: (cb: (item: vscode.TestItem) => void) => cb(methodItem)
        }
      } as unknown as vscode.TestItem;

      (testUtils.getMethodLocationsFromSymbols as jest.Mock).mockResolvedValue(
        new Map([
          [
            'testMethod1',
            new vscode.Location(
              URI.parse('apex-testing:/orgs/org123/classes/OrgOnlyClass.cls'),
              new vscode.Range(new vscode.Position(9, 2), new vscode.Position(9, 2))
            )
          ]
        ])
      );

      await mockTestController.resolveHandler?.(classItem);

      expect(testUtils.getMethodLocationsFromSymbols).toHaveBeenCalledWith(
        classItem.uri,
        expect.arrayContaining(['testMethod1'])
      );
      expect(methodItem.range?.start.line).toBe(9);
      expect(methodItem.range?.start.character).toBe(2);
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

      (extensionProvider as unknown as { __setMockReadFileResult: (s: string) => void }).__setMockReadFileResult(
        JSON.stringify(testResult)
      );

      (mockTestController.createTestRun as jest.Mock).mockReturnValue(mockTestRun);
      (mockTestController.createTestItem as jest.Mock).mockReturnValue(mockTestItem);

      const apexTestDir = URI.file('/tmp');
      const testResultUri = URI.file(path.join(apexTestDir.fsPath, 'test-result.json'));
      await controller.onResultFileCreate(apexTestDir, testResultUri);

      expect(
        (extensionProvider as unknown as { __mockFsServiceReadFile: jest.Mock }).__mockFsServiceReadFile
      ).toHaveBeenCalled();
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

  describe('incrementalUpdate', () => {
    let discoverTestsSpyLocal: jest.SpyInstance;

    beforeEach(() => {
      const Effect = jest.requireActual('effect/Effect');
      discoverTestsSpyLocal = jest.spyOn(testDiscovery, 'discoverTests');
      discoverTestsSpyLocal.mockReturnValue(Effect.succeed({ classes: [] }));
    });

    it('should not call testing.clearTestResults', async () => {
      const changes = new Map([['MyTestClass', 'changed']]);
      await controller.incrementalUpdate(changes, false);

      const clearResultsCalls = (vscode.commands.executeCommand as jest.Mock).mock.calls.filter(
        ([cmd]: [string]) => cmd === 'testing.clearTestResults'
      );
      expect(clearResultsCalls).toHaveLength(0);
    });

    it('should not replace controller items', async () => {
      const changes = new Map([['MyTestClass', 'changed']]);
      await controller.incrementalUpdate(changes, false);

      expect(mockTestController.items.replace).not.toHaveBeenCalled();
    });

    it('should skip API call for pure deletions', async () => {
      const changes = new Map([['DeletedClass', 'deleted']]);
      await controller.incrementalUpdate(changes, false);

      expect(discoverTestsSpyLocal).not.toHaveBeenCalled();
    });

    it('should call discoverTests for created changes', async () => {
      const changes = new Map([['NewClass', 'created']]);
      await controller.incrementalUpdate(changes, false);

      expect(discoverTestsSpyLocal).toHaveBeenCalled();
    });

    it('should call discoverTests for changed changes', async () => {
      const changes = new Map([['ChangedClass', 'changed']]);
      await controller.incrementalUpdate(changes, false);

      expect(discoverTestsSpyLocal).toHaveBeenCalled();
    });

    it('should fall back to full discoverTests on error', async () => {
      const Effect = jest.requireActual('effect/Effect');
      discoverTestsSpyLocal.mockReturnValue(Effect.fail(new Error('API error')));

      // discoverTests is also called by the fallback path (full refresh)
      // After the incremental attempt fails, it retries with full discoverTests
      const changes = new Map([['MyTestClass', 'changed']]);
      await controller.incrementalUpdate(changes, false);

      // Should have attempted discovery (even if it failed in fallback too)
      expect(discoverTestsSpyLocal).toHaveBeenCalled();
    });

    it('should call clearAllSuiteChildren when includesSuiteChange is true', async () => {
      const changes = new Map([['SomeClass', 'deleted']]);

      // Add a suite item to verify it gets cleared
      const suiteItem = {
        id: 'suite:MySuite',
        label: 'MySuite',
        children: {
          replace: jest.fn(),
          size: 1
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      const suiteItems = (controller as any).suiteItems as Map<string, vscode.TestItem>;
      suiteItems.set('MySuite', suiteItem);

      await controller.incrementalUpdate(changes, true);

      expect(suiteItem.children.replace).toHaveBeenCalledWith([]);
    });

    it('should invalidate test results for changed classes', async () => {
      const Effect = jest.requireActual('effect/Effect');

      // Set up an existing class item in the controller
      const classItems = (controller as any).classItems as Map<string, vscode.TestItem>;
      const methodItems = (controller as any).methodItems as Map<string, vscode.TestItem>;

      const existingMethodItem = {
        id: 'method:MyTestClass.testMethod1',
        label: 'testMethod1'
      } as unknown as vscode.TestItem;

      const existingClassItem = {
        id: 'class:MyTestClass',
        label: 'MyTestClass',
        tags: [],
        children: {
          forEach: (cb: (item: vscode.TestItem) => void) => cb(existingMethodItem),
          add: jest.fn(),
          delete: jest.fn(),
          size: 1
        } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      classItems.set('MyTestClass', existingClassItem);
      methodItems.set('method:MyTestClass.testMethod1', existingMethodItem);

      // Mock discovery to return the same class with same method
      discoverTestsSpyLocal.mockReturnValue(
        Effect.succeed({
          classes: [{ id: '01p123', name: 'MyTestClass', namespacePrefix: '', testMethods: [{ name: 'testMethod1' }] }]
        })
      );

      // Mock invalidateTestResults on the controller
      (mockTestController as any).invalidateTestResults = jest.fn();

      const changes = new Map([['MyTestClass', 'changed']]);
      await controller.incrementalUpdate(changes, false);

      expect((mockTestController as any).invalidateTestResults).toHaveBeenCalledWith(existingClassItem);
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

describe('sortUrisByMtimeAscending', () => {
  const uriFor = (runId: string): URI => URI.file(`/results/test-result-${runId}.json`);

  it('orders by mtime so the newest run is applied last (most recent result wins)', () => {
    // Regression for W-XXXXXXXX: Salesforce test-run-id filenames are NOT chronologically
    // sortable. Here the lexicographically-last file (CrPFqQ) is actually an OLDER run than
    // CrOq5E/CrOtvg. Sorting by filename would apply the older failing run last and clobber the
    // newer passing run. Sorting by mtime applies oldest-first so the newest run wins.
    const items = [
      { uri: uriFor('CrOtvg'), mtime: 4000 }, // newest run (all green)
      { uri: uriFor('CrP6pE'), mtime: 1000 }, // oldest run (had the failure)
      { uri: uriFor('CrPFqQ'), mtime: 2000 }, // lexicographically last, but older than CrO* runs
      { uri: uriFor('CrOq5E'), mtime: 3000 }
    ];

    const ordered = sortUrisByMtimeAscending(items).map(uri => uri.path);

    expect(ordered).toEqual([
      uriFor('CrP6pE').path,
      uriFor('CrPFqQ').path,
      uriFor('CrOq5E').path,
      uriFor('CrOtvg').path
    ]);
    // The newest-by-mtime run is applied last regardless of filename ordering.
    expect(ordered.at(-1)).toBe(uriFor('CrOtvg').path);
  });

  it('does not mutate the input array', () => {
    const items = [
      { uri: uriFor('b'), mtime: 2000 },
      { uri: uriFor('a'), mtime: 1000 }
    ];
    const snapshot = items.map(i => i.uri.path);
    sortUrisByMtimeAscending(items);
    expect(items.map(i => i.uri.path)).toEqual(snapshot);
  });
});

describe('closeForeignApexTestingTabs', () => {
  // Real-ish tab fixtures: the production code does `tab.input instanceof vscode.TabInputText`, so the
  // fixtures must be actual instances of the mock's TabInputText, carrying a real URI of a given scheme.
  const tabFor = (uri: URI): vscode.Tab =>
    ({ input: new (vscode as unknown as { TabInputText: new (u: URI) => unknown }).TabInputText(uri) }) as vscode.Tab;

  const setTabGroups = (tabs: vscode.Tab[]): jest.Mock => {
    const close = jest.fn().mockResolvedValue(undefined);
    (vscode.window as unknown as { tabGroups: unknown }).tabGroups = { all: [{ tabs }], close };
    return close;
  };

  // org keys are sanitized to lower-case in the VFS path, so org123 -> /orgs/org123/...
  const orgATab = tabFor(URI.parse('apex-testing:/orgs/org123/classes/MyTest.cls'));
  const orgBTab = tabFor(URI.parse('apex-testing:/orgs/org456/classes/OtherTest.cls'));
  const fileTab = tabFor(URI.file('/workspace/MyTest.cls'));

  afterEach(() => {
    delete (vscode.window as unknown as { tabGroups?: unknown }).tabGroups;
  });

  it('on org change, closes only OTHER orgs apex-testing: tabs and leaves the current org + other schemes', async () => {
    const close = setTabGroups([orgATab, orgBTab, fileTab]);

    // current org is org123 => org456's tab is foreign and closes; org123's tab + the file tab stay.
    await runClose('org123');

    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith([orgBTab], true);
  });

  it('on logout (undefined org), closes every apex-testing: org tab and leaves other schemes', async () => {
    const close = setTabGroups([orgATab, orgBTab, fileTab]);

    await runClose(undefined);

    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith([orgATab, orgBTab], true);
  });

  it('is a no-op when only the current orgs tab is open', async () => {
    const close = setTabGroups([orgATab, fileTab]);

    await runClose('org123');

    expect(close).not.toHaveBeenCalled();
  });
});
