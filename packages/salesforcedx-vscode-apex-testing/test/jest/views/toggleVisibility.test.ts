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
  const mockFsService = {
    readFile: jest.fn(() => EffectLib.succeed('')),
    createDirectory: () => EffectLib.void,
    safeDelete: () => EffectLib.void,
    readDirectory: () => EffectLib.succeed([]),
    HashableUri: EffectLib.succeed(HashableUri),
    showTextDocument: () => EffectLib.succeed(undefined)
  };
  const MockConnectionService = { getConnection: () => EffectLib.succeed(mockConnectionRef) };
  const MockWorkspaceService = {
    getWorkspaceInfoOrThrow: EffectLib.succeed({ uri: UriClass.file('/tmp/workspace'), fsPath: '/tmp/workspace' })
  };
  const mockServicesApi = {
    services: {
      ConnectionService: MockConnectionService,
      FsService: mockFsService,
      WorkspaceService: MockWorkspaceService,
      MetadataRetrieveService: {
        retrieve: jest.fn(() => EffectLib.succeed({ getFileResponses: () => [] }))
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
    }
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

jest.mock('../../../src/settings', () => ({
  retrieveTestCodeCoverage: jest.fn().mockReturnValue(false),
  retrieveTestRunConcise: jest.fn().mockReturnValue(false),
  retrieveRestorePreviousResults: jest.fn().mockReturnValue(false)
}));

jest.mock('../../../src/testDiscovery/packageResolution', () => ({
  resolvePackage2Members: jest.fn().mockResolvedValue(new Map())
}));

jest.mock('../../../src/discoveryVfs/apexTestDiscoveryService', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  return {
    ApexTestDiscoveryService: {
      saveDiscoveredClasses: () => EffectLib.void
    }
  };
});

const mockDiscoverTests = jest.fn();
jest.mock('../../../src/testDiscovery/testDiscovery', () => ({
  discoverTests: (...args: unknown[]) => mockDiscoverTests(...args)
}));

jest.mock('../../../src/utils/orgApexClassProvider', () => ({
  getOrgApexClassProvider: jest.fn().mockReturnValue({ clearAllCache: jest.fn() })
}));

jest.mock('@salesforce/apex-node', () => ({
  TestService: jest.fn().mockImplementation(() => ({
    retrieveAllSuites: jest.fn().mockResolvedValue([]),
    buildAsyncPayload: jest.fn().mockResolvedValue({}),
    runTestAsynchronous: jest.fn().mockResolvedValue({ tests: [], summary: { outcome: 'Passed', testsRan: 0 } }),
    writeResultFiles: jest.fn().mockResolvedValue(undefined),
    getTestsInSuite: jest.fn().mockResolvedValue([])
  })),
  TestLevel: { RunSpecifiedTests: 'RunSpecifiedTests', RunAllTestsInOrg: 'RunAllTestsInOrg' },
  ResultFormat: { json: 'json' }
}));

import { URI } from 'vscode-uri';
import * as vscode from 'vscode';
import * as coreExtensionUtils from '../../../src/coreExtensionUtils';
import * as extensionProvider from '../../../src/services/extensionProvider';
import * as testUtils from '../../../src/utils/testUtils';
import { ApexTestController } from '../../../src/views/testController';

// Helper to create a functional mock TestItemCollection backed by a Map
const createMockTestItemCollection = (): vscode.TestItemCollection => {
  const items = new Map<string, vscode.TestItem>();
  const collection = {
    get size() {
      return items.size;
    },
    add: jest.fn((item: vscode.TestItem) => {
      items.set(item.id, item);
    }),
    delete: jest.fn((id: string) => {
      items.delete(id);
    }),
    replace: jest.fn((newItems: readonly vscode.TestItem[]) => {
      items.clear();
      for (const item of newItems) {
        items.set(item.id, item);
      }
    }),
    get: jest.fn((id: string) => items.get(id)),
    forEach: jest.fn((cb: (item: vscode.TestItem) => void) => {
      for (const item of items.values()) {
        cb(item);
      }
    }),
    values: jest.fn(() => items.values()),
    [Symbol.iterator]: () => items.entries()
  } as unknown as vscode.TestItemCollection;
  return collection;
};

const createMockTestItem = (id: string, label: string, uri?: vscode.Uri): vscode.TestItem => {
  const children = createMockTestItemCollection();
  return {
    id,
    label,
    uri,
    range: undefined,
    canResolveChildren: false,
    children,
    tags: [],
    busy: false,
    parent: undefined
  } as unknown as vscode.TestItem;
};

describe('Toggle Visibility', () => {
  let controller: ApexTestController;
  let mockConnection: any;
  let executeCommandSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    const controllerItems = createMockTestItemCollection();
    const mockTestController = {
      items: controllerItems,
      createTestItem: jest.fn((id: string, label: string, uri?: vscode.Uri) => createMockTestItem(id, label, uri)),
      createTestRun: jest.fn().mockReturnValue({
        started: jest.fn(),
        passed: jest.fn(),
        failed: jest.fn(),
        errored: jest.fn(),
        end: jest.fn(),
        appendOutput: jest.fn()
      }),
      createRunProfile: jest.fn(),
      refreshHandler: undefined,
      resolveHandler: undefined,
      dispose: jest.fn(),
      invalidateTestResults: jest.fn()
    } as unknown as vscode.TestController;

    (vscode.tests.createTestController as jest.Mock) = jest.fn().mockReturnValue(mockTestController);
    (vscode.workspace.getConfiguration as jest.Mock) = jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue('ls')
    });
    (vscode.workspace.workspaceFolders as vscode.WorkspaceFolder[] | undefined) = [
      { uri: URI.file('/workspace'), name: 'workspace', index: 0 }
    ];

    executeCommandSpy = jest.fn().mockResolvedValue(undefined);
    (vscode.commands.executeCommand as jest.Mock) = executeCommandSpy;

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
    (testUtils.buildClassToUriIndex as jest.Mock) = jest.fn().mockResolvedValue(new Map());

    const Effect = jest.requireActual('effect/Effect');
    mockDiscoverTests.mockReturnValue(Effect.succeed({ classes: [] }));

    controller = new ApexTestController();
  });

  it('should set context keys to true on construction', () => {
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'sf:apex.showLocalTests', true);
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'sf:apex.showOrgTests', true);
  });

  it('toggleLocalVisibility flips showLocalTests and sets context key to false', async () => {
    await controller.toggleLocalVisibility();

    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'sf:apex.showLocalTests', false);
  });

  it('toggleOrgVisibility flips showOrgTests and sets context key to false', async () => {
    await controller.toggleOrgVisibility();

    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'sf:apex.showOrgTests', false);
  });

  it('toggle local off hides in-workspace items on refresh', async () => {
    const localClassUri = URI.file('/workspace/force-app/main/default/classes/MyTest.cls');
    (testUtils.buildClassToUriIndex as jest.Mock).mockResolvedValue(new Map([['MyTest', localClassUri]]));

    const Effect = jest.requireActual('effect/Effect');
    mockDiscoverTests.mockReturnValue(
      Effect.succeed({
        classes: [
          {
            id: 'class1',
            name: 'MyTest',
            namespacePrefix: null,
            testMethods: [{ name: 'testMethod1', line: 1, column: 1 }]
          }
        ]
      })
    );

    // Initial discovery should include the local class
    await controller.discoverTests();
    const ctrl = controller.getController();
    expect(ctrl.items.size).toBeGreaterThan(0);

    // Toggle local visibility off
    await controller.toggleLocalVisibility();

    // After toggling off local tests, the tree should have been repopulated without local items
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'sf:apex.showLocalTests', false);
    // The tree is cleared and repopulated (refresh is called internally)
    // The namespace wrapper may remain but the class items should not be present
    // Verify by checking that no class items were added (package children are empty)
    let classCount = 0;
    ctrl.items.forEach((nsItem: vscode.TestItem) => {
      nsItem.children.forEach((pkgItem: vscode.TestItem) => {
        classCount += pkgItem.children.size;
      });
    });
    expect(classCount).toBe(0);
  });

  it('toggle org off hides org-only items on refresh', async () => {
    // No local URI means it is org-only
    (testUtils.buildClassToUriIndex as jest.Mock).mockResolvedValue(new Map());

    const Effect = jest.requireActual('effect/Effect');
    mockDiscoverTests.mockReturnValue(
      Effect.succeed({
        classes: [
          {
            id: 'class1',
            name: 'OrgOnlyTest',
            namespacePrefix: null,
            testMethods: [{ name: 'testOrgMethod', line: 1, column: 1 }]
          }
        ]
      })
    );

    // Initial discovery should include the org-only class
    await controller.discoverTests();
    const ctrl = controller.getController();
    expect(ctrl.items.size).toBeGreaterThan(0);

    // Toggle org visibility off
    await controller.toggleOrgVisibility();

    // After toggling off org tests, no class items should exist
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'sf:apex.showOrgTests', false);
    let classCount = 0;
    ctrl.items.forEach((nsItem: vscode.TestItem) => {
      nsItem.children.forEach((pkgItem: vscode.TestItem) => {
        classCount += pkgItem.children.size;
      });
    });
    expect(classCount).toBe(0);
  });

  it('toggling back on restores items', async () => {
    const localClassUri = URI.file('/workspace/force-app/main/default/classes/MyTest.cls');
    (testUtils.buildClassToUriIndex as jest.Mock).mockResolvedValue(new Map([['MyTest', localClassUri]]));

    const Effect = jest.requireActual('effect/Effect');
    mockDiscoverTests.mockReturnValue(
      Effect.succeed({
        classes: [
          {
            id: 'class1',
            name: 'MyTest',
            namespacePrefix: null,
            testMethods: [{ name: 'testMethod1', line: 1, column: 1 }]
          }
        ]
      })
    );

    // Toggle off then back on
    await controller.toggleLocalVisibility();
    await controller.toggleLocalVisibility();

    // After toggling back on, context key should be true again
    const setContextCalls = executeCommandSpy.mock.calls.filter(
      (call: unknown[]) => call[0] === 'setContext' && call[1] === 'sf:apex.showLocalTests'
    );
    const lastCall = setContextCalls[setContextCalls.length - 1];
    expect(lastCall[2]).toBe(true);

    // Tree should have items again
    const ctrl = controller.getController();
    expect(ctrl.items.size).toBeGreaterThan(0);
  });

  it('both toggles off results in empty tree', async () => {
    const localClassUri = URI.file('/workspace/force-app/main/default/classes/LocalTest.cls');
    (testUtils.buildClassToUriIndex as jest.Mock).mockImplementation(async (names: string[]) => {
      const map = new Map<string, any>();
      if (names.includes('LocalTest')) {
        map.set('LocalTest', localClassUri);
      }
      return map;
    });

    const Effect = jest.requireActual('effect/Effect');
    mockDiscoverTests.mockReturnValue(
      Effect.succeed({
        classes: [
          {
            id: 'class1',
            name: 'LocalTest',
            namespacePrefix: null,
            testMethods: [{ name: 'testLocal', line: 1, column: 1 }]
          },
          {
            id: 'class2',
            name: 'OrgOnlyTest',
            namespacePrefix: null,
            testMethods: [{ name: 'testOrg', line: 1, column: 1 }]
          }
        ]
      })
    );

    // Toggle both off
    await controller.toggleLocalVisibility();
    await controller.toggleOrgVisibility();

    // Verify both context keys are false
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'sf:apex.showLocalTests', false);
    expect(executeCommandSpy).toHaveBeenCalledWith('setContext', 'sf:apex.showOrgTests', false);

    // Tree should have no class items
    const ctrl = controller.getController();
    let classCount = 0;
    ctrl.items.forEach((nsItem: vscode.TestItem) => {
      nsItem.children.forEach((pkgItem: vscode.TestItem) => {
        classCount += pkgItem.children.size;
      });
    });
    expect(classCount).toBe(0);
  });
});
