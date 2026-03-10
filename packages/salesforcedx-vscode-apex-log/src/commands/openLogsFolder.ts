/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { OpenLogsFolderError } from '../errors/commandErrors';
import { getDebugLogsDir } from '../logs/logStorage';

export const openLogsFolderCommand = Effect.fn('ApexLog.Command.openLogsFolder')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const dir = yield* getDebugLogsDir();
  yield* api.services.FsService.createDirectory(dir);
  yield* Effect.tryPromise({
    try: () => vscode.commands.executeCommand('revealInExplorer', dir),
    catch: (e: unknown) =>
      new OpenLogsFolderError({
        message: 'Failed to reveal logs folder in explorer',
        cause: e instanceof Error ? e : new Error(String(e))
      })
  });
});
