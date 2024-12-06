/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestResult } from '@salesforce/apex-node-bundle';
import { readFileSync } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { APEX_GROUP_RANGE, APEX_TESTS, FAIL_RESULT, PASS_RESULT, SKIP_RESULT } from '../constants';
import { getApexTests, languageClientUtils } from '../languageUtils';
import { nls } from '../messages';
import { IconsEnum, iconHelpers } from './icons';
import { ApexTestMethod } from './lspConverter';

const safeLocalize = (val: string) => nls.localize(val);

// Message
const LOADING_MESSAGE = safeLocalize('test_view_loading_message');
const NO_TESTS_MESSAGE = safeLocalize('test_view_no_tests_message');
const NO_TESTS_DESCRIPTION = safeLocalize('test_view_no_tests_description');

const TEST_RUN_ID_FILE = 'test-run-id.txt';
const TEST_RESULT_JSON_FILE = 'test-result.json';
const BASE_ID = 'sf.test.view';

export class ApexTestOutlineProvider implements vscode.TreeDataProvider<TestNode> {
  private onDidChangeTestData: vscode.EventEmitter<TestNode | undefined> = new vscode.EventEmitter<
    TestNode | undefined
  >();
  public onDidChangeTreeData = this.onDidChangeTestData.event;

  private apexTestMap: Map<string, TestNode> = new Map<string, TestNode>();
  private rootNode: TestNode | null;
  public testStrings: Set<string> = new Set<string>();
  private apexTestInfo: ApexTestMethod[] | null;
  private testIndex: Map<string, string> = new Map<string, string>();

  constructor(apexTestInfo: ApexTestMethod[] | null) {
    this.rootNode = null;
    this.apexTestInfo = apexTestInfo;
    this.createTestIndex();
    this.getAllApexTests();
  }

  public getHead(): TestNode {
    if (this.rootNode === null) {
      return this.getAllApexTests();
    } else {
      return this.rootNode;
    }
  }

  public getId(): string {
    return BASE_ID;
  }

  public getChildren(element: TestNode): TestNode[] {
    if (element) {
      return element.children;
    } else {
      if (this.rootNode && this.rootNode.children.length > 0) {
        return this.rootNode.children;
      } else {
        let message = NO_TESTS_MESSAGE;
        let description = NO_TESTS_DESCRIPTION;
        const languageClientStatus = languageClientUtils.getStatus();
        if (!languageClientStatus.isReady()) {
          if (languageClientStatus.failedToInitialize()) {
            void vscode.window.showInformationMessage(languageClientStatus.getStatusMessage());
            return new Array<ApexTestNode>();
          }
          message = LOADING_MESSAGE;
          description = '';
        }
        const emptyArray = new Array<ApexTestNode>();
        const testToDisplay = new ApexTestNode(message, null);
        testToDisplay.description = description;
        emptyArray.push(testToDisplay);
        return emptyArray;
      }
    }
  }

  public getTreeItem(element: TestNode): vscode.TreeItem {
    if (element) {
      return element;
    } else {
      this.getAllApexTests();
      let message = NO_TESTS_MESSAGE;
      let description = NO_TESTS_DESCRIPTION;
      if (!languageClientUtils.getStatus().isReady()) {
        message = LOADING_MESSAGE;
        description = '';
      }
      if (!(this.rootNode && this.rootNode.children.length > 0)) {
        this.rootNode = new ApexTestNode(message, null);
        const testToDisplay = new ApexTestNode(message, null);
        testToDisplay.description = description;
        this.rootNode.children.push(testToDisplay);
      }
      return this.rootNode;
    }
  }

  public async refresh(): Promise<void> {
    this.rootNode = null; // Reset tests
    this.apexTestMap.clear();
    this.testStrings.clear();
    this.apexTestInfo = await getApexTests();
    this.createTestIndex();
    this.getAllApexTests();
    this.onDidChangeTestData.fire(undefined);
  }

