/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as vscode from 'vscode';

import { lwcTestIndexer } from '../testIndexer';
import { TestCaseInfo, TestFileInfo } from '../types';
import { SfTestGroupNode, SfTestNode, sortTestNodeByLabel, TestNode } from './testNode';

const getLabelFromTestCaseInfo = (testCaseInfo: TestCaseInfo) => {
  const { testName } = testCaseInfo;
  return testName;
};

const getLabelFromTestFileInfo = (testFileInfo: TestFileInfo) => {
  const { testUri } = testFileInfo;
  const { fsPath } = testUri;
  const ext = '.test.js';
  const testGroupLabel = path.basename(fsPath, ext);
  return testGroupLabel;
};

/**
 * Test Explorer Tree Data Provider implementation
 */
export class SfTestOutlineProvider implements vscode.TreeDataProvider<TestNode>, vscode.Disposable {
  private onDidChangeTestData: vscode.EventEmitter<TestNode | undefined> = new vscode.EventEmitter<
    TestNode | undefined
  >();
  public onDidChangeTreeData = this.onDidChangeTestData.event;
  private disposables: vscode.Disposable[];

  constructor() {
    this.disposables = [];

    lwcTestIndexer.onDidUpdateTestIndex(
      () => {
        this.onDidUpdateTestIndex();
      },
      null,
      this.disposables
    );
    lwcTestIndexer.onDidUpdateTestResultsIndex(
      () => {
        this.onDidUpdateTestResultsIndex();
      },
      null,
      this.disposables
    );
  }

  public getId(): string {
    return 'sf.lightning.lwc.test.view';
  }

  public async collapseAll(): Promise<void> {
    return vscode.commands.executeCommand(`workbench.actions.treeView.${this.getId()}.collapseAll`);
  }

  public dispose() {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private onDidUpdateTestIndex() {
    this.onDidChangeTestData.fire(undefined);
  }

  private onDidUpdateTestResultsIndex() {
    this.onDidChangeTestData.fire(undefined);
  }

  public getTreeItem(element: TestNode): vscode.TreeItem {
    return element;
  }

  /**
   * Retrieve the children of the test node. The actual data comes from the test indexer.
   * It retrieves all available test file nodes,
   * and retrieves the test cases nodes from a test file.
   * @param element test node
   */
  public async getChildren(element?: TestNode): Promise<TestNode[]> {
    if (element) {
      if (element instanceof SfTestGroupNode) {
        if (element.location) {
          const testInfo = await lwcTestIndexer.findTestInfoFromLwcJestTestFile(element.location.uri);
          if (testInfo) {
            return testInfo.map(testCaseInfo => {
              const testNodeLabel = getLabelFromTestCaseInfo(testCaseInfo);
              return new SfTestNode(testNodeLabel, testCaseInfo);
            });
          }
        }
      }
      return [];
    } else {
      try {
        const allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
        return allTestFileInfo
          .map(testFileInfo => {
            const testNodeLabel = getLabelFromTestFileInfo(testFileInfo);
            const testGroupNode = new SfTestGroupNode(testNodeLabel, testFileInfo);
            return testGroupNode;
          })
          .sort(sortTestNodeByLabel);
      } catch (error) {
        console.error(error);
        return [];
      }
    }
  }
}

/**
 * Register test explorer with extension context
 * @param extensionContext extension context
 */
export const registerLwcTestExplorerTreeView = (extensionContext: vscode.ExtensionContext) => {
  const testOutlineProvider = new SfTestOutlineProvider();
  const testProvider = vscode.window.registerTreeDataProvider(testOutlineProvider.getId(), testOutlineProvider);
  extensionContext.subscriptions.push(testOutlineProvider);
  extensionContext.subscriptions.push(testProvider);

  const collapseAllTestCommand = vscode.commands.registerCommand(`${testOutlineProvider.getId()}.collapseAll`, () =>
    testOutlineProvider.collapseAll()
  );
  extensionContext.subscriptions.push(collapseAllTestCommand);
};
