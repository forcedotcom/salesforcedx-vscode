/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('../../../src/services/extensionProvider', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  const SubscriptionRef = jest.requireActual('effect/SubscriptionRef');
  const Layer = jest.requireActual('effect/Layer');
  const ManagedRuntime = jest.requireActual('effect/ManagedRuntime');
  const { ExtensionProviderService } = jest.requireActual('@salesforce/effect-ext-utils');
  const { ApexTestRunCacheService } = jest.requireActual('../../../src/testRunCache/apexTestRunCacheService');
  const { URI: UriClass } = jest.requireActual('vscode-uri');
  const { HashableUri } = jest.requireActual('salesforcedx-vscode-services/src/vscode/hashableUri');

  let mockConnectionRef: any;
  let mockReadFileResult = '';
  let mockWorkspaceUris = new Map<string, InstanceType<typeof UriClass>>();
  const mockReadFile = jest.fn(() => EffectLib.succeed(mockReadFileResult));
  const mockMetadataRetrieve = jest.fn((_members: unknown, _options: unknown) =>
    EffectLib.succeed({ getFileResponses: () => [] })
  );
  const mockCatalogInvalidate = jest.fn(() => EffectLib.void);
  const mockOrgMetadataCatalog = {
    resolveKnownOrgComponents: (references: readonly { xmlName: string; fullName: string }[]) =>
      EffectLib.succeed(
        references.map(reference => {
          const workspaceUri = mockWorkspaceUris.get(reference.fullName);
          return {
            reference,
            documentUri:
              workspaceUri ?? UriClass.parse(`sf-org-metadata:/orgs/org123/ApexClass/${reference.fullName}.cls`),
            inWorkspace: workspaceUri !== undefined,
            ...(workspaceUri ? { workspaceUri } : {})
          };
        })
      ),
    getPresence: () => EffectLib.succeed({ inOrg: true, inWorkspace: false }),
    getDocumentUri: (reference: { fullName: string }) =>
      EffectLib.succeed(UriClass.parse(`sf-org-metadata:/orgs/org123/ApexClass/${reference.fullName}.cls`)),
    getDocumentReference: (uri: { path: string; scheme: string }) => {
      const className = uri.path
        .split('/')
        .at(-1)
        ?.replace(/\.cls$/, '');
      return EffectLib.succeed(
        uri.scheme === 'sf-org-metadata' && className ? { xmlName: 'ApexClass', fullName: className } : undefined
      );
    },
    download: (reference: { fullName: string }) =>
      mockMetadataRetrieve([{ type: 'ApexClass', fullName: reference.fullName }], {
        ignoreConflicts: true
      }).pipe(
        EffectLib.map((result: { getFileResponses: () => Array<{ filePath?: string }> }) => {
          const filePath = result.getFileResponses().find(response => response.filePath)?.filePath;
          return UriClass.file(filePath ?? `/workspace/${reference.fullName}.cls`);
        })
      ),
    invalidate: mockCatalogInvalidate
  };
  const MockConnectionService = {
    getConnection: () => EffectLib.succeed(mockConnectionRef),
    invalidateCachedConnections: () => EffectLib.void
  };
  const mockFsService = {
    readFile: mockReadFile,
    createDirectory: () => EffectLib.void,
    safeDelete: () => EffectLib.void,
    safeWriteFile: () => EffectLib.void,
    writeFile: () => EffectLib.void,
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
  const mockAppendToChannel = jest.fn(() => EffectLib.void);
  const mockChannelService = { appendToChannel: mockAppendToChannel };
  const mockServicesApi = {
    services: {
      ConnectionService: MockConnectionService,
      FsService: mockFsService,
      // Yielded as an instance in the execution service (yield* api.services.ChannelService), so wrap in
      // Effect.succeed — same seam as testReportGenerator.test.ts.
      ChannelService: EffectLib.succeed(mockChannelService),
      WorkspaceService: MockWorkspaceService,
      MetadataRetrieveService: {
        retrieve: mockMetadataRetrieve
      },
      OrgMetadataCatalog: EffectLib.succeed(mockOrgMetadataCatalog),
      // restore-previous-results defaults false so discovery's restore step short-circuits in tests not
      // exercising it; other keys fall through to their provided default. Yielded as an instance
      // (yield* api.services.SettingsService), so wrap in Effect.succeed.
      SettingsService: EffectLib.succeed({
        getValue: (_section: string, key: string, defaultValue: unknown) =>
          EffectLib.succeed(key === 'restore-previous-results' ? false : defaultValue)
      }),
      // Backs the inline getDefaultOrgInfo helper in the real ApexTestTreeService (jest.requireActual above):
      // persistDiscoveredClasses/addClassToTree/applyIncrementalDiff yield* api.services.TargetOrgRef() then
      // SubscriptionRef.get for the org key. Fresh ref per call. Mirrors watchers/testDiscovery.test.ts.
      TargetOrgRef: () => SubscriptionRef.make({ orgId: 'org123', username: 'user@example.com' })
    }
  };
  const ExtensionProviderLayer = Layer.effect(
    ExtensionProviderService,
    EffectLib.sync(() => ({ getServicesApi: EffectLib.succeed(mockServicesApi) }))
  );
  // ApexTestTreeService owns the tree Refs; the shell reads them via this runtime, so the mock runtime
  // must provide its Default layer. Built lazily (not at module-eval) to avoid the import cycle
  // apexTestTreeService -> testUtils -> extensionProvider (this mock).
  let mockRuntime: any;
  let MockAllServicesLayer: any;
  let treeService: any;
  const ensureRuntime = () => {
    if (!mockRuntime) {
      treeService = jest.requireActual('../../../src/views/apexTestTreeService').ApexTestTreeService;
      const executionService = jest.requireActual(
        '../../../src/views/apexTestExecutionService'
      ).ApexTestExecutionService;
      MockAllServicesLayer = Layer.mergeAll(
        ExtensionProviderLayer,
        treeService.Default,
        executionService.Default,
        ApexTestRunCacheService.Default
      );
      // One persistent runtime so the tree-state Refs survive across the shell's runSync/runPromise
      // calls within a test (matching the production single-runtime behavior).
      mockRuntime = ManagedRuntime.make(MockAllServicesLayer);
    }
    return mockRuntime;
  };

  return {
    getApexTestingRuntime: () => ensureRuntime(),
    get AllServicesLayer() {
      ensureRuntime();
      return MockAllServicesLayer;
    },
    setAllServicesLayer: jest.fn(),
    __setMockConnection: (conn: any) => {
      mockConnectionRef = conn;
    },
    __setMockReadFileResult: (s: string) => {
      mockReadFileResult = s;
    },
    __setMockWorkspaceUris: (uris: Map<string, InstanceType<typeof UriClass>>) => {
      mockWorkspaceUris = uris;
    },
    __mockFsServiceReadFile: mockReadFile,
    __mockAppendToChannel: mockAppendToChannel,
    __mockMetadataRetrieve: mockMetadataRetrieve,
    __mockCatalogInvalidate: mockCatalogInvalidate,
    // Clear the shared tree Refs between tests so the singleton runtime's maps don't leak state.
    __resetTree: () => {
      ensureRuntime();
      mockRuntime.runSync(treeService.reset());
      mockRuntime.runSync(treeService.clearRestoredResults());
    }
  };
});

