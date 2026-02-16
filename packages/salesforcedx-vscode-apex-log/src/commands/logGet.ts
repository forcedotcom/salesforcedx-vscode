/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { ApexLogListItem } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { LogGetNoLogsError } from '../errors/commandErrors';
import { saveAndOpenLog } from '../logs/logStorage';
import { nls } from '../messages';

export const logGetCommand = Effect.fn('ApexLog.Command.logGet')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const logService = yield* api.services.ApexLogService;
  const logs = yield* logService.listLogs();
  if (logs.length === 0) {
    return yield* Effect.fail(new LogGetNoLogsError({ message: nls.localize('log_get_no_logs') }));
  }
  const selected = yield* selectLog(logs);
  if (!selected) return;
  const body = yield* logService.getLogBody(selected.id);
  yield* saveAndOpenLog(selected.id, body);
});

const selectLog = (logs: ApexLogListItem[]) =>
  Effect.async<{ id: string } | undefined, never>(resume => {
    const items = logs.map(log => ({
      label: `$(file-text) ${log.LogUser?.Name ?? 'Unknown'} - ${log.Operation}`,
      detail: log.StartTime?.toLocaleString(),
      id: log.id
    }));
    void vscode.window.showQuickPick(items, { placeHolder: nls.localize('log_get_pick_log') }).then(picked =>
      resume(Effect.succeed(picked ? { id: picked.id } : undefined))
    );
  });
