/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { workspace } from 'vscode';
import type { DocumentSelector } from 'vscode-languageclient';

/** Embedded-language toggles sent to the server on initialize. Web drops `javascript` (typescript is node-only). */
export type VisualforceInitializationOptions = {
  embeddedLanguages: { css: boolean; javascript: boolean };
};

/** Build a `visualforce` document selector for the given schemes (e.g. `['file']` on node, `['file','memfs']` on web). */
export const buildDocumentSelector = (schemes: string[]): DocumentSelector =>
  schemes.map(scheme => ({ language: 'visualforce', scheme }));

/**
 * Schemes to match Visualforce documents on. Always `file`; on web, files use the workspace folder scheme
 * (e.g. `memfs`), so add every open workspace folder's scheme.
 */
export const buildSchemes = (): string[] => {
  const schemes = new Set<string>(['file']);
  workspace.workspaceFolders?.forEach(folder => schemes.add(folder.uri.scheme));
  return Array.from(schemes);
};

/** Shared language client options. node/web override `documentSelector` (and web adds an output channel). */
export const getBaseClientOptions = (initializationOptions: VisualforceInitializationOptions) => ({
  synchronize: {
    configurationSection: ['visualforce', 'css', 'javascript']
  },
  initializationOptions
});
