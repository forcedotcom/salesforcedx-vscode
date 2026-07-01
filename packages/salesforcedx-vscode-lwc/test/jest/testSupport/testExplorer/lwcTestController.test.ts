/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

// runtime.ts reads AllServicesLayer from ./extensionProvider; without a real layer getRuntime() dies with
// `Cannot read properties of undefined (reading '_op_layer')`. Mock the provider module so getRuntime()
// resolves and FsService.readFile returns the fixture json the results-reading path parses.
let mockReadFileResult = '';
const mockFsReadFile = jest.fn();
jest.mock('../../../../src/services/extensionProvider', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  const Layer = jest.requireActual('effect/Layer');
  const { ExtensionProviderService } = jest.requireActual('@salesforce/effect-ext-utils');
  const mockServicesApi = {
    services: {
      FsService: { readFile: mockFsReadFile }
    }
  };
  const MockAllServicesLayer = Layer.effect(
    ExtensionProviderService,
    EffectLib.sync(() => ({ getServicesApi: EffectLib.succeed(mockServicesApi) }))
  );
  return {
    AllServicesLayer: MockAllServicesLayer,
    setAllServicesLayer: jest.fn()
  };
});

// jest.base.config sets resetMocks:true, which clears mockFsReadFile's implementation before every test.
// Re-establish it here (Effect.succeed of the current fixture) so getRuntime().runPromise resolves.
beforeEach(() => {
  const EffectLib = jest.requireActual('effect/Effect');
  mockFsReadFile.mockImplementation(() => EffectLib.succeed(mockReadFileResult));
});

// Indexer is a singleton imported by the controller; mock it so discovery returns a known file + case.
jest.mock('../../../../src/testSupport/testIndexer', () => ({
  lwcTestIndexer: {
    onDidUpdateTestIndex: jest.fn(() => ({ dispose: jest.fn() })),
    onDidUpdateTestResultsIndex: jest.fn(() => ({ dispose: jest.fn() })),
    resetIndex: jest.fn(),
    findAllTestFileInfo: jest.fn(),
    findTestInfoFromLwcJestTestFile: jest.fn()
  }
}));

// Mock isLwcJestTest so we can control its return value per test
jest.mock('../../../../src/testSupport/utils/isLwcJestTest', () => ({
  isLwcJestTest: jest.fn()
}));

// Mock telemetry and workspace services
jest.mock('../../../../src/telemetry', () => ({
  telemetryService: {
    sendEventData: jest.fn()
  }
}));

jest.mock('../../../../src/testSupport/workspace', () => ({
  workspace: {
    getTestWorkspaceFolder: jest.fn()
  },
  workspaceService: {
    getCurrentWorkspaceTypeForTelemetry: jest.fn(() => 'SFDX')
  }
}));

import { lwcTestIndexer } from '../../../../src/testSupport/testIndexer';
import { isLwcJestTest } from '../../../../src/testSupport/utils/isLwcJestTest';
import {
  registerLwcTestController,
  disposeLwcTestController
} from '../../../../src/testSupport/testExplorer/lwcTestController';

// Minimal mutable TestItem the controller writes `tags` onto.
type FakeTestItem = {
  id: string;
  label: string;
  uri?: URI;
  canResolveChildren: boolean;
  tags: readonly vscode.TestTag[];
  range?: vscode.Range;
  parent?: FakeTestItem;
  children: { replace: (items: FakeTestItem[]) => void };
};

const tagIds = (item: FakeTestItem): string[] => item.tags.map(tag => tag.id);

const flushMicrotasks = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

