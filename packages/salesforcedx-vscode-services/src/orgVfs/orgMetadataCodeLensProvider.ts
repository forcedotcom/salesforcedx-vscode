/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isError } from 'effect/Predicate';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';

export const ORG_METADATA_DOWNLOAD_COMMAND = 'sf.orgMetadata.download';

export const provideOrgMetadataCodeLenses = (document: vscode.TextDocument): vscode.CodeLens[] => {
  const title = nls.localize('org_metadata_download_text');
  const codeLens = new vscode.CodeLens(new vscode.Range(0, 0, 0, 0));
  codeLens.command = {
    command: ORG_METADATA_DOWNLOAD_COMMAND,
    title,
    tooltip: title,
    arguments: [document.uri]
  };
  return [codeLens];
};

export const downloadAndOpenOrgMetadata = async (
  uri: URI,
  download: (uri: URI) => Promise<URI>,
  closeVirtualDocument: (uri: URI) => Promise<void>
): Promise<void> => {
  const workspaceUri = await download(uri);
  await vscode.window.showTextDocument(workspaceUri, { preview: false });
  await closeVirtualDocument(uri);
};

export const registerOrgMetadataCodeLensProvider = (
  context: vscode.ExtensionContext,
  download: (uri: URI) => Promise<URI>,
  isInWorkspace: (uri: URI) => Promise<boolean>,
  closeVirtualDocument: (uri: URI) => Promise<void>
): void => {
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: 'sf-org-data', pattern: '/orgs/*/org-metadata/**' },
      {
        provideCodeLenses: async document =>
          (await isInWorkspace(URI.revive(document.uri))) ? [] : provideOrgMetadataCodeLenses(document)
      }
    ),
    vscode.commands.registerCommand(ORG_METADATA_DOWNLOAD_COMMAND, (uri: URI) => {
      const canonicalUri = URI.revive(uri);
      return downloadAndOpenOrgMetadata(canonicalUri, download, closeVirtualDocument).then(
        () => undefined,
        error =>
          vscode.window.showErrorMessage(
            nls.localize('org_metadata_download_failed_message', isError(error) ? error.message : String(error))
          )
      );
    })
  );
};
