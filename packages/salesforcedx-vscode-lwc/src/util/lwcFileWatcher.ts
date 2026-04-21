/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

const LWC_GLOB = '**/lwc/**/*.{js,ts,html,js-meta.xml}';

// --- INSTRUMENTATION: remove before shipping ---
let received = 0;
setInterval(() => {
  console.log(`[After Measurement] lwcFileWatcher: received ${received}`);
}, 10_000);
// --- END INSTRUMENTATION ---

export const startLwcFileWatcher = Effect.fn('lwc.fileWatcher')(function* () {
  yield* Effect.acquireUseRelease(
    Effect.sync(() => vscode.workspace.createFileSystemWatcher(LWC_GLOB)),
    watcher =>
      Stream.async<URI>(emit => {
        watcher.onDidCreate(uri => {
          received++;
          void emit.single(uri);
        });
        return Effect.sync(() => watcher.dispose());
      }).pipe(
        Stream.runForEach(uri =>
          Effect.tryPromise(() => vscode.workspace.openTextDocument(uri)).pipe(
            Effect.orElseSucceed(() => undefined)
          )
        )
      ),
    watcher => Effect.sync(() => watcher.dispose())
  );
});
