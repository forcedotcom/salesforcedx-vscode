/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { getTestController } from '../views/testController';

const TEST_RESULTS_GLOB = '**/.sfdx/tools/testresults/apex/*.json';

// --- INSTRUMENTATION: remove before shipping ---
let received = 0;
setInterval(() => {
  console.log(`[After Measurement] testResultsFileWatcher: received ${received}`);
}, 10_000);
// --- END INSTRUMENTATION ---

export const setupTestResultsFileWatcher = Effect.fn('apex-testing.watchTestResults')(function* (
  testController: ReturnType<typeof getTestController>
) {
  yield* Effect.acquireUseRelease(
    Effect.sync(() => vscode.workspace.createFileSystemWatcher(TEST_RESULTS_GLOB)),
    watcher =>
      Stream.async<URI>(emit => {
        watcher.onDidCreate(uri => {
          received++;
          void emit.single(uri);
        });
        return Effect.sync(() => watcher.dispose());
      }).pipe(
        Stream.runForEach(uri => {
          void testController.onResultFileCreate(Utils.dirname(uri), uri);
          return Effect.void;
        })
      ),
    watcher => Effect.sync(() => watcher.dispose())
  );
});