  public async collapseAll(): Promise<void> {
    return vscode.commands.executeCommand(`workbench.actions.treeView.${this.getId()}.collapseAll`);
  }

  public async onResultFileCreate(apexTestPath: string, testResultFile: string) {
    const testRunIdFile = path.join(apexTestPath, TEST_RUN_ID_FILE);
    const testRunId = readFileSync(testRunIdFile).toString();
    const testResultFilePath = path.join(
      apexTestPath,
      !testRunId ? TEST_RESULT_JSON_FILE : `test-result-${testRunId}.json`
    );

    if (testResultFile === testResultFilePath) {
      await this.refresh();
      this.updateTestResults(testResultFile);
    }
  }

  public getTestClassName(uri: vscode.Uri): string | undefined {
    return this.testIndex.get(uri.toString());
  }

  private createTestIndex(): void {
    this.testIndex.clear();
    if (this.apexTestInfo) {
      this.apexTestInfo.forEach(testMethod => {
        this.testIndex.set(testMethod.location.uri.toString(), testMethod.definingType);
      });
    }
  }

  private getAllApexTests(): TestNode {
    if (this.rootNode === null) {
      // Starting Out
      this.rootNode = new ApexTestGroupNode(APEX_TESTS, null);
    }
    this.rootNode.children = new Array<TestNode>();
    if (this.apexTestInfo) {
      this.apexTestInfo.forEach(test => {
        let apexGroup = this.apexTestMap.get(test.definingType) as ApexTestGroupNode;
        if (!apexGroup) {
          const groupLocation = new vscode.Location(test.location.uri, APEX_GROUP_RANGE);
          apexGroup = new ApexTestGroupNode(test.definingType, groupLocation);
          this.apexTestMap.set(test.definingType, apexGroup);
        }
        const apexTest = new ApexTestNode(test.methodName, test.location);

        apexTest.name = apexGroup.label + '.' + apexTest.label;
        this.apexTestMap.set(apexTest.name, apexTest);
        apexGroup.children.push(apexTest);
        if (this.rootNode && !(this.rootNode.children.indexOf(apexGroup) >= 0)) {
          this.rootNode.children.push(apexGroup);
        }
        this.testStrings.add(apexGroup.name);
      });
      // Sorting independently so we don't lose the order of the test methods per test class.
      this.rootNode.children.sort((a, b) => a.name.localeCompare(b.name));
    }
    return this.rootNode;
  }

  public updateTestResults(testResultFilePath: string) {
    const testResultOutput = readFileSync(testResultFilePath, 'utf8');
    const testResultContent = JSON.parse(testResultOutput) as TestResult;

    this.updateTestsFromLibrary(testResultContent);
    this.onDidChangeTestData.fire(undefined);
  }

  private updateTestsFromLibrary(testResult: TestResult) {
    const groups = new Set<ApexTestGroupNode>();
    for (const test of testResult.tests) {
      const { name, namespacePrefix } = test.apexClass;
      const apexGroupName = namespacePrefix ? `${namespacePrefix}.${name}` : name;

      const apexGroupNode = this.apexTestMap.get(apexGroupName) as ApexTestGroupNode;

      if (apexGroupNode) {
        groups.add(apexGroupNode);
      }

      const testFullName = namespacePrefix
        ? `${namespacePrefix}.${name}.${test.methodName}`
        : `${name}.${test.methodName}`;
      const apexTestNode = this.apexTestMap.get(testFullName) as ApexTestNode;
      if (apexTestNode) {
        apexTestNode.outcome = test.outcome;
        apexTestNode.updateOutcome();
        if (test.outcome.toString() === FAIL_RESULT) {
          apexTestNode.errorMessage = test.message || '';
          apexTestNode.stackTrace = test.stackTrace || '';
          apexTestNode.description = `${apexTestNode.stackTrace}\n${apexTestNode.errorMessage}`;
        }
      }
    }
    groups.forEach(group => {
      group.updatePassFailLabel();
    });
  }
}