describe('LwcTestController test item tags', () => {
  // The controller is a module-level singleton, so a single registration drives both discovery and resolve.
  it('tags discovered file items and resolved case items with the in-workspace tag', async () => {
    const testUri = URI.file('/project/force-app/lwc/foo/__tests__/foo.test.js');
    let resolveHandler: ((test: FakeTestItem | undefined) => Promise<void>) | undefined;
    let topLevelItems: FakeTestItem[] = [];

    const controller = {
      get resolveHandler() {
        return resolveHandler;
      },
      set resolveHandler(handler) {
        resolveHandler = handler;
      },
      refreshHandler: undefined,
      items: {
        replace: (items: FakeTestItem[]) => {
          topLevelItems = items;
        },
        forEach: (cb: (item: FakeTestItem) => void) => topLevelItems.forEach(cb)
      },
      createTestItem: (id: string, label: string, uri?: URI): FakeTestItem => ({
        id,
        label,
        uri,
        canResolveChildren: false,
        tags: [],
        children: { replace: jest.fn() }
      }),
      createRunProfile: jest.fn(),
      createTestRun: jest.fn(),
      dispose: jest.fn()
    };

    (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
    (lwcTestIndexer.findAllTestFileInfo as jest.Mock).mockResolvedValue([{ kind: 'testFile', testUri }]);
    (lwcTestIndexer.findTestInfoFromLwcJestTestFile as jest.Mock).mockResolvedValue([
      { kind: 'testCase', testUri, testName: 'does a thing', ancestorTitles: [] }
    ]);

    registerLwcTestController({ subscriptions: [] } as unknown as vscode.ExtensionContext);
    // registerLwcTestController kicks off refresh() -> populateFiles(); let the microtasks settle.
    await flushMicrotasks();

    expect(topLevelItems).toHaveLength(1);
    const fileItem = topLevelItems[0];
    expect(tagIds(fileItem)).toContain('in-workspace');

    // Capture the case items the controller adds when the file's children are resolved.
    const caseItems: FakeTestItem[] = [];
    fileItem.children.replace = (items: FakeTestItem[]) => caseItems.push(...items);

    await resolveHandler!(fileItem);

    expect(caseItems).toHaveLength(1);
    expect(tagIds(caseItems[0])).toContain('in-workspace');
  });
});

describe('LwcTestController public run API', () => {
  beforeEach(() => {
    // Dispose the singleton so each test gets a fresh controller bound to its own mocks
    disposeLwcTestController();
    // Reset the isLwcJestTest mock between tests
    (isLwcJestTest as jest.Mock).mockReset();
  });

  it('runByExecutionInfo resolves a file item and starts a test run', async () => {
    const testUri = URI.file('/project/force-app/lwc/foo/__tests__/foo.test.js');

    const mockRun = {
      started: jest.fn(),
      passed: jest.fn(),
      failed: jest.fn(),
      skipped: jest.fn(),
      errored: jest.fn(),
      appendOutput: jest.fn(),
      end: jest.fn()
    };

    const controller = {
      resolveHandler: undefined,
      refreshHandler: undefined,
      items: {
        replace: jest.fn(),
        forEach: jest.fn()
      },
      createTestItem: (id: string, label: string, uri?: URI) => ({
        id,
        label,
        uri,
        canResolveChildren: false,
        tags: [],
        children: { replace: jest.fn(), forEach: jest.fn() }
      }),
      createRunProfile: jest.fn(() => ({ dispose: jest.fn() })),
      createTestRun: jest.fn(() => mockRun),
      dispose: jest.fn()
    };

    // Mock TestRunRequest and CancellationTokenSource
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (vscode.TestRunRequest as any) = jest.fn(function (this: any, include: any, exclude: any, profile: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.include = include;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.exclude = exclude;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.profile = profile;
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (vscode.CancellationTokenSource as any) = jest.fn(() => ({
      token: { isCancellationRequested: false, onCancellationRequested: jest.fn() },
      cancel: jest.fn(),
      dispose: jest.fn()
    }));

    (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
    (lwcTestIndexer.findAllTestFileInfo as jest.Mock).mockResolvedValue([{ kind: 'testFile', testUri }]);
    (lwcTestIndexer.findTestInfoFromLwcJestTestFile as jest.Mock).mockResolvedValue([]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ctrl = getLwcTestController();
    await ctrl.refresh();

    // executeOne will be invoked; stub the shell info so the run short-circuits without spawning a task.
    jest
      .spyOn(require('../../../../src/testSupport/testRunner/testRunner').TestRunner.prototype, 'getShellExecutionInfo')
      .mockResolvedValue(undefined);

    await ctrl.runByExecutionInfo({ kind: 'testFile', testUri }, false);

    expect(controller.createTestRun).toHaveBeenCalled();
  });

  it('runActiveEditorFile no-ops when there is no active editor', async () => {
    const controller = {
      resolveHandler: undefined,
      refreshHandler: undefined,
      items: { replace: jest.fn(), forEach: jest.fn() },
      createTestItem: jest.fn(),
      createRunProfile: jest.fn(() => ({ dispose: jest.fn() })),
      createTestRun: jest.fn(),
      dispose: jest.fn()
    };
    (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
    // no active editor
    (vscode.window as any).activeTextEditor = undefined;

    const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
    const ctrl = getLwcTestController();
    await ctrl.runActiveEditorFile(false);

    expect(controller.createTestRun).not.toHaveBeenCalled();
  });

  it('runActiveEditorFile no-ops when the active editor is not an LWC jest test', async () => {
    const controller = {
      resolveHandler: undefined,
      refreshHandler: undefined,
      items: { replace: jest.fn(), forEach: jest.fn() },
      createTestItem: jest.fn(),
      createRunProfile: jest.fn(() => ({ dispose: jest.fn() })),
      createTestRun: jest.fn(),
      dispose: jest.fn()
    };
    (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);

    // active editor with a document that is NOT an LWC jest test
    const mockDocument = {
      uri: { fsPath: '/project/src/app.ts' },
      languageId: 'typescript'
    };
    (vscode.window as any).activeTextEditor = {
      document: mockDocument
    };

    // isLwcJestTest returns false for this document
    (isLwcJestTest as jest.Mock).mockReturnValue(false);

    const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
    const ctrl = getLwcTestController();
    await ctrl.runActiveEditorFile(false);

    expect(controller.createTestRun).not.toHaveBeenCalled();
    expect(isLwcJestTest).toHaveBeenCalledWith(mockDocument);
  });

  it('runByExecutionInfo runs the resolved case item when a matching case is found', async () => {
    const testUri = URI.file('/project/force-app/lwc/foo/__tests__/foo.test.js');

    const mockRun = {
      started: jest.fn(),
      passed: jest.fn(),
      failed: jest.fn(),
      skipped: jest.fn(),
      errored: jest.fn(),
      appendOutput: jest.fn(),
      end: jest.fn()
    };

    const controller = {
      resolveHandler: undefined,
      refreshHandler: undefined,
      items: {
        replace: jest.fn(),
        forEach: jest.fn()
      },
      createTestItem: (id: string, label: string, uri?: URI) => ({
        id,
        label,
        uri,
        canResolveChildren: false,
        tags: [],
        children: { replace: jest.fn(), forEach: jest.fn() }
      }),
      createRunProfile: jest.fn(() => ({ dispose: jest.fn() })),
      createTestRun: jest.fn(() => mockRun),
      dispose: jest.fn()
    };

    // Mock TestRunRequest and CancellationTokenSource
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (vscode.TestRunRequest as any) = jest.fn(function (this: any, include: any, exclude: any, profile: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.include = include;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.exclude = exclude;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.profile = profile;
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (vscode.CancellationTokenSource as any) = jest.fn(() => ({
      token: { isCancellationRequested: false, onCancellationRequested: jest.fn() },
      cancel: jest.fn(),
      dispose: jest.fn()
    }));

    (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
    (lwcTestIndexer.findAllTestFileInfo as jest.Mock).mockResolvedValue([{ kind: 'testFile', testUri }]);
    // Return a matching case
    (lwcTestIndexer.findTestInfoFromLwcJestTestFile as jest.Mock).mockResolvedValue([
      { kind: 'testCase', testUri, testName: 'should do something', ancestorTitles: [] }
    ]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ctrl = getLwcTestController();
    await ctrl.refresh();

    // Short-circuit test execution
    jest
      .spyOn(require('../../../../src/testSupport/testRunner/testRunner').TestRunner.prototype, 'getShellExecutionInfo')
      .mockResolvedValue(undefined);

    await ctrl.runByExecutionInfo({ kind: 'testCase', testUri, testName: 'should do something' }, false);

    // Verify the test run was created (which proves the code path executed)
    expect(controller.createTestRun).toHaveBeenCalled();
    expect(mockRun.end).toHaveBeenCalled();
  });

  it('runByExecutionInfo preserves testName when no matching case item is found (execOverride path)', async () => {
    const testUri = URI.file('/project/force-app/lwc/foo/__tests__/foo.test.js');

    const mockRun = {
      started: jest.fn(),
      passed: jest.fn(),
      failed: jest.fn(),
      skipped: jest.fn(),
      errored: jest.fn(),
      appendOutput: jest.fn(),
      end: jest.fn()
    };

    const controller = {
      resolveHandler: undefined,
      refreshHandler: undefined,
      items: {
        replace: jest.fn(),
        forEach: jest.fn()
      },
      createTestItem: (id: string, label: string, uri?: URI) => ({
        id,
        label,
        uri,
        canResolveChildren: false,
        tags: [],
        children: { replace: jest.fn(), forEach: jest.fn() }
      }),
      createRunProfile: jest.fn(() => ({ dispose: jest.fn() })),
      createTestRun: jest.fn(() => mockRun),
      dispose: jest.fn()
    };

    // Mock TestRunRequest and CancellationTokenSource
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (vscode.TestRunRequest as any) = jest.fn(function (this: any, include: any, exclude: any, profile: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.include = include;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.exclude = exclude;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.profile = profile;
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (vscode.CancellationTokenSource as any) = jest.fn(() => ({
      token: { isCancellationRequested: false, onCancellationRequested: jest.fn() },
      cancel: jest.fn(),
      dispose: jest.fn()
    }));

    (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
    (lwcTestIndexer.findAllTestFileInfo as jest.Mock).mockResolvedValue([{ kind: 'testFile', testUri }]);
    // Return NO matching cases (simulates cold cache or dynamic test name)
    (lwcTestIndexer.findTestInfoFromLwcJestTestFile as jest.Mock).mockResolvedValue([]);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ctrl = getLwcTestController();
    await ctrl.refresh();

    // Capture TestRunner construction to verify it receives testCase exec (not testFile)
    const TestRunnerModule = require('../../../../src/testSupport/testRunner/testRunner');
    const originalTestRunner = TestRunnerModule.TestRunner;
    let capturedExecInfo: any;
    TestRunnerModule.TestRunner = class extends originalTestRunner {
      constructor(execInfo: any, mode: any) {
        capturedExecInfo = execInfo;
        super(execInfo, mode);
      }
    };
    jest.spyOn(TestRunnerModule.TestRunner.prototype, 'getShellExecutionInfo').mockResolvedValue(undefined);

    // Request a specific test case that doesn't exist in the index
    await ctrl.runByExecutionInfo({ kind: 'testCase', testUri, testName: 'missing test case' }, false);

    expect(controller.createTestRun).toHaveBeenCalled();
    // The run.started is called with the file item (fallback, id starts with 'file:')
    expect(mockRun.started).toHaveBeenCalledWith(expect.objectContaining({ id: expect.stringContaining('file:') }));
    // But the TestRunner should still receive the testCase exec info (the override)
    expect(capturedExecInfo).toMatchObject({ kind: 'testCase', testName: 'missing test case' });

    // Restore
    TestRunnerModule.TestRunner = originalTestRunner;
  });

  // Darwin-only scenario: the /private symlink prefix only exists on macOS, and normalizeJestFsPath
  // strips it via a POSIX (forward-slash) regex over URI.fsPath. We can mock process.platform here,
  // but vscode-uri fixes its path-separator behaviour at import time, so on a Windows host URI.fsPath
  // returns backslashes and the strip can't be exercised faithfully. Skip on Windows.
  (process.platform === 'win32' ? describe.skip : describe)('URI normalization (macOS /private)', () => {
    it('runByExecutionInfo normalizes URI when resolving test item so tree item receives run updates', async () => {
      // Mock platform to darwin for deterministic test
      const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

      try {
        // Discovery returns normalized path (what findFiles produces on macOS)
        const normalizedUri = URI.file('/var/folders/xx/foo/__tests__/foo.test.js');
        // Command/code-lens supplies realpath with /private prefix
        const realpathUri = URI.file('/private/var/folders/xx/foo/__tests__/foo.test.js');

        let capturedTreeItems: FakeTestItem[] = [];
        let capturedRunRequest: any;

        const mockRun = {
          started: jest.fn(),
          passed: jest.fn(),
          failed: jest.fn(),
          skipped: jest.fn(),
          errored: jest.fn(),
          appendOutput: jest.fn(),
          end: jest.fn()
        };

        const controller = {
          resolveHandler: undefined,
          refreshHandler: undefined,
          items: {
            replace: (items: FakeTestItem[]) => {
              capturedTreeItems = items;
            },
            forEach: (cb: (item: FakeTestItem) => void) => capturedTreeItems.forEach(cb)
          },
          createTestItem: (id: string, label: string, uri?: URI) => ({
            id,
            label,
            uri,
            canResolveChildren: false,
            tags: [],
            children: { replace: jest.fn(), forEach: jest.fn() }
          }),
          createRunProfile: jest.fn(() => ({ dispose: jest.fn() })),
          createTestRun: jest.fn((request: any) => {
            capturedRunRequest = request;
            return mockRun;
          }),
          dispose: jest.fn()
        };

        // Mock TestRunRequest and CancellationTokenSource
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        (vscode.TestRunRequest as any) = jest.fn(function (this: any, include: any, exclude: any, profile: any) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          this.include = include;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          this.exclude = exclude;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          this.profile = profile;
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        (vscode.CancellationTokenSource as any) = jest.fn(() => ({
          token: { isCancellationRequested: false, onCancellationRequested: jest.fn() },
          cancel: jest.fn(),
          dispose: jest.fn()
        }));

        (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
        (lwcTestIndexer.findAllTestFileInfo as jest.Mock).mockResolvedValue([
          { kind: 'testFile' as const, testUri: normalizedUri }
        ]);
        (lwcTestIndexer.findTestInfoFromLwcJestTestFile as jest.Mock).mockResolvedValue([]);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const ctrl = getLwcTestController();
        await ctrl.refresh();

        // Capture the tree item created by populateFiles
        expect(capturedTreeItems).toHaveLength(1);
        const treeItem = capturedTreeItems[0];

        jest
          .spyOn(
            require('../../../../src/testSupport/testRunner/testRunner').TestRunner.prototype,
            'getShellExecutionInfo'
          )
          .mockResolvedValue(undefined);

        // Run with the /private-prefixed URI (what an editor/command would supply)
        await ctrl.runByExecutionInfo({ kind: 'testFile' as const, testUri: realpathUri }, false);

        expect(controller.createTestRun).toHaveBeenCalled();
        // The run must target the SAME item instance in the tree (not a detached item)
        expect(capturedRunRequest.include).toHaveLength(1);
        const runTargetItem = capturedRunRequest.include[0];
        expect(runTargetItem.id).toBe(treeItem.id);
        expect(runTargetItem).toBe(treeItem);
      } finally {
        // Restore original platform
        if (originalPlatform) {
          Object.defineProperty(process, 'platform', originalPlatform);
        }
      }
    });
  });

  // Regression for the Windows run-all "(Skipped)" decoration bug: VS Code's findFiles can return an 8.3 short
  // path (C:\Users\RUNNER~1\...) while jest's result `name` carries the OS-resolved long path
  // (C:\Users\runneradmin\...). Those produce different URI.toString() keys, so applyResults' exact
  // fileItems.get() misses, the run.started() row is never resolved, and run.end() flips it to Skipped even
  // though jest passed. resolveDiscoveryUri reconciles the long jest path back to the short discovery URI via a
  // shared-suffix match. We model the divergence with POSIX-style paths (forward slashes, distinct ancestor
  // segment) so it reproduces faithfully on the non-Windows CI host without mocking process.platform.
  it('applyResults marks the discovery file item passed when jest reports an aliased (long) path', async () => {
    // Discovery URI (what findFiles surfaces): aliased ancestor segment `RUNNER~1`.
    const discoveryUri = URI.file('/c/Users/RUNNER~1/work/proj/force-app/lwc/lwc1/__tests__/lwc1.test.js');
    // Jest result URI (what the result JSON `name` carries): long ancestor segment `runneradmin`.
    const jestPath = '/c/Users/runneradmin/work/proj/force-app/lwc/lwc1/__tests__/lwc1.test.js';
    // Sanity: the two URIs really do key differently, so an exact lookup would miss without reconciliation.
    expect(URI.file(jestPath).toString()).not.toBe(discoveryUri.toString());

    let capturedTreeItems: FakeTestItem[] = [];
    let runAllHandler: ((request: any, token: any) => Promise<void>) | undefined;

    const mockRun = {
      started: jest.fn(),
      passed: jest.fn(),
      failed: jest.fn(),
      skipped: jest.fn(),
      errored: jest.fn(),
      appendOutput: jest.fn(),
      end: jest.fn()
    };

    const controller = {
      resolveHandler: undefined,
      refreshHandler: undefined,
      items: {
        replace: (items: FakeTestItem[]) => {
          capturedTreeItems = items;
        },
        forEach: (cb: (item: FakeTestItem) => void) => capturedTreeItems.forEach(cb)
      },
      createTestItem: (id: string, label: string, uri?: URI) => ({
        id,
        label,
        uri,
        canResolveChildren: false,
        tags: [],
        children: { replace: jest.fn(), forEach: jest.fn() }
      }),
      // The Run profile's runHandler drives the implicit run-all; capture it so the test can invoke it.
      createRunProfile: jest.fn((_label: string, kind: any, handler: any) => {
        if (kind === vscode.TestRunProfileKind.Run) {
          runAllHandler = handler;
        }
        return { dispose: jest.fn() };
      }),
      createTestRun: jest.fn(() => mockRun),
      dispose: jest.fn()
    };

    (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
    (lwcTestIndexer.findAllTestFileInfo as jest.Mock).mockResolvedValue([
      { kind: 'testFile' as const, testUri: discoveryUri }
    ]);
    (lwcTestIndexer.findTestInfoFromLwcJestTestFile as jest.Mock).mockResolvedValue([]);

    // Implicit run-all routes through runAllAsDirectory, which needs a workspace folder.
    const { workspace: lwcWorkspace } = require('../../../../src/testSupport/workspace');
    (lwcWorkspace.getTestWorkspaceFolder as jest.Mock).mockReturnValue({
      uri: URI.file('/c/Users/RUNNER~1/work/proj')
    });

    // Stub the runner so executeOne proceeds to the task/results phase without spawning a real jest process.
    jest
      .spyOn(require('../../../../src/testSupport/testRunner/testRunner').TestRunner.prototype, 'getShellExecutionInfo')
      .mockResolvedValue({
        command: 'node',
        args: [],
        workspaceFolder: { uri: URI.file('/c/Users/RUNNER~1/work/proj') },
        testResultFsPath: '/c/Users/RUNNER~1/work/proj/.sfdx/tools/testresults/lwc/test-result-1.json'
      });

    // Fake task that ends right after execute resolves, so awaitTaskEnd resolves. The real SfTask fires onDidEnd
    // asynchronously via the task-end event; fire on the next tick here too, otherwise awaitTaskEnd's
    // endDisposable isn't assigned yet when the handler runs (its .dispose() would throw).
    const taskServiceModule = require('../../../../src/testSupport/testRunner/taskService');
    jest.spyOn(taskServiceModule.taskService, 'createTask').mockImplementation(() => {
      let endCb: (() => void) | undefined;
      return {
        onDidEnd: (cb: () => void) => {
          endCb = cb;
          return { dispose: jest.fn() };
        },
        execute: jest.fn().mockImplementation(() => {
          setImmediate(() => endCb?.());
          return Promise.resolve();
        }),
        terminate: jest.fn()
      };
    });

    // readJestResults -> FsService.readFile (mocked). Return a passing suite whose `name` is the LONG (jest)
    // path, so applyResults must reconcile it back to the short discovery URI.
    mockReadFileResult = JSON.stringify({
      testResults: [
        {
          name: jestPath,
          status: 'passed',
          assertionResults: []
        }
      ]
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ctrl = getLwcTestController();
    await ctrl.refresh();

    expect(capturedTreeItems).toHaveLength(1);
    const treeItem = capturedTreeItems[0];
    expect(runAllHandler).toBeDefined();

    // Implicit run-all: empty include + no exclude. onCancellationRequested must return a disposable —
    // awaitTaskEnd disposes it inside its onDidEnd handler before resolving.
    await runAllHandler!(
      { include: undefined, exclude: undefined },
      { isCancellationRequested: false, onCancellationRequested: jest.fn(() => ({ dispose: jest.fn() })) }
    );

    // The discovery row was marked running...
    expect(mockRun.started).toHaveBeenCalledWith(treeItem);
    // ...and applyResults must mark that SAME discovery item passed despite the aliased jest path.
    expect(mockRun.passed).toHaveBeenCalledWith(treeItem);
    expect(mockRun.skipped).not.toHaveBeenCalledWith(treeItem);
  });

  it('runByExecutionInfo reveals Test Results panel when starting a run', async () => {
    const testUri = URI.file('/project/force-app/lwc/foo/__tests__/foo.test.js');

    const mockRun = {
      started: jest.fn(),
      passed: jest.fn(),
      failed: jest.fn(),
      skipped: jest.fn(),
      errored: jest.fn(),
      appendOutput: jest.fn(),
      end: jest.fn()
    };

    const controller = {
      resolveHandler: undefined,
      refreshHandler: undefined,
      items: {
        replace: jest.fn(),
        forEach: jest.fn()
      },
      createTestItem: (id: string, label: string, uri?: URI) => ({
        id,
        label,
        uri,
        canResolveChildren: false,
        tags: [],
        children: { replace: jest.fn(), forEach: jest.fn() }
      }),
      createRunProfile: jest.fn(() => ({ dispose: jest.fn() })),
      createTestRun: jest.fn(() => mockRun),
      dispose: jest.fn()
    };

    // Mock TestRunRequest and CancellationTokenSource
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (vscode.TestRunRequest as any) = jest.fn(function (this: any, include: any, exclude: any, profile: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.include = include;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.exclude = exclude;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.profile = profile;
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (vscode.CancellationTokenSource as any) = jest.fn(() => ({
      token: { isCancellationRequested: false, onCancellationRequested: jest.fn() },
      cancel: jest.fn(),
      dispose: jest.fn()
    }));

    (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
    (lwcTestIndexer.findAllTestFileInfo as jest.Mock).mockResolvedValue([{ kind: 'testFile' as const, testUri }]);
    (lwcTestIndexer.findTestInfoFromLwcJestTestFile as jest.Mock).mockResolvedValue([]);

    // Get fresh vscode mock to spy on executeCommand
    const vscodeMock = jest.requireMock('vscode');
    const executeCommandSpy = vscodeMock.commands.executeCommand as jest.Mock;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ctrl = getLwcTestController();
    await ctrl.refresh();

    // Short-circuit test execution
    jest
      .spyOn(require('../../../../src/testSupport/testRunner/testRunner').TestRunner.prototype, 'getShellExecutionInfo')
      .mockResolvedValue(undefined);

    // Run the test via runByExecutionInfo (command entry point)
    await ctrl.runByExecutionInfo({ kind: 'testFile' as const, testUri }, false);

    // Assert Test Results panel reveal was called
    expect(executeCommandSpy).toHaveBeenCalledWith('workbench.panel.testResults.view.focus');
  });

  it('runByExecutionInfo reveals Test Results panel when starting a debug run', async () => {
    const testUri = URI.file('/project/force-app/lwc/foo/__tests__/foo.test.js');

    const mockRun = {
      started: jest.fn(),
      passed: jest.fn(),
      failed: jest.fn(),
      skipped: jest.fn(),
      errored: jest.fn(),
      appendOutput: jest.fn(),
      end: jest.fn()
    };

    const controller = {
      resolveHandler: undefined,
      refreshHandler: undefined,
      items: {
        replace: jest.fn(),
        forEach: jest.fn()
      },
      createTestItem: (id: string, label: string, uri?: URI) => ({
        id,
        label,
        uri,
        canResolveChildren: false,
        tags: [],
        children: { replace: jest.fn(), forEach: jest.fn() }
      }),
      createRunProfile: jest.fn(() => ({ dispose: jest.fn() })),
      createTestRun: jest.fn(() => mockRun),
      dispose: jest.fn()
    };

    // Mock TestRunRequest and CancellationTokenSource
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (vscode.TestRunRequest as any) = jest.fn(function (this: any, include: any, exclude: any, profile: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.include = include;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.exclude = exclude;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.profile = profile;
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (vscode.CancellationTokenSource as any) = jest.fn(() => ({
      token: { isCancellationRequested: false, onCancellationRequested: jest.fn() },
      cancel: jest.fn(),
      dispose: jest.fn()
    }));

    (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
    (lwcTestIndexer.findAllTestFileInfo as jest.Mock).mockResolvedValue([{ kind: 'testFile' as const, testUri }]);
    (lwcTestIndexer.findTestInfoFromLwcJestTestFile as jest.Mock).mockResolvedValue([]);

    // Get fresh vscode mock to spy on executeCommand
    const vscodeMock = jest.requireMock('vscode');
    const executeCommandSpy = vscodeMock.commands.executeCommand as jest.Mock;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const ctrl = getLwcTestController();
    await ctrl.refresh();

    // Short-circuit test execution
    jest
      .spyOn(require('../../../../src/testSupport/testRunner/testRunner').TestRunner.prototype, 'getShellExecutionInfo')
      .mockResolvedValue(undefined);

    // Run the test via runByExecutionInfo with isDebug=true (debug command entry point)
    await ctrl.runByExecutionInfo({ kind: 'testFile' as const, testUri }, true);

    // Assert Test Results panel reveal was called for debug runs too
    expect(executeCommandSpy).toHaveBeenCalledWith('workbench.panel.testResults.view.focus');
  });
});
