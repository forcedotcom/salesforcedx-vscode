/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { type EditorService } from 'salesforcedx-vscode-services';
import { saveExecResultAndOpenLog } from '../logs/logStorage';

type EditorContext = Effect.Effect.Success<ReturnType<EditorService['getActiveEditorContext']>>;

const executeAnonymous = Effect.fn('ApexLog.ExecuteAnonymous.executeAnonymous')(
  function* (context: EditorContext) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const { result, logBody, logId } = yield* api.services.ExecuteAnonymousService.executeAndRetrieveLog(
      context.text
    );
    yield* api.services.ExecuteAnonymousService.reportExecResult(
      result,
      context.uri,
      context.selectionRange?.startLine
    );
    yield* saveExecResultAndOpenLog(context.text, result, logBody, logId);
    return result;
  }
);

export const executeAnonymousDocumentCommand = Effect.fn('ApexLog.Command.executeAnonymousDocument')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const context = yield* api.services.EditorService.getActiveEditorContext(false);
  return yield* executeAnonymous(context);
});

export const executeAnonymousSelectionCommand = Effect.fn('ApexLog.Command.executeAnonymousSelection')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const context = yield* api.services.EditorService.getActiveEditorContext(true);
  return yield* executeAnonymous(context);
});
