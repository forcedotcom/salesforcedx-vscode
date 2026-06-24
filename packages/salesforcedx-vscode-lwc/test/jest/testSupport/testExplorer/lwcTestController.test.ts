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
