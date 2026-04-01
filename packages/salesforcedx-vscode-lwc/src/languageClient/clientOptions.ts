/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { WorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common';
import { code2ProtocolConverter } from '@salesforce/salesforcedx-utils-vscode';
import { Uri, workspace } from 'vscode';
import type { DocumentSelector } from 'vscode-languageclient';

/** Languages supported by the LWC language server. */
const LWC_DOCUMENT_SELECTOR_LANGUAGES = ['html', 'javascript', 'typescript', 'json', 'xml'] as const;

const protocol2CodeConverter = (value: string) => Uri.parse(value);

/** Build document selector for the given schemes (e.g. ['file'] for node, or ['file', 'memfs'] for web). */
export const buildDocumentSelector = (schemes: string[]): DocumentSelector =>
  schemes.flatMap(scheme => LWC_DOCUMENT_SELECTOR_LANGUAGES.map(language => ({ language, scheme })));

/** File system watchers to synchronize with the LWC language server. */
const getSynchronizeFileEvents = () => [
  workspace.createFileSystemWatcher('**/*.resource'),
  workspace.createFileSystemWatcher('**/labels/CustomLabels.labels-meta.xml'),
  workspace.createFileSystemWatcher('**/staticresources/*.resource-meta.xml'),
  workspace.createFileSystemWatcher('**/contentassets/*.asset-meta.xml'),
  workspace.createFileSystemWatcher('**/lwc/*/*.js'),
  workspace.createFileSystemWatcher('**/modules/*/*/*.js'),
  workspace.createFileSystemWatcher('**/modules/*/*/*.ts'),
  // need to watch for directory deletions as no events are created for contents or deleted directories
  workspace.createFileSystemWatcher('**/', false, true, false)
];

const sharedUriConverters = {
  code2Protocol: code2ProtocolConverter,
  protocol2Code: protocol2CodeConverter
};

export type LwcInitializationOptions = {
  workspaceType: WorkspaceType;
  /** URI of the extension's sfdx typings directory. The server reads lds.d.ts and messageservice.d.ts from here. */
  sfdxTypingsDir: string;
};

/** Shared language client options. Override documentSelector (and add outputChannel etc.) in node/web. */
export const getBaseClientOptions = (initializationOptions: LwcInitializationOptions) => ({
  synchronize: {
    fileEvents: getSynchronizeFileEvents()
  },
  initializationOptions,
  uriConverters: sharedUriConverters
});
