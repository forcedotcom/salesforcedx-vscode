/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { saveExecResultAndOpenLog } from '../logs/logStorage';

const executeAnonymous = (code: string) =>
  Effect.fn('ApexLog.Command.executeAnonymous')(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const traceFlagService = yield* api.services.TraceFlagService;
    const logService = yield* api.services.ApexLogService;
    const execService = yield* api.services.ExecuteAnonymousService;

    // if we created it just for this execution, we'll clean it up at the end.
    const { created, traceFlagId } = yield* traceFlagService.ensureTraceFlag();
    const result = yield* execService.executeAnonymous(code);

    const logs = yield* logService.listLogs(5);
    const body = logs.length > 0 ? yield* logService.getLogBody(logs[0].id) : '';
    yield* saveExecResultAndOpenLog(code, result, body);

    created && traceFlagId ? yield* traceFlagService.deleteTraceFlag(traceFlagId) : yield* Effect.void;
    return result;
  })();

export const executeAnonymousDocumentCommand = Effect.fn('ApexLog.Command.executeAnonymousDocument')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const code = yield* api.services.EditorService.getActiveEditorText(false);
  return yield* executeAnonymous(code);
});

export const executeAnonymousSelectionCommand = Effect.fn('ApexLog.Command.executeAnonymousSelection')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const code = yield* api.services.EditorService.getActiveEditorText(true);
  return yield* executeAnonymous(code);
});
