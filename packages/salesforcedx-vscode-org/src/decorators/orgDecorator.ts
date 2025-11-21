/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { ORG_OPEN_COMMAND } from '../constants';
import { nls } from '../messages';

/** Gets the core extension API to access WorkspaceContext */
const getCoreApi = (): any => {
  const coreExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-core');
  return coreExtension?.exports;
};

export class OrgDecorator implements vscode.Disposable {
  private statusBarItem: StatusBarItem | undefined;

  constructor() {
    // Listen for org changes
    const WorkspaceContext = getCoreApi()?.WorkspaceContext;
    if (WorkspaceContext) {
      WorkspaceContext.getInstance().onOrgChange(() => {
        void this.displayBrowserIcon();
      });
      // Initialize the status bar item
      void this.displayBrowserIcon();
    }
  }

  private async displayBrowserIcon(): Promise<void> {
    const targetOrgOrAlias = await ConfigUtil.getTargetOrgOrAlias();
    if (targetOrgOrAlias) {
      if (!this.statusBarItem) {
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 49);
        this.statusBarItem.tooltip = nls.localize('status_bar_open_org_tooltip');
        this.statusBarItem.command = ORG_OPEN_COMMAND;
        this.statusBarItem.show();
      }
      this.statusBarItem.text = '$(browser)';
    } else if (!targetOrgOrAlias && this.statusBarItem) {
      this.statusBarItem.dispose();
      this.statusBarItem = undefined;
    }
  }

  public dispose(): void {
    this.statusBarItem?.dispose();
    this.statusBarItem = undefined;
  }
}