export abstract class TestNode extends vscode.TreeItem {
  public children = new Array<TestNode>();
  public description: string;
  public name: string;
  public location: vscode.Location | null;

  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, location: vscode.Location | null) {
    super(label, collapsibleState);
    this.location = location;
    this.description = label;
    this.name = label;
    this.command = {
      command: `${BASE_ID}.showError`,
      title: safeLocalize('test_view_show_error_title'),
      arguments: [this]
    };
  }

  public iconPath = {
    light: iconHelpers.getIconPath(IconsEnum.LIGHT_BLUE_BUTTON),
    dark: iconHelpers.getIconPath(IconsEnum.DARK_BLUE_BUTTON)
  };

  // TODO: create a ticket to address this particular issue.

  // @ts-ignore
  get tooltip(): string {
    return this.description;
  }

  public updateOutcome(outcome: string) {
    if (outcome === PASS_RESULT) {
      // Passed Test
      this.iconPath = {
        light: iconHelpers.getIconPath(IconsEnum.LIGHT_GREEN_BUTTON),
        dark: iconHelpers.getIconPath(IconsEnum.DARK_GREEN_BUTTON)
      };
    } else if (outcome === FAIL_RESULT) {
      // Failed test
      this.iconPath = {
        light: iconHelpers.getIconPath(IconsEnum.LIGHT_RED_BUTTON),
        dark: iconHelpers.getIconPath(IconsEnum.DARK_RED_BUTTON)
      };
    } else if (outcome === SKIP_RESULT) {
      // Skipped test
      this.iconPath = {
        light: iconHelpers.getIconPath(IconsEnum.LIGHT_ORANGE_BUTTON),
        dark: iconHelpers.getIconPath(IconsEnum.DARK_ORANGE_BUTTON)
      };
    }

    const nodeType = this.contextValue.split('_')[0];
    this.contextValue = `${nodeType}_${outcome}`;
  }

  public abstract contextValue: string;
}

export class ApexTestGroupNode extends TestNode {
  public passing: number = 0;
  public failing: number = 0;
  public skipping: number = 0;

  constructor(label: string, location: vscode.Location | null) {
    super(label, vscode.TreeItemCollapsibleState.Expanded, location);
  }

  public contextValue = 'apexTestGroup';

  public updatePassFailLabel() {
    this.passing = 0;
    this.failing = 0;
    this.skipping = 0;
    this.children.forEach(child => {
      if (child instanceof ApexTestNode) {
        this.passing += child.outcome === PASS_RESULT ? 1 : 0;
        this.failing += child.outcome === FAIL_RESULT ? 1 : 0;
        this.skipping += child.outcome === SKIP_RESULT ? 1 : 0;
      }
    });

    if (this.passing + this.failing + this.skipping === this.children.length) {
      if (this.failing !== 0) {
        this.updateOutcome(FAIL_RESULT);
      } else {
        this.updateOutcome(PASS_RESULT);
      }
    }
  }

  public updateOutcome(outcome: string) {
    super.updateOutcome(outcome);
    if (outcome === PASS_RESULT) {
      this.children.forEach(child => {
        // Update all the children as well
        child.updateOutcome(outcome);
      });
    }
  }
}

export class ApexTestNode extends TestNode {
  public errorMessage: string = '';
  public stackTrace: string = '';
  public outcome = 'Not Run';

  constructor(label: string, location: vscode.Location | null) {
    super(label, vscode.TreeItemCollapsibleState.None, location);
  }

  public updateOutcome() {
    super.updateOutcome(this.outcome);
    if (this.outcome === PASS_RESULT) {
      this.errorMessage = '';
    }
  }

  public contextValue = 'apexTest';
}

let testOutlineProviderInst: ApexTestOutlineProvider;

export const getTestOutlineProvider = () => {
  if (!testOutlineProviderInst) {
    testOutlineProviderInst = new ApexTestOutlineProvider(null);
  }
  return testOutlineProviderInst;
};
