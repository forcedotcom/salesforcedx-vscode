/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexTestResultOutcome, TestResult } from '@salesforce/apex-node';
import { readFile } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { APEX_GROUP_RANGE, APEX_TESTS } from '../constants';
import { getApexTests, languageClientManager } from '../languageUtils';
import { nls } from '../messages';
import { getNamespaceInfo, rewriteClassArgument } from '../namespaceLensRewriter';
import { iconHelpers } from './icons';
import { ApexTestMethod } from './lspConverter';

type TestOutcome = 'Pass' | 'Fail' | 'Skip' | 'Not Run';

/**
 * the way this file is written, I'm not sure how to tell between the descendants of TestNode
 * leaving the assertions as is
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

// Message
const LOADING_MESSAGE = nls.localize('test_view_loading_message');
const NO_TESTS_MESSAGE = nls.localize('test_view_no_tests_message');
const NO_TESTS_DESCRIPTION = nls.localize('test_view_no_tests_description');

const TEST_RUN_ID_FILE = 'test-run-id.txt';
const TEST_RESULT_JSON_FILE = 'test-result.json';
export const TEST_OUTLINE_PROVIDER_BASE_ID = 'sf.test.view';

export class ApexTestOutlineProvider implements vscode.TreeDataProvider<TestNode> {
  private onDidChangeTestData: vscode.EventEmitter<TestNode | undefined> = new vscode.EventEmitter<
    TestNode | undefined
  >();
  public onDidChangeTreeData = this.onDidChangeTestData.event;

  private apexTestMap: Map<string, TestNode> = new Map<string, TestNode>();
  private rootNode?: TestNode;
  private apexTestInfo?: ApexTestMethod[];

  public getChildren(element: TestNode): TestNode[] {
    if (element) {
      return element.children;
    }
    if (this.rootNode?.children.length) {
      return this.rootNode.children;
    }
    const languageClientStatus = languageClientManager.getStatus();

    if (!languageClientStatus.failedToInitialize()) {
      void vscode.window.showInformationMessage(languageClientStatus.getStatusMessage());
      return new Array<ApexTestNode>();
    }
    const ready = languageClientStatus.isReady();

    const testToDisplay = new ApexTestNode(ready ? NO_TESTS_MESSAGE : LOADING_MESSAGE, null);
    testToDisplay.description = ready ? NO_TESTS_DESCRIPTION : '';
    return [testToDisplay];
  }

  public getTreeItem(element: TestNode): vscode.TreeItem {
    if (element) {
      return element;
    }
    this.getAllApexTests();
    if (!(this.rootNode && this.rootNode.children.length > 0)) {
      const ready = languageClientManager.getStatus().isReady();
      const message = ready ? NO_TESTS_MESSAGE : LOADING_MESSAGE;
      this.rootNode = new ApexTestNode(message, null);
      const testToDisplay = new ApexTestNode(message, null);
      testToDisplay.description = ready ? NO_TESTS_DESCRIPTION : '';
      this.rootNode.children.push(testToDisplay);
    }
    return this.rootNode;
  }

  public async refresh(): Promise<void> {
    this.rootNode = undefined; // Reset tests
    this.apexTestMap.clear();
    const { nsFromOrg, nsFromProject } = await getNamespaceInfo();

    this.apexTestInfo = (await getApexTests())?.map(testMethod => ({
      ...testMethod,
      definingType: rewriteClassArgument(nsFromOrg)(nsFromProject)(testMethod.definingType)
    }));
    this.getAllApexTests();
    this.onDidChangeTestData.fire(undefined);
  }

  public async collapseAll(): Promise<void> {
    return vscode.commands.executeCommand(`workbench.actions.treeView.${TEST_OUTLINE_PROVIDER_BASE_ID}.collapseAll`);
  }

  public async onResultFileCreate(apexTestPath: string, testResultFile: string) {
    const testRunId = await readFile(path.join(apexTestPath, TEST_RUN_ID_FILE));
    const testResultFilePath = path.join(
      apexTestPath,
      testRunId ? `test-result-${testRunId}.json` : TEST_RESULT_JSON_FILE
    );

    if (testResultFile === testResultFilePath) {
      await this.refresh();
      await this.updateTestResults(testResultFile);
    }
  }

  public getTestClassName(uri: URI): string | undefined {
    return this.apexTestInfo?.find(test => test.location.uri.toString() === uri.toString())?.definingType;
  }

  private getAllApexTests(): TestNode {
    this.rootNode ??= new ApexTestGroupNode(APEX_TESTS, null);
    this.rootNode.children = new Array<TestNode>();
    if (this.apexTestInfo) {
      this.apexTestInfo.forEach(test => {
        const apexGroup =
          this.apexTestMap.get(test.definingType) ??
          new ApexTestGroupNode(test.definingType, new vscode.Location(test.location.uri, APEX_GROUP_RANGE));
        this.apexTestMap.set(test.definingType, apexGroup);
        const apexTest = new ApexTestNode(test.methodName, test.location);

        apexTest.name = `${apexGroup.label}.${apexTest.label}`;
        this.apexTestMap.set(apexTest.name, apexTest);
        apexGroup.children.push(apexTest);
        if (this.rootNode && !this.rootNode.children.includes(apexGroup)) {
          this.rootNode.children.push(apexGroup);
        }
      });
      // Sorting independently so we don't lose the order of the test methods per test class.
      this.rootNode.children.sort((a, b) => a.name.localeCompare(b.name));
    }
    return this.rootNode;
  }

  public getTestStrings(): Set<string> {
    return new Set(this.apexTestInfo?.map(info => info.definingType));
  }

  public async updateTestResults(testResultFilePath: string) {
    const testResultOutput = await readFile(testResultFilePath);
    const testResultContent = JSON.parse(testResultOutput) as TestResult;

    this.updateTestsFromLibrary(testResultContent);
    this.onDidChangeTestData.fire(undefined);
  }

  private updateTestsFromLibrary(testResult: TestResult) {
    const groups = new Set<ApexTestGroupNode>();
    for (const test of testResult.tests) {
      const { name, namespacePrefix } = test.apexClass;
      const apexGroupName = namespacePrefix ? `${namespacePrefix}.${name}` : name;

      const apexGroupNode = this.apexTestMap.get(apexGroupName);

      if (apexGroupNode instanceof ApexTestGroupNode) {
        groups.add(apexGroupNode);
      }

      const testFullName = namespacePrefix
        ? `${namespacePrefix}.${name}.${test.methodName}`
        : `${name}.${test.methodName}`;
      const apexTestNode = this.apexTestMap.get(testFullName);
      if (apexTestNode instanceof ApexTestNode) {
        apexTestNode.updateOutcome(getOutcomeFromApexTestResultOutcome(test.outcome));
        if (apexTestNode.outcome === 'Fail') {
          apexTestNode.errorMessage = test.message ?? '';
          apexTestNode.stackTrace = test.stackTrace ?? '';
          apexTestNode.description = `${apexTestNode.stackTrace}\n${apexTestNode.errorMessage}`;
        }
      }
    }
    Array.from(groups).map(g => g.updatePassFailLabel());
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
    this.tooltip = label;
    this.command = {
      command: `${TEST_OUTLINE_PROVIDER_BASE_ID}.showError`,
      title: nls.localize('test_view_show_error_title'),
      arguments: [this]
    };
    this.iconPath = getOutcomeIconPath('Not Run');
  }

  public updateOutcome(outcome: TestOutcome) {
    this.iconPath = getOutcomeIconPath(outcome);
    const [nodeType] = this.contextValue.split('_');
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
        this.passing += child.outcome === 'Pass' ? 1 : 0;
        this.failing += child.outcome === 'Fail' ? 1 : 0;
        this.skipping += child.outcome === 'Skip' ? 1 : 0;
      }
    });

    if (this.passing + this.failing + this.skipping === this.children.length) {
      this.updateOutcome(this.failing !== 0 ? 'Fail' : 'Pass');
    }
  }

  public updateOutcome(outcome: TestOutcome) {
    super.updateOutcome(outcome);
    if (outcome === 'Pass') {
      // Update all the children as well
      this.children.map(child => child.updateOutcome(outcome));
    }
  }
}

export class ApexTestNode extends TestNode {
  public errorMessage: string = '';
  public stackTrace: string = '';
  public readonly outcome: TestOutcome = 'Not Run';

  constructor(label: string, location: vscode.Location | null) {
    super(label, vscode.TreeItemCollapsibleState.None, location);
  }

  public updateOutcome(outcome: TestOutcome) {
    super.updateOutcome(outcome);
    if (outcome === 'Pass') {
      this.errorMessage = '';
    }
  }

  public contextValue = 'apexTest';
}

let testOutlineProviderInst: ApexTestOutlineProvider;

export const getTestOutlineProvider = () => {
  testOutlineProviderInst ??= new ApexTestOutlineProvider();
  return testOutlineProviderInst;
};

/** typesafe conversion from the apex library's enum to the extension's value  */
const getOutcomeFromApexTestResultOutcome = (outcome: ApexTestResultOutcome): TestOutcome => {
  switch (outcome) {
    case ApexTestResultOutcome.Pass:
      return 'Pass';
    case ApexTestResultOutcome.Fail:
    case ApexTestResultOutcome.CompileFail:
      return 'Fail';
    case ApexTestResultOutcome.Skip:
      return 'Skip';
    default:
      return 'Not Run';
  }
};

const getOutcomeIconPath = (outcome: TestOutcome) => {
  switch (outcome) {
    case 'Pass':
      return {
        light: iconHelpers.getIconPath('LIGHT_GREEN_BUTTON'),
        dark: iconHelpers.getIconPath('DARK_GREEN_BUTTON')
      };
    case 'Fail':
      return {
        light: iconHelpers.getIconPath('LIGHT_RED_BUTTON'),
        dark: iconHelpers.getIconPath('DARK_RED_BUTTON')
      };
    case 'Skip':
      return {
        light: iconHelpers.getIconPath('LIGHT_ORANGE_BUTTON'),
        dark: iconHelpers.getIconPath('DARK_ORANGE_BUTTON')
      };
    case 'Not Run':
      return {
        light: iconHelpers.getIconPath('LIGHT_BLUE_BUTTON'),
        dark: iconHelpers.getIconPath('DARK_BLUE_BUTTON')
      };
  }
};
