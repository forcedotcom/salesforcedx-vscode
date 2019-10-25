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
import {
  SfdxTestGroupNode,
  SfdxTestNode,
  sortTestNodeByLabel,
  TestNode
} from './testNode';

function getLabelFromTestCaseInfo(testCaseInfo: TestCaseInfo) {
  const { testName } = testCaseInfo;
  return testName;
}

function getLabelFromTestFileInfo(testFileInfo: TestFileInfo) {
  const { testUri } = testFileInfo;
  const { fsPath } = testUri;
  const ext = '.test.js';
  const testGroupLabel = path.basename(fsPath, ext);
  return testGroupLabel;
}

export class SfdxTestOutlineProvider
  implements vscode.TreeDataProvider<TestNode>, vscode.Disposable {
  private onDidChangeTestData: vscode.EventEmitter<
    TestNode | undefined
  > = new vscode.EventEmitter<TestNode | undefined>();
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

  public dispose() {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private onDidUpdateTestIndex() {
    this.onDidChangeTestData.fire();
  }

  private onDidUpdateTestResultsIndex() {
    this.onDidChangeTestData.fire();
  }

  public getTreeItem(element: TestNode): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: TestNode): Promise<TestNode[]> {
    if (element) {
      if (element instanceof SfdxTestGroupNode) {
        if (element.location) {
          const testInfo = await lwcTestIndexer.findTestInfoFromLwcJestTestFile(
            element.location.uri
          );
          if (testInfo) {
            return testInfo.map(testCaseInfo => {
              const testNodeLabel = getLabelFromTestCaseInfo(testCaseInfo);
              return new SfdxTestNode(testNodeLabel, testCaseInfo);
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
            const testGroupNode = new SfdxTestGroupNode(
              testNodeLabel,
              testFileInfo
            );
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

export function registerLwcTestExplorerTreeView(
  context: vscode.ExtensionContext
) {
  const testOutlineProvider = new SfdxTestOutlineProvider();
  const testProvider = vscode.window.registerTreeDataProvider(
    'sfdx.force.lightning.lwc.test.view',
    testOutlineProvider
  );
  context.subscriptions.push(testOutlineProvider);
  context.subscriptions.push(testProvider);
}
