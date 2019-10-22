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
