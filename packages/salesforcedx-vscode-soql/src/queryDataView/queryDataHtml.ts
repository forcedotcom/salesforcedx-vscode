/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import { Uri, Webview } from 'vscode';
import { DATA_VIEW_UI_PATH, HTML_FILE } from '../constants';
import { HtmlUtils } from '../editor/htmlUtils';

export const getHtml = (assets: { [index: string]: Uri }, extensionPath: string, webview: Webview): string => {
  const { baseStyleUri, tabulatorStyleUri, viewControllerUri, tabulatorUri, saveIconUri } = assets;

  const pathToDataViewDist = path.join(extensionPath, DATA_VIEW_UI_PATH);
  const pathToHtml = path.join(pathToDataViewDist, HTML_FILE);
  let html = fs.readFileSync(pathToHtml).toString();
  /*
  We need to replace the hrefs with webviewUris,
  this will need to change once we need a standalone data view.
   */
  html = HtmlUtils.replaceCspMetaTag(html, webview);
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
