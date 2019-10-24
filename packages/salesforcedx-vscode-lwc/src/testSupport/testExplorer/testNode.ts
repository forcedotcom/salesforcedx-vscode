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

export abstract class TestNode extends vscode.TreeItem {
  public description: string;
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
    this.command = {
      command: 'sfdx.force.lightning.lwc.test.navigateToTest',
      title: nls.localize('force_lightning_lwc_test_navigate_to_test'),
      arguments: [this]
    };
  }
}

export class SfdxTestNode extends TestNode {
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

export class SfdxTestGroupNode extends TestNode {
  public contextValue?: string;
  public testExecutionInfo?: TestExecutionInfo;
  constructor(
    label: string,
    testExecutionInfo: TestExecutionInfo,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.Collapsed
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

export function sortTestNodeByLabel(node1: TestNode, node2: TestNode) {
  const label1 = node1!.label;
  const label2 = node2!.label;
  if (!label1) {
    return -1;
  }
  if (!label2) {
    return 1;
  }
  return label1.localeCompare(label2);
}
