/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Mock LSP client for workspace/findFiles. Simulates the client (e.g. VS Code) so the server
 * discovers files via the request instead of a server-side cache.
 */
import { WORKSPACE_FIND_FILES_REQUEST } from '@salesforce/salesforcedx-lightning-lsp-common';
import { minimatch } from 'minimatch';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { URI } from 'vscode-uri';

const findFilesOnDisk = (dirPath: string, basePath: string, pattern: string): string[] => {
  const results: string[] = [];
  try {
    if (!fs.existsSync(dirPath)) {
      return results;
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...findFilesOnDisk(fullPath, basePath, pattern));
      } else if (entry.isFile()) {
        const relativePath = path.relative(basePath, fullPath).replaceAll('\\', '/');
        if (minimatch(relativePath, pattern, { matchBase: true })) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // ignore read errors
  }
  return results;
};

/**
 * Creates a mock connection that handles workspace/findFiles by discovering files on disk
 * under the given base path. Use in tests so the provider uses client-style discovery
 * (no server-side file cache).
 */
export const createMockWorkspaceFindFilesConnection = (_workspaceRoot: string) => ({
  sendRequest: async (
    method: string,
    params: { baseFolderUri: string; pattern: string }
  ): Promise<{ uris?: string[]; error?: string }> => {
    if (method !== WORKSPACE_FIND_FILES_REQUEST) {
      return { error: `Unknown method: ${method}` };
    }
    try {
      const basePath = URI.parse(params.baseFolderUri).fsPath;
      const files = findFilesOnDisk(basePath, basePath, params.pattern);
      const uris = files.map(f => URI.file(f).toString());
      return { uris };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { error: message };
    }
  }
});
