/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import {
  APEX_CLASSES_PATH,
  APEX_FILE_NAME_EXTENSION,
  AURA_PATH,
  LWC_PATH,
  SOQL_FILE_NAME_EXTENSION
} from '../constants';
import { nls } from '../messages';

export const openDocumentationCommand = Effect.fn('openDocumentationCommand')(function* () {
  const servicesApi = yield* (yield* ExtensionProviderService).getServicesApi;
  const activeEditorUri = yield* servicesApi.services.EditorService.getActiveEditorUri().pipe(
    Effect.catchTag('NoActiveEditorError', () => Effect.void)
  );
  const activeFilePath = activeEditorUri?.path;
  const extension = activeEditorUri ? Utils.extname(activeEditorUri) : undefined;
  const documentationType = Match.value(activeFilePath).pipe(
    Match.when(Match.undefined, () => 'default' as const),
    Match.when(
      filePath => filePath.includes(AURA_PATH),
      () => 'aura' as const
    ),
    Match.when(
      filePath => filePath.includes(APEX_CLASSES_PATH) || extension === APEX_FILE_NAME_EXTENSION,
      () => 'apex' as const
    ),
    Match.when(
      () => extension === SOQL_FILE_NAME_EXTENSION,
      () => 'soql' as const
    ),
    Match.when(
      filePath => filePath.includes(LWC_PATH),
      () => 'lwc' as const
    ),
    Match.orElse(() => 'default' as const)
  );
  const docUrl = Match.value(documentationType).pipe(
    Match.when('aura', () => nls.localize('aura_doc_url')),
    Match.when('apex', () => nls.localize('apex_doc_url')),
    Match.when('soql', () => nls.localize('soql_doc_url')),
    Match.when('lwc', () => nls.localize('lwc_doc_url')),
    Match.when('default', () => nls.localize('default_doc_url')),
    Match.exhaustive
  );

  yield* Effect.annotateCurrentSpan({ type: documentationType });
  yield* Effect.promise(() => vscode.env.openExternal(URI.parse(docUrl)));
});
