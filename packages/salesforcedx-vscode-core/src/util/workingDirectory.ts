/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';

export const ensureCurrentWorkingDirIsProjectPath = Effect.fn('ensureCurrentWorkingDirIsProjectPath')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { fsPath } = yield* api.services.WorkspaceService.getWorkspaceInfo();
  if (!fsPath || process.cwd() === fsPath) {
    return;
  }
  yield* api.services.FsService.stat(fsPath).pipe(
    Effect.andThen(Effect.sync(() => process.chdir(fsPath))),
    Effect.catchAll(() => Effect.void)
  );
});
