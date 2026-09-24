/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { code2ProtocolConverter } from '@salesforce/effect-ext-utils';
import type { WorkspaceType } from '@salesforce/salesforcedx-lightning-lsp-common';
import { RelativePattern, workspace } from 'vscode';
import type { DocumentSelector } from 'vscode-languageclient';
import { URI } from 'vscode-uri';

/** Languages supported by the LWC language server. */
const LWC_DOCUMENT_SELECTOR_LANGUAGES = ['html', 'javascript', 'typescript', 'json', 'xml'] as const;

const protocol2CodeConverter = (value: string) => URI.parse(value);

/** Build document selector for the given schemes (e.g. ['file'] for node, or ['file', 'memfs'] for web). */
export const buildDocumentSelector = (schemes: string[]): DocumentSelector =>
  schemes.flatMap(scheme => LWC_DOCUMENT_SELECTOR_LANGUAGES.map(language => ({ language, scheme })));

/**
 * File system watchers to synchronize with the LWC language server.
 *
 * When package directory URIs are provided, watchers are scoped to only those directories
 * to avoid scanning the entire workspace (including node_modules, .git, etc.).
 * Each URI is already a complete watcher base, so this does not depend on workspace.workspaceFolders.
 * Falls back to ** patterns if no package directories are available.
 *
 * @param packageDirectoryUris - Package directories from sfdx-project.json.
 */
const getSynchronizeFileEvents = (packageDirectoryUris?: URI[]) => {
  // If we have package directories, scope watchers to only those paths for better performance
  if (packageDirectoryUris?.length) {
    return packageDirectoryUris.flatMap(packageDirectoryUri => {
      const relativePattern = (pattern: string): RelativePattern => new RelativePattern(packageDirectoryUri, pattern);

      return [
        workspace.createFileSystemWatcher(relativePattern('**/*.resource')),
        workspace.createFileSystemWatcher(relativePattern('**/labels/CustomLabels.labels-meta.xml')),
        workspace.createFileSystemWatcher(relativePattern('**/staticresources/*.resource-meta.xml')),
        workspace.createFileSystemWatcher(relativePattern('**/contentassets/*.asset-meta.xml')),
        workspace.createFileSystemWatcher(relativePattern('**/lwc/*/*.js')),
        workspace.createFileSystemWatcher(relativePattern('**/modules/*/*/*.js')),
        workspace.createFileSystemWatcher(relativePattern('**/modules/*/*/*.ts')),
        workspace.createFileSystemWatcher(relativePattern('**/*.js-meta.xml')),
        // Watch for directory deletions only (ignore creates) - .js-meta.xml watcher handles needed creates
        workspace.createFileSystemWatcher(relativePattern('**/'), true, true, false)
      ];
    });
  }

  // Fallback to workspace-wide patterns if no package directories available
  return [
    workspace.createFileSystemWatcher('**/*.resource'),
    workspace.createFileSystemWatcher('**/labels/CustomLabels.labels-meta.xml'),
    workspace.createFileSystemWatcher('**/staticresources/*.resource-meta.xml'),
    workspace.createFileSystemWatcher('**/contentassets/*.asset-meta.xml'),
    workspace.createFileSystemWatcher('**/lwc/*/*.js'),
    workspace.createFileSystemWatcher('**/modules/*/*/*.js'),
    workspace.createFileSystemWatcher('**/modules/*/*/*.ts'),
    workspace.createFileSystemWatcher('**/*.js-meta.xml'),
    // Watch for directory deletions only (ignore creates) - .js-meta.xml watcher handles needed creates
    workspace.createFileSystemWatcher('**/', true, true, false)
  ];
};

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
export const getBaseClientOptions = (
  initializationOptions: LwcInitializationOptions,
  packageDirectoryUris?: URI[]
) => ({
  synchronize: {
    fileEvents: getSynchronizeFileEvents(packageDirectoryUris)
  },
  initializationOptions,
  uriConverters: sharedUriConverters
});
