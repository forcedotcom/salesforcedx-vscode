/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { Utils } from 'vscode-uri';
import { FileChangePubSub } from '../vscode/fileChangePubSub';
import { invalidateSfProjectCache, sfProjectCacheKey } from './projectService';

const SFDX_PROJECT_FILE_NAME = 'sfdx-project.json';

/**
 * Watches sfdx-project.json edits and invalidates the matching `globalSfProjectCache` entry so the
 * next `getSfProject` re-resolves a fresh `SfProject` (no memoized JSON), picking up mid-session
 * `sourceApiVersion` changes without requiring a `.sfdx`/`.sf` delete + reload.
 */
export const watchSfProjectFile = Effect.fn('watchSfProjectFile')(function* () {
  const fileChangePubSub = yield* FileChangePubSub;

  yield* Stream.fromPubSub(fileChangePubSub).pipe(
    Stream.filter(event => Utils.basename(event.uri) === SFDX_PROJECT_FILE_NAME),
    Stream.debounce(Duration.millis(5)),
    Stream.runForEach(event =>
      // cacheKey derivation mirrors getSfProject: the workspace dir equals the directory containing
      // the edited sfdx-project.json (desktop), or the disk-root marker (vscode-test-web).
      sfProjectCacheKey(Utils.dirname(event.uri).fsPath).pipe(Effect.flatMap(invalidateSfProjectCache))
    )
  );
});
