/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { nls } from '../messages';

class UserCancelledOverwriteError extends Data.TaggedError('UserCancelledOverwriteError')<{}> {}

export const checkAndPromptOverwriteUris = Effect.fn('checkAndPromptOverwriteUris')(function* (
  uris: readonly URI[],
  localizedMessage: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const existsFlags = yield* Effect.all(
    uris.map(uri => api.services.FsService.fileOrFolderExists(uri)),
    { concurrency: 'unbounded' }
  );
  if (!existsFlags.some(Boolean)) return true;

  const choice = yield* Effect.promise(() =>
    vscode.window.showWarningMessage(
      localizedMessage,
      { modal: true },
      nls.localize('overwrite_button'),
      nls.localize('cancel_button')
    )
  );

  return choice === nls.localize('overwrite_button') ? true : yield* new UserCancelledOverwriteError();
});
