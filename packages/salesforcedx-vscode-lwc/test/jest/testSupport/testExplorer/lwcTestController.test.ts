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

import { lwcTestIndexer } from '../../../../src/testSupport/testIndexer';
import { registerLwcTestController } from '../../../../src/testSupport/testExplorer/lwcTestController';

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
  it('runByExecutionInfo resolves a file item and starts a test run', async () => {
    const testUri = URI.file('/project/force-app/lwc/foo/__tests__/foo.test.js');

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
      createTestRun: jest.fn(() => ({
        started: jest.fn(),
        passed: jest.fn(),
        failed: jest.fn(),
        skipped: jest.fn(),
        errored: jest.fn(),
        appendOutput: jest.fn(),
        end: jest.fn()
      })),
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
    // no active editor
    (vscode.window as any).activeTextEditor = undefined;

    const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
    const ctrl = getLwcTestController();
    await ctrl.runActiveEditorFile(false);

    expect(controller.createTestRun).not.toHaveBeenCalled();
  });
});
