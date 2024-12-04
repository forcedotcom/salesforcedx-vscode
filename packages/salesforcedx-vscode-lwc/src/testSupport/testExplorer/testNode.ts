/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { TestExecutionInfo } from '../types';
import { getIconPath } from './iconPaths';

/**
 * Base class for test node in the test explorer.
 * It's initialized with the command to navigate to the test
 * upon clicking.
 */
export abstract class TestNode extends vscode.TreeItem {
  public description: string;
  public location?: vscode.Location;
  public iconPath = getIconPath();

  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, location?: vscode.Location) {
    super(label, collapsibleState);
    this.location = location;
    this.description = label;
    this.command = {
      command: 'sf.lightning.lwc.test.navigateToTest',
      title: nls.localize('lightning_lwc_test_navigate_to_test'),
      arguments: [this]
    };
  }
}

/**
 * Test Node representing an individual test case.
 */
export class SfTestNode extends TestNode {
  public contextValue?: string;
  public testExecutionInfo?: TestExecutionInfo;

  constructor(label: string, testExecutionInfo?: TestExecutionInfo) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.testExecutionInfo = testExecutionInfo;
    if (testExecutionInfo) {
      const { testType, testResult } = testExecutionInfo;
      this.contextValue = `${testType}Test`;
      this.iconPath = getIconPath(testResult);
      if ('testLocation' in testExecutionInfo) {
        this.location = testExecutionInfo.testLocation;
      }
    }
  }
}

/**
 * Test Group Node representing a test file.
 * By default it's collpased
 */
export class SfTestGroupNode extends TestNode {
  public contextValue?: string;
  public testExecutionInfo?: TestExecutionInfo;
  constructor(
    label: string,
    testExecutionInfo: TestExecutionInfo,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed
  ) {
    super(label, collapsibleState);
    this.testExecutionInfo = testExecutionInfo;
    if (testExecutionInfo) {
      const { testType, testResult } = testExecutionInfo;
      this.contextValue = `${testType}TestGroup`;
      this.iconPath = getIconPath(testResult);
      if ('testLocation' in testExecutionInfo) {
        this.location = testExecutionInfo.testLocation;
      }
    }
  }
}

/**
 * Sort test node alphabetically
 * @param node1 first test node
 * @param node2 second test node
 */
export const sortTestNodeByLabel = (node1: TestNode, node2: TestNode) => {
  const label1 = node1.label;
  const label2 = node2.label;
  if (!label1) {
    return -1;
  }
  if (!label2) {
    return 1;
  }
  const label1String = String(label1);
  const label2String = String(label2);
  return label1String.localeCompare(label2String);
};
