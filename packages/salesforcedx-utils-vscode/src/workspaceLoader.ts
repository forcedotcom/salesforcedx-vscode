/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Effect } from 'effect';
import * as vscode from 'vscode';

// --- Configuration ---/
// Windows machines use smaller batch sizes due to performance characteristics
const isWindows = typeof process !== 'undefined' && process.platform === 'win32';
const BATCH_SIZE = isWindows ? 5 : 10; // Number of files to process per batch
const BATCH_CONCURRENCY = isWindows ? 2 : 3; // Concurrent files within each batch
const BATCH_DELAY_MS = isWindows ? 150 : 100; // Delay between batches (ms)

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
    const uris = yield* Effect.tryPromise({
      try: () => vscode.workspace.findFiles(fileGlob, excludeGlob),
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

    // 2. Process files in batches
    // Split URIs into batches of BATCH_SIZE
    const batches: vscode.Uri[][] = [];
    for (let i = 0; i < uris.length; i += BATCH_SIZE) {
      batches.push(uris.slice(i, i + BATCH_SIZE));
    }

    logger(`📦 Processing ${batches.length} batches (${BATCH_SIZE} files per batch)`);

    // Process each batch sequentially with a delay between batches
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      const batchNum = batchIdx + 1;

      logger(`📦 Processing batch ${batchNum}/${batches.length} (${batch.length} files)...`);

      // Process files within the batch with limited concurrency
      yield* Effect.forEach(
        batch,
        uri => openDoc(uri).pipe(Effect.catchAll((err: unknown) => Effect.logError(String(err)))),
        { concurrency: BATCH_CONCURRENCY }
      );

      // Add a delay between batches (except after the last batch)
      if (batchIdx < batches.length - 1) {
        yield* Effect.sleep(BATCH_DELAY_MS);
      }
    }

    // 3. Log completion
    logger(`✅ Workspace bootstrap complete (${uris.length} files loaded into document cache)`);
    yield* Effect.log(`✅ Workspace bootstrap complete (${uris.length} files)`);
  });
};
