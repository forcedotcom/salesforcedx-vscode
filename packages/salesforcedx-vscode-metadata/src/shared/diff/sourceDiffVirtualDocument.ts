/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';

/** Virtual scheme for source diff in VS Code for Web (e.g. Code Builder): workbench cannot open raw `file://` in `vscode.diff`. */
export const SOURCE_DIFF_VIRTUAL_SCHEME = 'sf-metadata-source-diff';

const contentByUri = new Map<string, string>();

const randomSessionId = (): string =>
  globalThis.crypto && 'randomUUID' in globalThis.crypto
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const decodeUtf8 = (data: Uint8Array): string => new TextDecoder('utf8').decode(data);

export const registerSourceDiffVirtualDocumentProvider = (context: vscode.ExtensionContext): void => {
  const provider: vscode.TextDocumentContentProvider = {
    provideTextDocumentContent: (uri: URI): string => contentByUri.get(uri.toString()) ?? ''
  };
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SOURCE_DIFF_VIRTUAL_SCHEME, provider),
    vscode.workspace.onDidCloseTextDocument(doc => {
      if (doc.uri.scheme === SOURCE_DIFF_VIRTUAL_SCHEME) {
        contentByUri.delete(doc.uri.toString());
      }
    })
  );
};

/**
 * On desktop, returns the original URIs. On Web, reads both files via `workspace.fs` and returns virtual URIs
 * backed by {@link registerSourceDiffVirtualDocumentProvider} so `vscode.diff` can open without a file handle.
 */
export const resolveDiffUrisForWorkbench = async (
  remoteUri: URI,
  localUri: URI
): Promise<{ left: URI; right: URI }> => {
  if (vscode.env.uiKind !== vscode.UIKind.Web) {
    return { left: remoteUri, right: localUri };
  }
  const [remoteBytes, localBytes] = await Promise.all([
    vscode.workspace.fs.readFile(remoteUri),
    vscode.workspace.fs.readFile(localUri)
  ]);
  const session = randomSessionId();
  const remoteName = Utils.basename(remoteUri);
  const localName = Utils.basename(localUri);
  const left = URI.parse(`${SOURCE_DIFF_VIRTUAL_SCHEME}:/${session}/remote/${remoteName}`);
  const right = URI.parse(`${SOURCE_DIFF_VIRTUAL_SCHEME}:/${session}/local/${localName}`);
  contentByUri.set(left.toString(), decodeUtf8(remoteBytes));
  contentByUri.set(right.toString(), decodeUtf8(localBytes));
  return { left, right };
};
