/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionContext, TreeView, window } from 'vscode';
import { WorkspaceContext } from '../context';
import { nls } from '../messages';
import { BrowserNode, MetadataOutlineProvider } from '../orgBrowser';
import { telemetryService } from '../telemetry';
import { OrgAuthInfo } from '../util';

export class OrgBrowser {
  private static VIEW_ID = 'metadata';
  private static instance: OrgBrowser;

  private _treeView?: TreeView<BrowserNode>;
  private _dataProvider?: MetadataOutlineProvider;

  private constructor() {}

  public static getInstance(): OrgBrowser {
    if (!this.instance) {
      this.instance = new OrgBrowser();
    }
    return this.instance;
  }

  get treeView() {
    if (this._treeView) {
      return this._treeView;
    }
    throw this.initError();
  }

  get dataProvider() {
    if (this._dataProvider) {
      return this._dataProvider;
    }
    throw this.initError();
  }

  public async init(extensionContext: ExtensionContext) {
    const username = await OrgAuthInfo.getTargetOrgOrAlias(false);
    this._dataProvider = new MetadataOutlineProvider(username);
    this._treeView = window.createTreeView(OrgBrowser.VIEW_ID, {
      treeDataProvider: this._dataProvider,
      canSelectMany: true
    });
    this._treeView.onDidChangeVisibility(async () => {
      if (this.treeView.visible) {
        await this.dataProvider.onViewChange();
      }
    });

    // Listen to org changes and refresh the data provider when org switches
    WorkspaceContext.getInstance().onOrgChange(async () => {
      await this.dataProvider.onViewChange();
    });

    extensionContext.subscriptions.push(this._treeView);
  }

  public async refreshAndExpand(node: BrowserNode) {
    await this.dataProvider.refresh(node);
    await this.treeView.reveal(node, { expand: true });
  }

  private initError() {
    const message = nls.localize('error_org_browser_init');
    telemetryService.sendException('OrgBrowserException', message);
    return new Error(message);
  }
}
