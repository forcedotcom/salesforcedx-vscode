/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Either from 'effect/Either';
import { URI } from 'vscode-uri';
import { createOrgBrowserWebviewHtml } from '../../src/browser/orgBrowserWebviewProvider';
import { decodeOrgBrowserWebviewMessage, isCurrentOrgBrowserMessage } from '../../src/browser/protocol';

describe('Org Browser webview protocol', () => {
  it('rejects unknown and malformed messages', () => {
    expect(Either.isLeft(decodeOrgBrowserWebviewMessage({ type: 'unknown' }))).toBe(true);
    expect(Either.isLeft(decodeOrgBrowserWebviewMessage({ type: 'expand', nodeId: 'type:ApexClass' }))).toBe(true);
  });

  it('accepts schema-valid messages and rejects stale generations', () => {
    const decoded = decodeOrgBrowserWebviewMessage({
      type: 'expand',
      generation: 4,
      requestId: 1,
      nodeId: 'type:ApexClass'
    });
    expect(Either.isRight(decoded)).toBe(true);
    if (Either.isRight(decoded)) {
      expect(isCurrentOrgBrowserMessage(decoded.right, 4)).toBe(true);
      expect(isCurrentOrgBrowserMessage(decoded.right, 5)).toBe(false);
    }
    expect(isCurrentOrgBrowserMessage({ type: 'ready' }, 99)).toBe(true);
    expect(isCurrentOrgBrowserMessage({ type: 'requestInitialData' }, 99)).toBe(true);
  });

  it('generates local-only CSP-protected HTML', () => {
    const html = createOrgBrowserWebviewHtml(
      'vscode-webview://test',
      URI.parse('vscode-webview://test/dist/org-browser-ui/app.js'),
      URI.parse('vscode-webview://test/dist/org-browser-ui/app.css'),
      'nonce-value'
    );
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'nonce-nonce-value'");
    expect(html).toContain('nonce="nonce-value"');
    expect(html).toContain('app.css');
    expect(html).toContain('app.js');
    expect(html).not.toContain('https://');
  });
});
