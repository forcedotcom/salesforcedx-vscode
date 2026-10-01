/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import type { ApexLogListItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { LogGetNoLogsError } from '../errors/commandErrors';
import { saveAndOpenLog } from '../logs/logStorage';
import { nls } from '../messages';

const formatLogSize = (bytes: number): string =>
  bytes < 1024
    ? nls.localize('log_get_size_bytes', String(bytes))
    : bytes < 1024 * 1024
      ? nls.localize('log_get_size_kb', (bytes / 1024).toFixed(1))
      : nls.localize('log_get_size_mb', (bytes / (1024 * 1024)).toFixed(1));

export const logGetCommand = Effect.fn('ApexLog.Command.logGet')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.ApexLogService.pipe(
    Effect.flatMap(logService => logService.listLogs()),
    Effect.filterOrFail(
      Arr.isNonEmptyReadonlyArray,
      () => new LogGetNoLogsError({ message: nls.localize('log_get_no_logs') })
    ),
    Effect.flatMap(selectLog),
    Effect.flatMap(selected =>
      Effect.all({
        id: Effect.succeed(selected.id),
        body: Effect.flatMap(api.services.ApexLogService, logService => logService.getLogBody(selected.id))
      })
    ),
    Effect.flatMap(({ id, body }) => saveAndOpenLog(id, body))
  );
});

/** QuickPick over the given logs; resolves to the picked item. Fails with UserCancellationError when dismissed. */
const selectLog = Effect.fn('ApexLog.selectLog')(function* (logs: readonly ApexLogListItem[]) {
  return yield* Effect.flatMap(ExtensionProviderService, provider => provider.getServicesApi).pipe(
    Effect.flatMap(api => api.services.PromptService),
    Effect.flatMap(promptService =>
      Effect.flatMap(
        Effect.promise(() =>
          vscode.window.showQuickPick(
            logs.map(log => ({
              label: `$(file-text) ${log.LogUser?.Name ?? 'Unknown'} - ${log.Operation ?? 'Api'}`,
              description: formatLogSize(log.LogLength),
              detail: log.StartTime ? new Date(log.StartTime).toLocaleString() : undefined,
              id: log.Id
            })),
            { placeHolder: nls.localize('log_get_pick_log') }
          )
        ),
        promptService.considerUndefinedAsCancellation
      )
    )
  );
});
