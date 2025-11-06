/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Effect } from 'effect';
import * as vscode from 'vscode';
import { log } from './constants';

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
 * Loads workspace LWC files into VSCode document cache after server initialization.
 * This pre-loads documents to improve language server responsiveness.
 * Runs asynchronously and does not block extension activation.
 *
 * @param options Configuration options for file glob patterns
 */
export const bootstrapWorkspaceAwareness = (options: BootstrapOptions): Effect.Effect<void, Error> => {
  const fileGlob = options.fileGlob;
  const excludeGlob = options.excludeGlob;

  return Effect.gen(function* () {
    // 1. Find all matching workspace files
    const uris = yield* Effect.tryPromise({
      try: () => vscode.workspace.findFiles(fileGlob, excludeGlob),
      catch: (e: unknown) => new Error(`Failed to find workspace files: ${String(e)}`)
    });

    if (uris.length === 0) {
      log('No LWC files found to bootstrap');
      return;
    }

    log(`📁 Bootstrapping ${uris.length} LWC files into document cache...`);
    yield* Effect.log(`📁 Bootstrapping ${uris.length} LWC files`);

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
    log(`✅ Workspace bootstrap complete (${uris.length} files loaded into document cache)`);
    yield* Effect.log(`✅ Workspace bootstrap complete (${uris.length} files)`);
  });
};
