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
  <!-- CSP TAG -->'
  <script defer="defer" src="./0.app.js"></script><script defer="defer" src="./app.js"></script>
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
    const transformedHtml = HtmlUtils.transformHtml(
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
    expect(transformedHtml).to.contain(appUri);
    expect(transformedHtml).to.contain(appZeroUri);
  });
  it('transforms Content-Security-Policy appropriately', () => {
    const transformedHtml = HtmlUtils.transformHtml(
      html,
      pathToLwcDist,
      mockWebviewPanel.webview
    );
    expect(transformedHtml).to.contain('meta');
    expect(transformedHtml).to.contain(mockWebviewPanel.webview.cspSource);
  });
});
