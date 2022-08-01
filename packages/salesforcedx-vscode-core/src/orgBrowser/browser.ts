/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigAggregator, OrgConfigProperties } from '@salesforce/core';
import { ExtensionContext, TreeView, window } from 'vscode';
import { nls } from '../messages';
import { BrowserNode, MetadataOutlineProvider } from '../orgBrowser';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath, OrgAuthInfo } from '../util';

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

  private async getConfigAggregator(): Promise<ConfigAggregator> {
    const origCurrentWorkingDirectory = process.cwd();
    const rootWorkspacePath = getRootWorkspacePath();
    // Change the current working directory to the project path,
    // so that ConfigAggregator reads the local project values
    process.chdir(rootWorkspacePath);
    const configAggregator = await ConfigAggregator.create();
    // Change the current working directory back to what it was
    // before returning
    process.chdir(origCurrentWorkingDirectory);
    return configAggregator;
  }

  public async init(extensionContext: ExtensionContext) {
    const configAggregator = await this.getConfigAggregator();
    const username: string | undefined = configAggregator.getPropertyValue(
      OrgConfigProperties.TARGET_ORG
    );
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
