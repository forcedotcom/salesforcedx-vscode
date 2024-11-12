/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import * as vscode from 'vscode';

/**
 * The index.html file in the dist folder of the @salesforce/soql-builder-ui
 * is built by webpack to be displayed in a normal web context.  however, vscode
 * uses a custom protocol ( vscode-webview-resource instead of http ) to load resources
 * so the html needs to be manipulated dynamcially to run inside of vscode.
 */
export class HtmlUtils {
  /**
   * This regex will match tags in a string like this
   * <script defer="defer" src="./0.app.js"></script><script defer="defer" src="./app.js"></script>
   * And store just the filename section of the script tag as group[1]
   */
  protected static readonly scriptRegex = /script defer="defer"\ssrc="\.\/(?<app>[^"]*app.js)"/g;

  /**
   *
   * @param html
   * @param pathToLwcDist
   * @param webview
   */
  public static transformHtml(html: string, pathToLwcDist: string, webview: vscode.Webview): string {
    html = HtmlUtils.transformScriptTags(html, pathToLwcDist, webview);
    html = HtmlUtils.replaceCspMetaTag(html, webview);
    return html;
  }

  /**
   * This section replaces the relative file paths that are produced by
   * webpack in the build in the dist folder with the protocol that
   * vscode uses internally.
   *
   * Initial html script tags look like this
   * <script defer="defer" src="./0.app.js"></script><script defer="defer" src="./app.js"></script>
   *
   * Each matched script tag gets transformed into into a vscode specific url
   * <script src="vscode-webview-resource:0.app.js"><script src="vscode-webview-resource:app.js">
   *
   * Since we don't know how many bundles webpack will produce in the dist directory, we regex match and
   * replace them in a while loop.
   *
   * @param html
   * @param pathToLwcDist
   * @param webview
   */
  public static transformScriptTags(html: string, pathToLwcDist: string, webview: vscode.Webview): string {
    let matches: string[] | null;
    let newScriptSrc: vscode.Uri;
    while ((matches = HtmlUtils.scriptRegex.exec(html)) !== null) {
      newScriptSrc = webview.asWebviewUri(vscode.Uri.file(path.join(pathToLwcDist, matches[1])));
      html = html.replace(`./${matches[1]}`, newScriptSrc.toString());
    }
    return html;
  }

  /**
   * This method adds stricter CSP for displaying this webview inside of VSCode
   * @param html
   * @param webview
   */
  public static replaceCspMetaTag(html: string, webview: vscode.Webview): string {
    const cspMetaTag = `<meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self';
      img-src ${webview.cspSource};
      script-src ${webview.cspSource};
      style-src 'unsafe-inline' ${webview.cspSource};"
    />`;

    html = html.replace('<!-- CSP TAG -->', cspMetaTag);
    return html;
  }
}
