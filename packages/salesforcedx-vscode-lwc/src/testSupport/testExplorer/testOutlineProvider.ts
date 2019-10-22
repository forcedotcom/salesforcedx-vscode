/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { lwcTestIndexer } from '../testIndexer';
import { TestExecutionInfo } from '../types';
import { getIconPath } from './iconPaths';

export abstract class TestNode extends vscode.TreeItem {
  public children = new Array<TestNode>();
  public description: string;
  public name: string;
  public location?: vscode.Location;
  public iconPath = getIconPath();

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    location?: vscode.Location
  ) {
    super(label, collapsibleState);
    this.location = location;
    this.description = label;
    this.name = label;
    this.command = {
      command: 'sfdx.force.test.view.showError',
      title: '', // nls.localize('force_test_view_show_error_title'),
      arguments: [this]
    };
  }
}

export class SfdxTestNode extends TestNode {
  public errorMessage: string = '';
  public stackTrace: string = '';
  public outcome = 'Not Run';
  public contextValue?: string;
  public testExecutionInfo?: TestExecutionInfo;

  constructor(
    label: string,
    location?: vscode.Location,
    testExecutionInfo?: TestExecutionInfo
  ) {
    super(label, vscode.TreeItemCollapsibleState.None, location);
    this.testExecutionInfo = testExecutionInfo;
    if (testExecutionInfo) {
      const { testType, testResult } = testExecutionInfo;
      this.contextValue = `${testType}Test`;
      this.iconPath = getIconPath(testResult);
    }
  }
}

export class SfdxTestGroupNode extends TestNode {
  public contextValue?: string;
  public testExecutionInfo?: TestExecutionInfo;
  constructor(
    label: string,
    location: vscode.Location | undefined,
    testExecutionInfo: TestExecutionInfo,
    // testType: TestType,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Expanded
  ) {
    super(label, collapsibleState, location);
    this.testExecutionInfo = testExecutionInfo;
    if (testExecutionInfo) {
      const { testType, testResult } = testExecutionInfo;
      this.contextValue = `${testType}TestGroup`;
      this.iconPath = getIconPath(testResult);
    }
  }
}

import * as path from 'path';

export class SfdxTestOutlineProvider
  implements vscode.TreeDataProvider<TestNode>, vscode.Disposable {
  private onDidChangeTestData: vscode.EventEmitter<
    TestNode | undefined
  > = new vscode.EventEmitter<TestNode | undefined>();
  public onDidChangeTreeData = this.onDidChangeTestData.event;
  private rootNode: TestNode | null;
  private disposables: vscode.Disposable[];

  constructor() {
    this.rootNode = null;
    // this.getAllTests();
    this.disposables = [];

    lwcTestIndexer.onDidUpdateTestIndex.event(
      () => {
        this.onDidUpdateTestIndex();
      },
      null,
      this.disposables
    );
    lwcTestIndexer.onDidUpdateTestResultsIndex.event(
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
    if (element) {
      return element;
    } else {
      //  TODO - no tests
      if (!(this.rootNode && this.rootNode.children.length > 0)) {
        this.rootNode = new SfdxTestNode('no tests here');
        const childNode = new SfdxTestNode('no tests here');
        this.rootNode.children.push(childNode);
      }
      return this.rootNode;
    }
  }

  public async getChildren(element: TestNode): Promise<TestNode[]> {
    if (element) {
      if (element instanceof SfdxTestGroupNode) {
        if (element.location) {
          const testInfo = await lwcTestIndexer.findTestInfoFromLwcJestTestFile(
            element.location.uri
          );
          if (testInfo) {
            return testInfo.map(testCaseInfo => {
              const { testName, testUri, testLocation } = testCaseInfo;
              return new SfdxTestNode(testName, testLocation, testCaseInfo);
            });
          }
        }
      }
      return [];
      // return element.children; // TODO - cache here
    } else {
      try {
        const allTestFileInfo = await lwcTestIndexer.findAllTestFileInfo();
        return allTestFileInfo
          .map(testFileInfo => {
            const { testUri, testLocation } = testFileInfo;
            const { fsPath } = testUri;
            const ext = '.test.js';
            const testGroupLabel = path.basename(fsPath, ext);
            const testGroupNode = new SfdxTestGroupNode(
              testGroupLabel,
              testLocation,
              testFileInfo,
              vscode.TreeItemCollapsibleState.Collapsed
            );
            return testGroupNode;
          })
          .sort((node1, node2) => {
            const label1 = node1!.label;
            const label2 = node2!.label;
            if (!label1) {
              return -1;
            }
            if (!label2) {
              return 1;
            }
            return label1.localeCompare(label2);
          });
      } catch (error) {
        return [];
      }
      /*
      // TODO: some temp code
      const rootNode = new SfdxTestGroupNode('LwcTests', null, 'lwc');
      const testSuiteNode = new SfdxTestGroupNode(
        'c-event-simple',
        null,
        'lwc'
      );
      rootNode.children = [
        new SfdxTestNode('lwc test 1', null),
        new SfdxTestNode('lwc test 2', null),
        new SfdxTestNode('lwc test 3', null),
        testSuiteNode
      ];
      return [rootNode];
      // if (this.rootNode && this.rootNode.children.length > 0) {
      //   return this.rootNode.children;
      // }
      // return [];
      */
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
