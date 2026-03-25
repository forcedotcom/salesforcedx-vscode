/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';

/**
 * Matches webpack-generated script tags like:
 * <script defer="defer" src="./0.app.js"></script>
 * Captures the filename as group[1].
 */
const scriptRegex = /script defer="defer"\ssrc="\.\/(?<app>[^"]*app.js)"/g;

/**
 * Transforms index.html from @salesforce/soql-builder-ui (built for normal web context)
 * to work inside VS Code, which uses vscode-webview-resource instead of http to load resources.
 */
export const transformHtml = (html: string, lwcDistUri: URI, webview: vscode.Webview): string =>
  replaceCspMetaTag(transformScriptTags(html, lwcDistUri, webview), webview);

/**
 * Replaces relative webpack script paths with vscode-webview-resource URIs.
 *
 * Initial html script tags look like this
 * <script defer="defer" src="./0.app.js"></script><script defer="defer" src="./app.js"></script>
 *
 * Each matched script tag gets transformed into a vscode specific url
 * <script src="vscode-webview-resource:0.app.js"><script src="vscode-webview-resource:app.js">
 *
 * Since we don't know how many bundles webpack will produce in the dist directory, we regex match and
 * replace them in a while loop.
 */
const transformScriptTags = (html: string, lwcDistUri: URI, webview: vscode.Webview): string => {
  let matches: string[] | null;
  let newScriptSrc: URI;
  while ((matches = scriptRegex.exec(html)) !== null) {
    newScriptSrc = webview.asWebviewUri(Utils.joinPath(lwcDistUri, matches[1]));
    // eslint-disable-next-line no-param-reassign
    html = html.replace(`./${matches[1]}`, newScriptSrc.toString());
  }
  return html;
};

/**
 * Adds stricter CSP for displaying this webview inside of VSCode.
 */
export const replaceCspMetaTag = (html: string, webview: vscode.Webview): string => {
  const cspMetaTag = `<meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self';
      img-src ${webview.cspSource};
      script-src ${webview.cspSource};
      style-src 'unsafe-inline' ${webview.cspSource};"
    />`;

  return html.replace('<!-- CSP TAG -->', cspMetaTag);
};
