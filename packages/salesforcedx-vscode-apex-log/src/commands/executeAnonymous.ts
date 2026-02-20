/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { saveExecResultAndOpenLog } from '../logs/logStorage';

const executeAnonymous = Effect.fn('ApexLog.ExecuteAnonymous.executeAnonymous')(function* (code: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { result, logBody, logId } = yield* api.services.ExecuteAnonymousService.executeAndRetrieveLog(code);
  yield* saveExecResultAndOpenLog(code, result, logBody, logId);
  return result;
});

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
