/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Effect } from 'effect';
// eslint-disable-next-line no-restricted-imports
import { glob } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

// --- Configuration ---
// Opening too many documents simultaneously can cause:
// - High memory usage (each document loaded into memory)
// - UI freezing (too many concurrent file I/O operations)
// - Poor user experience (IDE becomes unresponsive)
//
// Windows machines use smaller values due to performance characteristics
const isWindows = typeof process !== 'undefined' && process.platform === 'win32';
const MAX_CONCURRENCY = isWindows ? 2 : 10; // Concurrent files being processed
const YIELD_INTERVAL = isWindows ? 5 : 10; // Yield every N files to let IDE catch up
const YIELD_DELAY_MS = isWindows ? 150 : 50; // Delay when yielding (ms)

/**
 * Options for bootstrapWorkspaceAwareness
 */
export interface BootstrapOptions {
  /** Glob pattern for files to load */
  fileGlob: string;
  /** Glob pattern for files/directories to exclude */
  excludeGlob: string;
  /** Optional logger function - defaults to console.log */
  logger?: (message: string) => void;
}

// --- Effect-wrapped VSCode API ---
const openDoc = (uri: vscode.Uri): Effect.Effect<vscode.Uri, Error> =>
  Effect.tryPromise({
    try: async () => {
      await vscode.workspace.openTextDocument(uri);
      return uri;
    },
    catch: (err: unknown) => new Error(`Failed to open ${uri.fsPath}: ${String(err)}`)
  });

// --- Main bootstrap effect ---
/**
 * Loads workspace files into VSCode document cache after server initialization.
 * This pre-loads documents to improve language server responsiveness.
 * Runs asynchronously and does not block extension activation.
 *
 * @param options Configuration options for file glob patterns and logging
 */
export const bootstrapWorkspaceAwareness = (options: BootstrapOptions): Effect.Effect<void, Error> => {
  const { fileGlob, excludeGlob, logger = console.log } = options;

  return Effect.gen(function* () {
    // 1. Find all matching workspace files using glob
    const uris = yield* Effect.tryPromise({
      try: async () => {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
          return [];
        }

        // Expand brace patterns like {a,b} into multiple patterns
        // This ensures compatibility with glob package which may not expand braces the same way as vscode.workspace.findFiles
        const expandBraces = (pattern: string): string[] => {
          const braceMatch = pattern.match(/\{([^}]+)\}/);
          if (!braceMatch) {
            return [pattern];
          }

          const [fullMatch, alternatives] = braceMatch;
          const braceOptions = alternatives.split(',').map(opt => opt.trim());
          const results: string[] = [];

          for (const braceOption of braceOptions) {
            const expanded = pattern.replace(fullMatch, braceOption);
            results.push(...expandBraces(expanded));
          }

          return results;
        };

        const patterns = expandBraces(fileGlob);

        // Search workspace folders
        // On Windows, run sequentially to avoid excessive file system operations
        // On other platforms, run in parallel for better performance
        const allUris: vscode.Uri[] = [];

        // Temporarily commented out Windows-specific sequential search
        // if (isWindows) {
        //   // Sequential search on Windows to avoid resource contention
        //   for (const folder of vscode.workspace.workspaceFolders) {
        //     const workspacePath = folder.uri.fsPath || folder.uri.path;
        //     if (!workspacePath) {
        //       continue;
        //     }

        //     // Search each pattern and combine results
        //     for (const pattern of patterns) {
        //       const files: string[] = [];
        //       const globOptions: { cwd: string; ignore?: string[]; withFileTypes?: boolean } = {
        //         cwd: workspacePath,
        //         withFileTypes: true
        //       };
        //       if (excludeGlob) {
        //         globOptions.ignore = [excludeGlob];
        //       }

        //       // fs.glob returns an async generator, convert to array
        //       for await (const entry of glob(pattern, globOptions)) {
        //         // entry is a Dirent when withFileTypes is true
        //         if (typeof entry === 'object' && 'isFile' in entry && entry.isFile()) {
        //           // Resolve to absolute path
        //           const absolutePath = path.resolve(workspacePath, entry.name);
        //           files.push(absolutePath);
        //         }
        //       }

        //       allUris.push(...files.map(filePath => vscode.Uri.file(filePath)));
        //     }
        //   }
        // } else {
        // Parallel search on non-Windows platforms
        const searchPromises = vscode.workspace.workspaceFolders.map(async folder => {
          const workspacePath = folder.uri.fsPath || folder.uri.path;
          if (!workspacePath) {
            return [];
          }

          // Search each pattern and combine results
          const allFiles: string[] = [];
          for (const pattern of patterns) {
            const files: string[] = [];
            const globOptions: { cwd: string; ignore?: string[]; withFileTypes?: boolean } = {
              cwd: workspacePath,
              withFileTypes: true
            };
            if (excludeGlob) {
              globOptions.ignore = [excludeGlob];
            }

            // fs.glob returns an async generator, convert to array
            for await (const entry of glob(pattern, globOptions)) {
              // entry is a Dirent when withFileTypes is true
              if (typeof entry === 'object' && 'isFile' in entry && entry.isFile()) {
                // Resolve to absolute path
                const absolutePath = path.resolve(workspacePath, entry.name);
                files.push(absolutePath);
              }
            }
            allFiles.push(...files);
          }

          return allFiles.map(filePath => vscode.Uri.file(filePath));
        });

        const searchResults = await Promise.all(searchPromises);
        allUris.push(...searchResults.flat());
        // }

        // Remove duplicates (in case multiple patterns match the same file)
        const uniqueUris = Array.from(new Set(allUris.map(uri => uri.toString()))).map(uriString =>
          vscode.Uri.parse(uriString)
        );

        return uniqueUris;
      },
      catch: (e: unknown) => new Error(`Failed to find workspace files: ${String(e)}`)
    });

    if (uris.length === 0) {
      logger(`No matching files found for pattern: ${fileGlob} (excluding: ${excludeGlob})`);
      return;
    }

    logger(`📁 Bootstrapping ${uris.length} files into document cache...`);
    logger(
      `Files found: ${uris
        .slice(0, 10)
        .map(uri => uri.fsPath)
        .join(', ')}${uris.length > 10 ? '...' : ''}`
    );
    yield* Effect.log(`📁 Bootstrapping ${uris.length} files`);

    // 2. Process all files with limited concurrency and periodic yields
    // This is simpler than batching but still provides regular pauses for the IDE
    const itemsWithIndex: { uri: vscode.Uri; idx: number }[] = uris.map((uri: vscode.Uri, idx: number) => ({
      uri,
      idx
    }));

    yield* Effect.forEach(
      itemsWithIndex,
      ({ uri, idx }) =>
        openDoc(uri).pipe(
          // Yield periodically to let the IDE catch up
          Effect.tap(() => (idx > 0 && idx % YIELD_INTERVAL === 0 ? Effect.sleep(YIELD_DELAY_MS) : Effect.void)),
          Effect.catchAll((err: unknown) => Effect.logError(String(err)))
        ),
      { concurrency: MAX_CONCURRENCY }
    );

    // 3. Log completion
    logger(`✅ Workspace bootstrap complete (${uris.length} files loaded into document cache)`);
    yield* Effect.log(`✅ Workspace bootstrap complete (${uris.length} files)`);
  });
};
