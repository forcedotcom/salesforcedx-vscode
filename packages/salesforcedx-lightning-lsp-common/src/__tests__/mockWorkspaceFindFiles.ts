/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Mock LSP client for workspace/findFiles. Simulates the client (e.g. VS Code) so the server
 * discovers files via the request instead of a server-side cache. Shared by Aura and LWC tests.
 */
import { Minimatch } from 'minimatch';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { URI } from 'vscode-uri';
import { WORKSPACE_FIND_FILES_REQUEST } from '../lspCustomRequests';

/** Normalize path to forward slashes for consistent glob matching. */
const toForwardSlashes = (p: string): string => p.replaceAll('\\', '/');

const matchPattern = (relativePath: string, pattern: string): boolean => {
  const m = new Minimatch(toForwardSlashes(pattern), { matchBase: true });
  return m.match(toForwardSlashes(relativePath));
};

const findFilesOnDisk = (dirPath: string, basePath: string, pattern: string): string[] => {
  const results: string[] = [];
  const resolvedDir = path.resolve(dirPath);
  if (!fs.existsSync(resolvedDir)) {
    return results;
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(resolvedDir, { withFileTypes: true }) as fs.Dirent[];
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(resolvedDir, String(entry.name));
    try {
      if (entry.isDirectory()) {
        results.push(...findFilesOnDisk(fullPath, basePath, pattern));
      } else if (entry.isFile()) {
        const relativePath = toForwardSlashes(path.relative(basePath, fullPath));
        if (matchPattern(relativePath, pattern)) {
          results.push(fullPath);
        }
      }
    } catch {
      // skip this entry (e.g. permission denied on a subdir)
    }
  }
  return results;
};

/**
 * Creates a mock connection that handles workspace/findFiles by discovering files on disk
 * under the given base path (or from options.relativePaths when disk read is unavailable).
 */
export const createMockWorkspaceFindFilesConnection = (
  _workspaceRoot: string,
  options: {
    /** When set, use this list of relative paths instead of reading disk (e.g. when Jest cannot read workspace). */
    relativePaths?: string[];
  } = {}
) => ({
  sendRequest: (
    method: string,
    params: { baseFolderUri?: string; pattern?: string },
    _token?: unknown
  ): Promise<{ uris?: string[]; error?: string }> => {
    if (method !== WORKSPACE_FIND_FILES_REQUEST) {
      return Promise.resolve({ error: `Unknown method: ${method}` });
    }
    const baseFolderUri = params?.baseFolderUri;
    const pattern = params?.pattern;
    if (baseFolderUri == null || pattern == null) {
      return Promise.resolve({ error: 'Missing baseFolderUri or pattern' });
    }
    try {
      const basePath = path.resolve(URI.parse(baseFolderUri).fsPath);
      const normalizedPattern = toForwardSlashes(pattern);
      let files: string[];
      if (options.relativePaths && options.relativePaths.length > 0) {
        files = options.relativePaths
          .filter(rel => matchPattern(rel, normalizedPattern))
          .map(rel => path.resolve(basePath, rel));
      } else {
        files = findFilesOnDisk(basePath, basePath, pattern);
      }
      const uris = files.map(f => URI.file(f).toString());
      return Promise.resolve({ uris });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return Promise.resolve({ error: message });
    }
  }
});
