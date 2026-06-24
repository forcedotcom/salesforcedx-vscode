/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

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
});
