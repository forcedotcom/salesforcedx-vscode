/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { transformHtml } from '../../../src/editor/htmlUtils';

const html =
  '<html><!-- CSP TAG --><body class="vscode-light"><script defer="defer" src="./app.js"></script></body></html>';
const webview = {
  cspSource: 'vscode-csp',
  asWebviewUri: (uri: URI) => URI.parse(`vscode-webview-resource:${uri.path}`)
} as unknown as vscode.Webview;
const lwcDistUri = URI.file('/ext/dist/soql-builder-ui');

describe('transformHtml', () => {
  it('adds the default org capability to the body', () => {
    const result = transformHtml(html, lwcDistUri, webview, true);
    expect(result).toContain('<body data-can-set-default-org="true" class="vscode-light">');
  });

  it('marks the default org action unavailable when the org extension is absent', () => {
    const result = transformHtml(html, lwcDistUri, webview, false);
    expect(result).toContain('<body data-can-set-default-org="false" class="vscode-light">');
  });
});
