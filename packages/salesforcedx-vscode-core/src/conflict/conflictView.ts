/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { ExtensionContext, TreeView, window } from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { salesforceCoreSettings } from '../settings';
import { telemetryService } from '../telemetry';
import { ConflictFile, ConflictNode } from './conflictNode';
import { ConflictOutlineProvider } from './conflictOutlineProvider';
import { DirectoryDiffResults } from './directoryDiffer';

export class ConflictView {
  private static VIEW_ID = 'conflicts';
  private static instance: ConflictView;

  private _treeView?: TreeView<ConflictNode>;
  private _dataProvider?: ConflictOutlineProvider;
  private diffsOnly: boolean = false;

  private constructor() {}

  public static getInstance(): ConflictView {
    if (!this.instance) {
      this.instance = new ConflictView();
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

  public visualizeDifferences(
    title: string,
    remoteLabel: string,
    reveal: boolean,
    diffResults?: DirectoryDiffResults,
    diffsOnly: boolean = false
  ) {
    this.diffsOnly = diffsOnly;
    const conflicts = diffResults ? this.createConflictEntries(diffResults, remoteLabel) : [];
    const emptyLabel = diffsOnly
      ? nls.localize('conflict_detect_no_differences')
      : nls.localize('conflict_detect_no_conflicts');
    this.dataProvider.reset(title, conflicts, emptyLabel);
    this.updateEnablementMessage();

    if (reveal) {
      this.revealConflictNode();
    }
    this.dataProvider.onViewChange();
  }

  public createConflictEntries(diffResults: DirectoryDiffResults, remoteLabel: string): ConflictFile[] {
    const conflicts: ConflictFile[] = [];

    diffResults.different.forEach(p => {
      conflicts.push({
        remoteLabel,
        localRelPath: p.localRelPath,
        remoteRelPath: p.remoteRelPath,
        fileName: path.basename(p.localRelPath),
        localPath: diffResults.localRoot,
        remotePath: diffResults.remoteRoot,
        localLastModifiedDate: p.localLastModifiedDate,
        remoteLastModifiedDate: p.remoteLastModifiedDate
      } as ConflictFile);
    });

    return conflicts;
  }

  public async init(extensionContext: ExtensionContext) {
    this._dataProvider = new ConflictOutlineProvider();
    this._treeView = window.createTreeView(ConflictView.VIEW_ID, {
      treeDataProvider: this._dataProvider
    });

    this._treeView.onDidChangeVisibility(async () => {
      if (this.treeView.visible) {
        this.updateEnablementMessage();
        await this.dataProvider.onViewChange();
      }
    });

    extensionContext.subscriptions.push(this._treeView);
  }

  private updateEnablementMessage() {
    this.treeView.message =
      salesforceCoreSettings.getConflictDetectionEnabled() || this.diffsOnly
        ? undefined
        : nls.localize('conflict_detect_not_enabled');
  }

  private revealConflictNode() {
    const node = this.dataProvider.getRevealNode();
    if (node) {
      Promise.resolve(this.treeView.reveal(node, { expand: true })).catch(e => {
        const errorMessage = e.toString();
        channelService.appendLine('Error during reveal: ' + errorMessage);
        telemetryService.sendException('ConflictDetectionException', errorMessage);
      });
    }
  }

  private initError() {
    const message = nls.localize('conflict_detect_view_init');
    telemetryService.sendException('ConflictDetectionException', message);
    return new Error(message);
  }
}
