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
import { URI, Utils } from 'vscode-uri';

/** Languages supported by the LWC language server. */
const LWC_DOCUMENT_SELECTOR_LANGUAGES = ['html', 'javascript', 'typescript', 'json', 'xml'] as const;

const protocol2CodeConverter = (value: string) => URI.parse(value);

/** Build document selector for the given schemes (e.g. ['file'] for node, or ['file', 'memfs'] for web). */
export const buildDocumentSelector = (schemes: string[]): DocumentSelector =>
  schemes.flatMap(scheme => LWC_DOCUMENT_SELECTOR_LANGUAGES.map(language => ({ language, scheme })));

/**
 * File system watchers to synchronize with the LWC language server.
 *
 * When packageDirectories are provided, watchers are scoped to only those directories
 * to avoid scanning the entire workspace (including node_modules, .git, etc.).
 * Falls back to ** patterns if no package directories are available.
 *
 * @param packageDirectories - Array of package directory paths from sfdx-project.json (e.g., ['force-app', 'utils'])
 */
const getSynchronizeFileEvents = (packageDirectories?: string[]) => {
  const workspaceRoot = workspace.workspaceFolders?.[0];

  // If we have package directories, scope watchers to only those paths for better performance
  if (packageDirectories && packageDirectories.length > 0 && workspaceRoot) {
    return packageDirectories.flatMap(pkgDir => {
      const workspaceRootUri = URI.parse(workspaceRoot.uri.toString());
      const computedPackageUri = Utils.joinPath(workspaceRootUri, ...pkgDir.split(/[\\/]+/));
      const packageUri = workspaceRoot.uri.with({ path: computedPackageUri.path });
      const relativePattern = (pattern: string): RelativePattern => new RelativePattern(packageUri, pattern);

      return [
        workspace.createFileSystemWatcher(relativePattern('**/*.resource')),
        workspace.createFileSystemWatcher(relativePattern('**/labels/CustomLabels.labels-meta.xml')),
        workspace.createFileSystemWatcher(relativePattern('**/staticresources/*.resource-meta.xml')),
        workspace.createFileSystemWatcher(relativePattern('**/contentassets/*.asset-meta.xml')),
        workspace.createFileSystemWatcher(relativePattern('**/lwc/*/*.js')),
        workspace.createFileSystemWatcher(relativePattern('**/modules/*/*/*.js')),
        workspace.createFileSystemWatcher(relativePattern('**/modules/*/*/*.ts')),
        // need to watch for directory deletions as no events are created for contents or deleted directories
        workspace.createFileSystemWatcher(relativePattern('**/'), false, true, false)
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
    // need to watch for directory deletions as no events are created for contents or deleted directories
    workspace.createFileSystemWatcher('**/', false, true, false)
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
  packageDirectories?: string[]
) => ({
  synchronize: {
    fileEvents: getSynchronizeFileEvents(packageDirectories)
  },
  initializationOptions,
  uriConverters: sharedUriConverters
});
