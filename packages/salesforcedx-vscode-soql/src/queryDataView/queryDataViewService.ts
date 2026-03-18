/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult } from '../types';
import type { JsonMap } from '@salesforce/ts-types';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { getDocumentName } from '../commonUtils';
import {
  DATA_VIEW_ICONS_PATH,
  DATA_VIEW_PATH,
  IMAGES_DIR_NAME,
  QUERY_DATA_VIEW_PANEL_TITLE,
  QUERY_DATA_VIEW_SCRIPT_FILENAME,
  QUERY_DATA_VIEW_STYLE_FILENAME,
  QUERY_DATA_VIEW_TYPE,
  SAVE_ICON_FILENAME,
  TABULATOR_SCRIPT_FILENAME,
  TABULATOR_STYLE_FILENAME
} from '../constants';
import { nls } from '../messages';
import { channelService } from '../services/channel';
import { getSoqlRuntime } from '../services/extensionProvider';
import { FileFormat, QueryDataFileService as FileService } from './queryDataFileService';
import { extendQueryData } from './queryDataHelper';
import { getHtml } from './queryDataHtml';

type DataViewEvent = {
  type: string;
  format?: FileFormat;
};

export class QueryDataViewService {
  public currentPanel: vscode.WebviewPanel | undefined = undefined;
  public readonly viewType = QUERY_DATA_VIEW_TYPE;
  public static extensionUri: vscode.Uri;
  private queryText: string;

  constructor(
    private subscriptions: vscode.Disposable[],
    private queryData: QueryResult<JsonMap>,
    private document: vscode.TextDocument
  ) {
    this.queryText = document.getText();
  }

  public static register(extensionContext: vscode.ExtensionContext): void {
    QueryDataViewService.extensionUri = extensionContext.extensionUri;
  }

  private updateWebviewWith(queryData: QueryResult<JsonMap>) {
    return Effect.promise(
      () =>
        this.currentPanel?.webview.postMessage({
          type: 'update',
          data: extendQueryData(this.queryText, queryData),
          documentName: getDocumentName(this.document)
        }) ?? Promise.resolve(false)
    ).pipe(
      Effect.asVoid,
      Effect.catchAllCause(cause =>
        Effect.sync(() => {
          const errorType = 'data_view_post_message';
          channelService.appendLine(nls.localize('error_unknown_error', errorType));
          channelService.appendLine(`soql_error_${errorType}: ${String(cause)}`);
        })
      )
    );
  }

  public async createOrShowWebView(): Promise<vscode.Webview> {
    const { extensionUri } = QueryDataViewService;
    this.currentPanel = vscode.window.createWebviewPanel(
      this.viewType,
      QUERY_DATA_VIEW_PANEL_TITLE,
      vscode.ViewColumn.Two,
      {
        localResourceRoots: [
          Utils.joinPath(extensionUri, ...DATA_VIEW_PATH),
          Utils.joinPath(extensionUri, IMAGES_DIR_NAME)
        ],
        enableScripts: true
      }
    );

    this.currentPanel.onDidDispose(
      () => {
        this.currentPanel = undefined;
      },
      null,
      this.subscriptions
    );

    const salesforceCloudUri = Utils.joinPath(extensionUri, IMAGES_DIR_NAME, 'Salesforce_Cloud.png');
    this.currentPanel.iconPath = {
      light: salesforceCloudUri,
      dark: salesforceCloudUri
    };

    this.currentPanel.webview.html = await this.getWebViewContent(this.currentPanel.webview);

    // Stream-based message handling: each message dispatched as a named OTel span
    const panel = this.currentPanel;
    const messageFiber = getSoqlRuntime().runFork(
      Stream.async<DataViewEvent>(emit => {
        const disposable = panel.webview.onDidReceiveMessage((event: DataViewEvent) => {
          void emit.single(event);
        });
        return Effect.sync(() => disposable.dispose());
      }).pipe(
        Stream.mapEffect(
          event =>
            this.handleMessageEffect(event).pipe(
              Effect.catchAllCause(() =>
                Effect.sync(() => channelService.appendLine(nls.localize('error_unknown_error', event.type)))
              )
            ),
          { concurrency: 'unbounded' }
        ),
        Stream.runDrain
      )
    );
    this.subscriptions.push({ dispose: () => Effect.runFork(Fiber.interrupt(messageFiber)) });

    return this.currentPanel.webview;
  }

  private handleMessageEffect = (message: DataViewEvent) => {
    const { type, format } = message;
    switch (type) {
      case 'activate':
        return this.updateWebviewWith(this.queryData).pipe(Effect.withSpan('QueryDataView.activate'));

      case 'save_records':
        return this.handleSaveRecordsEffect(format).pipe(Effect.withSpan('QueryDataView.save_records'));

      default:
        return Effect.sync(() => channelService.appendLine(nls.localize('error_unknown_error', type))).pipe(
          Effect.withSpan('QueryDataView.unknown_message', { attributes: { messageType: type } })
        );
    }
  };

  private handleSaveRecordsEffect = (format: FileFormat) => {
    const self = this;
    return Effect.gen(function* () {
      const fileService = new FileService(self.queryText, self.queryData, format, self.document);
      yield* Effect.promise(() => fileService.save());
    }).pipe(
      Effect.catchAllCause(() =>
        Effect.sync(() => {
          vscode.window.showErrorMessage(nls.localize('error_data_view_save'));
        })
      )
    );
  };

  protected async getWebViewContent(webview: vscode.Webview): Promise<string> {
    const { extensionUri } = QueryDataViewService;
    const baseStyleUri = webview.asWebviewUri(
      Utils.joinPath(extensionUri, ...DATA_VIEW_PATH, QUERY_DATA_VIEW_STYLE_FILENAME)
    );
    const tabulatorStyleUri = webview.asWebviewUri(
      Utils.joinPath(extensionUri, ...DATA_VIEW_PATH, TABULATOR_STYLE_FILENAME)
    );
    const viewControllerUri = webview.asWebviewUri(
      Utils.joinPath(extensionUri, ...DATA_VIEW_PATH, QUERY_DATA_VIEW_SCRIPT_FILENAME)
    );
    const tabulatorUri = webview.asWebviewUri(
      Utils.joinPath(extensionUri, ...DATA_VIEW_PATH, TABULATOR_SCRIPT_FILENAME)
    );
    const saveIconUri = webview.asWebviewUri(
      Utils.joinPath(extensionUri, ...DATA_VIEW_ICONS_PATH, SAVE_ICON_FILENAME)
    );

    const staticAssets = {
      baseStyleUri,
      tabulatorStyleUri,
      viewControllerUri,
      tabulatorUri,
      saveIconUri
    };

    return await getHtml(staticAssets, extensionUri, webview);
  }
}
