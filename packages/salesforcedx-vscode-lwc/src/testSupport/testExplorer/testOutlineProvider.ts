/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { TestExecutionInfo, TestType } from '../types';
import { DARK_BLUE_BUTTON, LIGHT_BLUE_BUTTON } from './iconPaths';

export abstract class TestNode extends vscode.TreeItem {
  public children = new Array<TestNode>();
  public description: string;
  public name: string;
  public location: vscode.Location | null;
  public iconPath = {
    light: LIGHT_BLUE_BUTTON,
    dark: DARK_BLUE_BUTTON
  };

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    location: vscode.Location | null
  ) {
    super(label, collapsibleState);
    this.location = location;
    this.description = label;
    this.name = label;
    this.command = {
      command: 'sfdx.force.test.view.showError',
      title: nls.localize('force_test_view_show_error_title'),
      arguments: [this]
    };
  }
}

export class SfdxTestNode extends TestNode {
  public errorMessage: string = '';
  public stackTrace: string = '';
  public outcome = 'Not Run';
  public testExecutionInfo?: TestExecutionInfo;

  constructor(
    label: string,
    location: vscode.Location | null,
    testExecutionInfo?: TestExecutionInfo
  ) {
    super(label, vscode.TreeItemCollapsibleState.None, location);
    this.testExecutionInfo = testExecutionInfo;
    if (testExecutionInfo) {
      const { testType } = testExecutionInfo;
      this.contextValue = `${testType}Test`;
    }
  }

  // public updateOutcome() {
  //   super.updateOutcome(this.outcome);
  //   if (this.outcome === 'Pass') {
  //     this.errorMessage = '';
  //   }
  // }
}

export class SfdxTestGroupNode extends TestNode {
  public contextValue: string;
  constructor(
    label: string,
    location: vscode.Location | null,
    testType: TestType,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Expanded
  ) {
    super(label, collapsibleState, location);
    this.contextValue = `${testType}TestGroup`;
  }
}

import * as path from 'path';
import {
  findLwcJestTestFiles,
  findTestInfoFromLwcJestTestFile
} from './testIndexer';

export class SfdxTestOutlineProvider
  implements vscode.TreeDataProvider<TestNode> {
  private onDidChangeTestData: vscode.EventEmitter<
    TestNode | undefined
  > = new vscode.EventEmitter<TestNode | undefined>();
  public onDidChangeTreeData = this.onDidChangeTestData.event;
  private rootNode: TestNode | null;

  constructor() {
    this.rootNode = null;
    this.getAllTests();
  }

  public getTreeItem(element: TestNode): vscode.TreeItem {
    if (element) {
      return element;
    } else {
      //  TODO - no tests
      if (!(this.rootNode && this.rootNode.children.length > 0)) {
        this.rootNode = new SfdxTestNode('no tests here', null);
        const childNode = new SfdxTestNode('no tests here', null);
        this.rootNode.children.push(childNode);
      }
      return this.rootNode;
    }
  }

  public async getChildren(element: TestNode): Promise<TestNode[]> {
    if (element) {
      if (element instanceof SfdxTestGroupNode) {
        if (element.location) {
          const testInfo = await findTestInfoFromLwcJestTestFile(
            element.location.uri
          );
          if (testInfo) {
            return testInfo.map(testCaseInfo => {
              const { testName, testUri, testLocation } = testCaseInfo;
              return new SfdxTestNode(
                testName,
                testLocation || null,
                testCaseInfo
              );
            });
          }
        }
      }
      return [];
      // return element.children; // TODO - cache here
    } else {
      try {
        const lwcJestTestFiles = await findLwcJestTestFiles();
        return lwcJestTestFiles
          .map(lwcJestTestFile => {
            const testLocation = new vscode.Location(
              lwcJestTestFile,
              new vscode.Position(0, 0)
            );
            const ext = '.test.js';
            const testGroupLabel = path.basename(lwcJestTestFile.fsPath, ext);
            const testGroupNode = new SfdxTestGroupNode(
              testGroupLabel,
              testLocation,
              TestType.LWC,
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
            if (label1 < label2) {
              return -1;
            } else if (label1 > label2) {
              return 1;
            } else {
              return 0;
            }
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

  protected getAllTests(): TestNode {
    if (this.rootNode == null) {
      // Starting Out
      this.rootNode = new SfdxTestGroupNode('LwcTests', null, TestType.LWC);
    }
    this.rootNode.children = new Array<TestNode>();
    return this.rootNode;
  }

  public async refresh(): Promise<void> {}
}

export function registerLwcTestExplorerTreeView(
  context: vscode.ExtensionContext
) {
  const testOutlineProvider = new SfdxTestOutlineProvider();
  const testProvider = vscode.window.registerTreeDataProvider(
    'sfdx.force.lightning.lwc.test.view',
    testOutlineProvider
  );
  context.subscriptions.push(testProvider);
}
