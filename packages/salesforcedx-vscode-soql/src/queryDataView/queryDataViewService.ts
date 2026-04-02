/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult } from '../types';
import { getServicesApi } from '@salesforce/effect-ext-utils';
import type { JsonMap } from '@salesforce/ts-types';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
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
import { getSoqlRuntime } from '../services/extensionProvider';
import { FileFormat, QueryDataFileService as FileService } from './queryDataFileService';
import { extendQueryData } from './queryDataHelper';
import { getHtml } from './queryDataHtml';

const appendToChannel = (message: string) =>
  getServicesApi.pipe(
    Effect.flatMap(api => api.services.ChannelService),
    Effect.flatMap(svc => svc.appendToChannel(message))
  );

const getWebViewContent = async (webview: vscode.Webview, extensionUri: URI): Promise<string> => {
  const baseStyleUri = webview.asWebviewUri(
    Utils.joinPath(extensionUri, ...DATA_VIEW_PATH, QUERY_DATA_VIEW_STYLE_FILENAME)
  );
  const tabulatorStyleUri = webview.asWebviewUri(
    Utils.joinPath(extensionUri, ...DATA_VIEW_PATH, TABULATOR_STYLE_FILENAME)
  );
  const viewControllerUri = webview.asWebviewUri(
    Utils.joinPath(extensionUri, ...DATA_VIEW_PATH, QUERY_DATA_VIEW_SCRIPT_FILENAME)
  );
  const tabulatorUri = webview.asWebviewUri(Utils.joinPath(extensionUri, ...DATA_VIEW_PATH, TABULATOR_SCRIPT_FILENAME));
  const saveIconUri = webview.asWebviewUri(Utils.joinPath(extensionUri, ...DATA_VIEW_ICONS_PATH, SAVE_ICON_FILENAME));

  return getHtml(
    { baseStyleUri, tabulatorStyleUri, viewControllerUri, tabulatorUri, saveIconUri },
    extensionUri,
    webview
  );
};

const saveRecordsEffect = Effect.fn('QueryDataView.save_records')(function* ({
  queryText,
  queryData,
  format,
  document
}: {
  queryText: string;
  queryData: QueryResult<JsonMap>;
  format: FileFormat;
  document: vscode.TextDocument;
}) {
  const fileService = new FileService(queryText, queryData, format, document);
  yield* Effect.promise(() => fileService.save()).pipe(
    Effect.catchAllCause(() =>
      Effect.sync(() => {
        vscode.window.showErrorMessage(nls.localize('error_data_view_save'));
      })
    )
  );
});

type DataViewEvent = {
  type: string;
  format?: FileFormat;
};

export class QueryDataViewService {
  public currentPanel: vscode.WebviewPanel | undefined = undefined;
  public static extensionUri: URI;
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
        appendToChannel(nls.localize('error_unknown_error', 'data_view_post_message')).pipe(
          Effect.andThen(appendToChannel(`soql_error_data_view_post_message: ${String(cause)}`))
        )
      )
    );
  }

  public async createOrShowWebView(): Promise<vscode.Webview> {
    const { extensionUri } = QueryDataViewService;
    this.currentPanel = vscode.window.createWebviewPanel(
      QUERY_DATA_VIEW_TYPE,
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

    this.currentPanel.webview.html = await getWebViewContent(
      this.currentPanel.webview,
      QueryDataViewService.extensionUri
    );

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
              Effect.catchAllCause(() => appendToChannel(nls.localize('error_unknown_error', event.type)))
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
        return saveRecordsEffect({
          queryText: this.queryText,
          queryData: this.queryData,
          format: format!,
          document: this.document
        });

      default:
        return appendToChannel(nls.localize('error_unknown_error', type)).pipe(
          Effect.withSpan('QueryDataView.unknown_message', { attributes: { messageType: type } })
        );
    }
  };
}
