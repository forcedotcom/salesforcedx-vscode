/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Chunk, Effect, Stream } from 'effect';
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
// Throttle: allow this many "tokens" per duration so the IDE can catch up
const THROTTLE_UNITS = isWindows ? 5 : 10;
const THROTTLE_DURATION_MS = isWindows ? 150 : 50;

/**
 * Options for bootstrapWorkspaceAwareness
 */
export interface BootstrapOptions {
  /** Glob pattern for files to load (ignored if uris is provided) */
  fileGlob: string;
  /** Glob pattern for files/directories to exclude (ignored if uris is provided) */
  excludeGlob: string;
  /** Optional logger function - defaults to console.log */
  logger?: (message: string) => void;
  /** Optional list of URIs to load directly - if provided, skips findFiles and uses these URIs
   * this should be used in web mode to pass files directly to bootstrapWorkspaceAwareness to skip findFiles
   */
  uris?: vscode.Uri[];
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
  const { fileGlob, excludeGlob, logger = console.log, uris: providedUris } = options;

  return Effect.gen(function* () {
    // 1. Find all matching workspace files, or use provided URIs
    let uris: vscode.Uri[];
    if (providedUris && providedUris.length > 0) {
      // Use provided URIs directly, skip findFiles
      uris = providedUris;
      logger(`Using ${uris.length} provided URIs (skipping findFiles)`);
    } else {
      // Use findFiles to discover files
      uris = yield* Effect.tryPromise({
        try: () => vscode.workspace.findFiles(fileGlob, excludeGlob),
        catch: (e: unknown) => new Error(`Failed to find workspace files: ${String(e)}`)
      });

      if (uris.length === 0) {
        logger(`No matching files found for pattern: ${fileGlob} (excluding: ${excludeGlob})`);
        return;
      }
    }

    logger(`📁 Bootstrapping ${uris.length} files into document cache...`);

    // 2. Process all files with limited concurrency and throttled rate
    // Stream.throttle (token bucket) limits how many we pull per time window so the IDE can catch up
    yield* Stream.fromIterable(uris).pipe(
      Stream.rechunk(1),
      Stream.throttle({
        cost: Chunk.size,
        duration: `${THROTTLE_DURATION_MS} millis`,
        units: THROTTLE_UNITS
      }),
      Stream.mapEffect(uri => openDoc(uri).pipe(Effect.catchAll((err: unknown) => Effect.logError(String(err)))), {
        concurrency: MAX_CONCURRENCY
      }),
      Stream.runDrain
    );

    // 3. Log completion
    logger(`✅ Workspace bootstrap complete (${uris.length} files loaded into document cache)`);
  });
};
