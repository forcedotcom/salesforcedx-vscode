/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { DATA_VIEW_PATH, HTML_FILE } from '../constants';
import { replaceCspMetaTag } from '../editor/htmlUtils';
import { getSoqlRuntime } from '../services/extensionProvider';

export const getHtml = async (
  assets: { [index: string]: vscode.Uri },
  extensionUri: vscode.Uri,
  webview: vscode.Webview
): Promise<string> => {
  const { baseStyleUri, tabulatorStyleUri, viewControllerUri, tabulatorUri, saveIconUri } = assets;

  const dataViewDistUri = Utils.joinPath(extensionUri, ...DATA_VIEW_PATH);
  let html = await getSoqlRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* getServicesApi;
      return yield* api.services.FsService.readFile(Utils.joinPath(dataViewDistUri, HTML_FILE));
    })
  );
  /*
  We need to replace the hrefs with webviewUris,
  this will need to change once we need a standalone data view.
   */
  html = replaceCspMetaTag(html, webview);
  html = html.replace('${tabulatorStyleUri}', tabulatorStyleUri.toString());
  html = html.replace('${baseStyleUri}', baseStyleUri.toString());
  html = html.replace('${tabulatorUri}', tabulatorUri.toString());
  html = html.replace('${viewControllerUri}', viewControllerUri.toString());
  // There are multiple buttons that require this icon
  while (html.match(/\${iconSave}/)) {
    html = html.replace('${iconSave}', saveIconUri.toString());
  }

  return html;
};
