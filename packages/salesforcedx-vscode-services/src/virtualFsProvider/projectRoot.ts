/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { sampleProjectName } from '../constants';
import { WorkspaceService } from '../vscode/workspaceService';
import { fsPrefix } from './constants';

/**
 * memfs project root for sample/watcher/IndexedDB writes. Reuses the host-opened folder so
 * consumers share one tree and VS Code per-workspace state (Quick Open history) scopes to it.
 *
 * CBW boots per-org memfs folders; deriving (vs hardcoded literal) avoids
 * `vscode-web-state-db-<hash>` collisions across orgs in one browser (W-22816308).
 *
 * Falls back to `sampleProjectName` for empty-window + non-memfs folders.
 */
export const getProjectRoot = Effect.fn('getProjectRoot')(function* () {
  const { isEmpty, uri, fsPath } = yield* WorkspaceService.getWorkspaceInfo();
  const hostPath = isEmpty || uri.scheme !== fsPrefix ? undefined : fsPath.replace(/\/+$/, '') || undefined;
  const path = hostPath ?? `/${sampleProjectName}`;
  return { fsPath: path, uri: URI.from({ scheme: fsPrefix, path }) };
});
