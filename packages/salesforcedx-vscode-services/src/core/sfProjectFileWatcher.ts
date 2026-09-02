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
import { WorkspaceService } from '../vscode/workspaceService';
import { invalidateSfProjectCache, publishProjectConfigChange, sfProjectCacheKey } from './projectService';

const SFDX_PROJECT_FILE_NAME = 'sfdx-project.json';

/**
 * Watches sfdx-project.json edits and invalidates the matching `globalSfProjectCache` entry so the
 * next `getSfProject` re-resolves a fresh `SfProject` (no memoized JSON), picking up mid-session
 * `sourceApiVersion` changes without requiring a `.sfdx`/`.sf` delete + reload.
 */
export const watchSfProjectFile = Effect.fn('watchSfProjectFile')(function* () {
  const [fileChangePubSub, workspaceService] = yield* Effect.all([FileChangePubSub, WorkspaceService]);

  yield* Stream.fromPubSub(fileChangePubSub).pipe(
    Stream.mapEffect(event =>
      workspaceService.getWorkspaceInfo().pipe(Effect.map(workspace => ({ event, workspace })))
    ),
    // Only the supported workspace root owns ProjectService state. A basename check also matched nested
    // sfdx-project.json files and could invalidate and notify consumers for an unrelated project.
    Stream.filter(
      ({ event, workspace }) =>
        !workspace.isEmpty && event.uri.toString() === Utils.joinPath(workspace.uri, SFDX_PROJECT_FILE_NAME).toString()
    ),
    Stream.debounce(Duration.millis(5)),
    Stream.runForEach(({ event, workspace }) =>
      // Derive the cache key from WorkspaceService (the same source `getSfProject` uses), NOT from the
      // event URI's dirname. On web the runner user-agent contains "Windows", so `vscode-uri` renders
      // `uri.fsPath` with backslashes (e.g. `\dx-project`) while WorkspaceService normalizes them to `/`
      // for virtual filesystems — keying off the event URI produced `\dx-project` and never matched the
      // `/dx-project` cache entry, so mid-session edits stayed stale on web.
      sfProjectCacheKey(workspace.fsPath).pipe(
        Effect.flatMap(invalidateSfProjectCache),
        // This is the ordering guarantee for ProjectService consumers: observing the event means both
        // the Effect cache and @salesforce/core's static SfProject instances have already been cleared.
        Effect.andThen(publishProjectConfigChange(event))
      )
    )
  );
});
