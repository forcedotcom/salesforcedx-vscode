/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Effect } from 'effect';
import * as vscode from 'vscode';

// --- Configuration ---
const MAX_CONCURRENCY = 50;
const YIELD_INTERVAL = 50; // yield every N opens
const YIELD_DELAY_MS = 25; // small sleep to avoid UI stutter

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
    // 1. Find all matching workspace files
    logger(`🔍 Searching for files with pattern: ${fileGlob} (excluding: ${excludeGlob})`);
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      logger(`📂 Workspace folders: ${workspaceFolders.map(f => `${f.uri.scheme}://${f.uri.path}`).join(', ')}`);
    } else {
      logger('⚠️ No workspace folders found');
    }

    // In web mode, findFiles may not work without a search provider
    // Add timeout to detect if it's hanging
    const findFilesWithTimeout = (): Promise<vscode.Uri[]> =>
      Promise.race([
        vscode.workspace.findFiles(fileGlob, excludeGlob),
        new Promise<vscode.Uri[]>((_, reject) =>
          setTimeout(() => reject(new Error('findFiles timed out after 10 seconds')), 10_000)
        )
      ]);

    const uris = yield* Effect.tryPromise({
      try: async () => {
        logger(`🔍 Calling vscode.workspace.findFiles(${fileGlob}, ${excludeGlob})...`);
        const startTime = Date.now();
        const result = await findFilesWithTimeout();
        const duration = Date.now() - startTime;
        logger(`⏱️ findFiles completed in ${duration}ms`);
        return result;
      },
      catch: (e: unknown) => {
        const errorMsg = `Failed to find workspace files: ${String(e)}`;
        logger(`❌ ${errorMsg}`);
        // In web mode, findFiles often fails - this is expected
        if (process.env.ESBUILD_PLATFORM === 'web') {
          logger('💡 In web mode, findFiles may not work without a search provider for the workspace scheme.');
          logger('💡 Files will be loaded when opened manually by the user.');
        }
        return new Error(errorMsg);
      }
    });

    logger(`📊 findFiles returned ${uris.length} files`);
    if (uris.length === 0) {
      logger(`⚠️ No matching files found for pattern: ${fileGlob} (excluding: ${excludeGlob})`);
      logger('💡 This might be because findFiles requires a search provider for the workspace scheme.');
      logger('💡 In web mode with memfs, files may need to be opened manually.');
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

    // 2. Open all files in bounded parallel fashion
    const itemsWithIndex: { uri: vscode.Uri; idx: number }[] = uris.map((uri: vscode.Uri, idx: number) => ({
      uri,
      idx
    }));

    yield* Effect.forEach(
      itemsWithIndex,
      ({ uri, idx }) =>
        openDoc(uri).pipe(
          Effect.tap(() => (idx % YIELD_INTERVAL === 0 ? Effect.sleep(YIELD_DELAY_MS) : Effect.void)),
          Effect.catchAll((err: unknown) => Effect.logError(String(err)))
        ),
      { concurrency: MAX_CONCURRENCY }
    );

    // 3. Log completion
    logger(`✅ Workspace bootstrap complete (${uris.length} files loaded into document cache)`);
    yield* Effect.log(`✅ Workspace bootstrap complete (${uris.length} files)`);
  });
};
