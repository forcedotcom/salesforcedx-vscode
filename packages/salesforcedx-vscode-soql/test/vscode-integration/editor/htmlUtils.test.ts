/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as vscode from 'vscode';
import { SOQL_BUILDER_UI_PATH } from '../../../src/constants';
import { HtmlUtils } from '../../../src/editor/htmlUtils';

describe('html utilities', () => {
  let mockWebviewPanel: vscode.WebviewPanel;
  const pathToLwcDist = SOQL_BUILDER_UI_PATH;
  const html = `
  <script src="./0.app.js"></script><script src="./app.js"></script>
  `;
  beforeEach(() => {
    mockWebviewPanel = vscode.window.createWebviewPanel(
      'mockWebviewPanel',
      'Mock Webview Panel',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
  });
  it('transforms script tags appropriately', () => {
    const transformed = HtmlUtils.transformScriptTags(
      html,
      pathToLwcDist,
      mockWebviewPanel.webview
    );
    const appUri = mockWebviewPanel.webview.asWebviewUri(
      vscode.Uri.file(path.join(pathToLwcDist, 'app.js'))
    );
    const appZeroUri = mockWebviewPanel.webview.asWebviewUri(
      vscode.Uri.file(path.join(pathToLwcDist, '0.app.js'))
    );
    expect(transformed).to.contain(appUri);
    expect(transformed).to.contain(appZeroUri);
  });
  it('transforms Content-Security-Policy appropriately', () => {
    expect(HtmlUtils.replaceCspMetaTag);
  });
  it('transforms html appropriately', () => {
    expect(HtmlUtils.transformHtml);
  });
});