jest.mock('../../../src/utils/testUtils', () => {
  const actual = jest.requireActual('../../../src/utils/testUtils');
  return {
    ...actual,
    getMethodLocationsFromSymbols: jest.fn().mockResolvedValue(new Map()),
    readTestRunIdFile: jest.fn().mockResolvedValue(undefined)
  };
});

jest.mock('../../../src/testDiscovery/packageResolution', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  // resolve is a static accessor (PackageResolutionService.resolve(...)) returning an Effect<Map>.
  return { PackageResolutionService: { resolve: () => EffectLib.succeed(new Map()) } };
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
import * as testDiscovery from '../../../src/testDiscovery/testDiscovery';
import * as pathHelpers from '../../../src/utils/pathHelpers';
import { notificationService } from '../../../src/utils/notificationHelpers';
import * as extensionProvider from '../../../src/services/extensionProvider';
import * as testUtils from '../../../src/utils/testUtils';
import * as Option from 'effect/Option';
import { ApexTestController, getTestController } from '../../../src/views/testController';

// The tree maps live in ApexTestTreeService Refs; read the live Map through the mock runtime (same path
// the production module accessors use) to seed test state.
const treeMap = (key: 'getSuiteItems' | 'getClassItems' | 'getMethodItems'): Map<string, vscode.TestItem> => {
  const ApexTestTreeService = jest.requireActual('../../../src/views/apexTestTreeService').ApexTestTreeService;
  return extensionProvider.getApexTestingRuntime().runSync(ApexTestTreeService[key]());
};

// Mock vscode.tests API
const mockTestController = {
  items: {
    add: jest.fn(),
    delete: jest.fn(),
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
  let discoverTestsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the singleton runtime's tree Refs so per-test map state does not leak.
    (extensionProvider as unknown as { __resetTree: () => void }).__resetTree();

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

    (extensionProvider as any).__setMockConnection?.(mockConnection);

    (testUtils.getMethodLocationsFromSymbols as jest.Mock) = jest.fn().mockResolvedValue(new Map());
    const Effect = jest.requireActual('effect/Effect');
    discoverTestsSpy = jest.spyOn(testDiscovery, 'discoverTests').mockReturnValue(Effect.succeed({ classes: [] }));

    // Reset TestService mock
    (TestService as jest.Mock).mockImplementation(() => mockTestServiceMethods);
    // Reset all mock methods
    jest.clearAllMocks();
    mockTestServiceMethods.retrieveAllSuites.mockResolvedValue([]);
    mockTestServiceMethods.getTestsInSuite.mockResolvedValue([]);
    (
      extensionProvider as unknown as { __setMockWorkspaceUris: (uris: Map<string, URI>) => void }
    ).__setMockWorkspaceUris(new Map());

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

    controller = new ApexTestController();
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
        uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnly.cls'),
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
          id: Option.some('01p000000000001AAA'),
          name: 'TestClass1',
          namespacePrefix: Option.none(),
          testMethods: [
            { name: 'testMethod1', line: 1, column: 0 },
            { name: 'testMethod2', line: 2, column: 0 }
          ]
        },
        {
          id: Option.some('01p000000000002AAA'),
          name: 'TestClass2',
          namespacePrefix: Option.none(),
          testMethods: [{ name: 'testMethod3', line: 1, column: 0 }]
        }
      ];

      const Effect = jest.requireActual('effect/Effect');
      discoverTestsSpy.mockReturnValue(Effect.succeed({ classes: mockClasses }));
      (
        extensionProvider as unknown as { __setMockWorkspaceUris: (uris: Map<string, URI>) => void }
      ).__setMockWorkspaceUris(
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
          id: Option.some('01p000000000001AAA'),
          name: 'OrgOnlyClass',
          namespacePrefix: Option.none(),
          testMethods: [{ name: 'testMethod1', line: 1, column: 0 }]
        }
      ];

      const Effect = jest.requireActual('effect/Effect');
      discoverTestsSpy.mockReturnValue(Effect.succeed({ classes: mockClasses }));
      // OrgOnlyClass does not exist locally, so the catalog resolver returns the remote document URI.
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
            set: (target, prop, value) => {
              target[prop] = value;
              return true;
            },
            // Ensure uri is always returned correctly
            get: (target, prop) => (prop === 'uri' ? target.uri : target[prop])
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
        expect(actualUri.toString()).toContain('sf-org-metadata:/');
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
        expect(actualMethodUri.toString()).toContain('sf-org-metadata:/');
      }
      expect(orgOnlyMethodItem?.tags).toBeDefined();
      expect(orgOnlyMethodItem?.tags?.length).toBe(1);
      expect(orgOnlyMethodItem?.tags?.[0].id).toBe('org-only');
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
        uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnlyClass.cls'),
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
        uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnlyClass.cls')
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
      expect(showDocCall.toString()).toContain('sf-org-metadata');
      expect(showDocCall.toString()).toContain('OrgOnlyClass');
    });

    it('should open org-only method test and navigate to position', async () => {
      // Clear call history
      (vscode.workspace.openTextDocument as jest.Mock).mockClear();
      (vscode.window.showTextDocument as jest.Mock).mockClear();

      const methodTestItem = {
        id: 'method:OrgOnlyClass.testMethod',
        label: 'testMethod',
        uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnlyClass.cls'),
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
        uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnlyClass.cls')
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
      expect(
        (extensionProvider as unknown as { __mockCatalogInvalidate: jest.Mock }).__mockCatalogInvalidate
      ).not.toHaveBeenCalled();
    });
  });

  describe('retrieveOrgOnlyClass', () => {
    it('retrieves org-only class for apex-testing class items', async () => {
      const orgOnlyClassFileUri = URI.file('/workspace/force-app/main/default/classes/OrgOnlyClass.cls');
      const classTestItem = {
        id: 'class:OrgOnlyClass',
        label: 'OrgOnlyClass',
        uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnlyClass.cls')
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
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(notificationService.showSuccessfulExecution).toHaveBeenCalled();
    });

    it('shows the canceled notification when retrieve is cancelled (UserCancellationError)', async () => {
      const classTestItem = {
        id: 'class:OrgOnlyClass',
        label: 'OrgOnlyClass',
        uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnlyClass.cls')
      } as unknown as vscode.TestItem;

      notificationService.showInformationMessage = jest.fn();
      notificationService.showFailedExecution = jest.fn();
      notificationService.showSuccessfulExecution = jest.fn();
      (extensionProvider as unknown as { __mockMetadataRetrieve: jest.Mock }).__mockMetadataRetrieve.mockClear();
      (
        extensionProvider as unknown as { __mockMetadataRetrieve: jest.Mock }
      ).__mockMetadataRetrieve.mockReturnValueOnce(
        jest.requireActual('effect/Effect').fail({ _tag: 'UserCancellationError' })
      );

      await controller.retrieveOrgOnlyClass(classTestItem);

      expect(notificationService.showInformationMessage).toHaveBeenCalled();
      expect(notificationService.showFailedExecution).not.toHaveBeenCalled();
      expect(notificationService.showSuccessfulExecution).not.toHaveBeenCalled();
    });

    it('shows failed-execution when retrieve fails (MetadataRetrieveError)', async () => {
      const classTestItem = {
        id: 'class:OrgOnlyClass',
        label: 'OrgOnlyClass',
        uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnlyClass.cls')
      } as unknown as vscode.TestItem;

      notificationService.showFailedExecution = jest.fn();
      notificationService.showSuccessfulExecution = jest.fn();
      (extensionProvider as unknown as { __mockMetadataRetrieve: jest.Mock }).__mockMetadataRetrieve.mockClear();
      (
        extensionProvider as unknown as { __mockMetadataRetrieve: jest.Mock }
      ).__mockMetadataRetrieve.mockReturnValueOnce(
        jest.requireActual('effect/Effect').fail({ _tag: 'MetadataRetrieveError', message: 'boom' })
      );

      await controller.retrieveOrgOnlyClass(classTestItem);

      expect(notificationService.showFailedExecution).toHaveBeenCalled();
      expect(notificationService.showSuccessfulExecution).not.toHaveBeenCalled();
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
        uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnlyClass.cls'),
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 0))
      } as unknown as vscode.TestItem;

      const classItem = {
        id: 'class:OrgOnlyClass',
        label: 'OrgOnlyClass',
        uri: URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnlyClass.cls'),
        children: {
          forEach: (cb: (item: vscode.TestItem) => void) => cb(methodItem),
          // Real TestItemCollection is Iterable<[id, TestItem]> (vscode.d.ts)
          [Symbol.iterator]: () => [[methodItem.id, methodItem] as const][Symbol.iterator]()
        }
      } as unknown as vscode.TestItem;

      (testUtils.getMethodLocationsFromSymbols as jest.Mock).mockResolvedValue(
        new Map([
          [
            'testMethod1',
            new vscode.Location(
              URI.parse('sf-org-metadata:/orgs/org123/ApexClass/OrgOnlyClass.cls'),
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

    it('should refresh suite items when includesSuiteChange is true', async () => {
      const changes = new Map([['SomeClass', 'deleted']]);

      const suiteItem = {
        id: 'suite:MySuite',
        label: 'MySuite',
        children: { replace: jest.fn(), size: 1 } as unknown as vscode.TestItemCollection
      } as unknown as vscode.TestItem;

      treeMap('getSuiteItems').set('MySuite', suiteItem);

      await controller.incrementalUpdate(changes, true);

      // Suite parent deleted from controller and suiteItems Ref cleared (populateSuiteItems re-adds nothing
      // because retrieveAllSuites returns [] from the mock).
      expect(mockTestController.items.delete).toHaveBeenCalledWith('apex-test-suites-parent');
    });

    // Diff internals (add/diff/remove class, invalidateTestResults, removeEmptyAncestors) moved into
    // ApexTestTreeService; see test/jest/views/apexTestTreeService.test.ts "incrementalUpdate diff".
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

// sortUrisByMtimeAscending moved into ApexTestTreeService; the mtime-ordering behavior is covered by
// test/jest/utils/sortHelpers.test.ts (the canonical sortByMtimeAscending helper).
