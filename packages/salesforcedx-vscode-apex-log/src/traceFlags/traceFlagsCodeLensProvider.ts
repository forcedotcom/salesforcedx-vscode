/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { CancellationToken, CodeLens, ExtensionContext, languages, Range, TextDocument } from 'vscode';
import { nls } from '../messages';
import { buildTraceFlagsSchemas } from '../schemas/traceFlagsSchema';
import { AllServicesLayer } from '../services/extensionProvider';

const TRACE_FLAGS_DOCUMENT_SELECTOR = {
  language: 'json',
  pattern: '**/.sf/orgs/*/traceFlags.json'
};

const hasActiveTraceFlagEffect = Effect.fn(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { userId } = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  if (!userId) return false;
  const traceFlagService = yield* api.services.TraceFlagService;
  const existing = yield* traceFlagService.getTraceFlagForUser(userId);
  return Option.isSome(existing) && existing.value.isActive;
});

const provideTraceFlagsCodeLens = Effect.fn('ApexLog.CodeLensProvider.provideTraceFlagsCodeLens')(function* (
  document: TextDocument,
  _token: CancellationToken
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { decodeTraceFlagsConfigFromJson } = buildTraceFlagsSchemas(api.services.TraceFlagItemStruct);
  const parsed = decodeTraceFlagsConfigFromJson(document.getText());
  const text = document.getText();
  const deleteLenses = Object.values(parsed?.traceFlags ?? {})
    .flat()
    .filter(item => item.isActive)
    .flatMap(item => {
      const idx = text.indexOf(`"id": "${item.id}"`);
      if (idx < 0) return [];
      const pos = document.positionAt(idx);
      return [
        new CodeLens(new Range(pos.line, 0, pos.line, 0), {
          command: 'sf.apex.traceFlags.deleteForId',
          title: nls.localize('trace_flag_tooltip_stop') ?? 'Remove',
          tooltip: nls.localize('trace_flag_tooltip_stop') ?? 'Remove',
          arguments: [item.id]
        })
      ];
    });

  const hasActive = yield* hasActiveTraceFlagEffect().pipe(
    Effect.tapError(e => Effect.logWarning(String(e))),
    Effect.catchAll(() => Effect.succeed(false))
  );
  const createLenses = hasActive
    ? []
    : [
        new CodeLens(new Range(0, 0, 0, 0), {
          command: 'sf.apex.traceFlags.createForCurrentUser',
          title: nls.localize('trace_flag_codelens_create') ?? 'Create trace flag for current user',
          tooltip: nls.localize('trace_flag_codelens_create') ?? 'Create trace flag for current user'
        })
      ];
  const userDebugIdx = text.indexOf('"USER_DEBUG"');
  const userDebugLenses =
    userDebugIdx < 0
      ? []
      : (() => {
          const pos = document.positionAt(userDebugIdx);
          return [
            new CodeLens(new Range(pos.line, 0, pos.line, 0), {
              command: 'sf.apex.traceFlags.createForUser',
              title: nls.localize('trace_flag_codelens_create_for_user') ?? 'Add trace for another user',
              tooltip: nls.localize('trace_flag_codelens_create_for_user') ?? 'Add trace for another user'
            })
          ];
        })();
  return [...deleteLenses, ...createLenses, ...userDebugLenses];
});

export const registerTraceFlagsCodeLensProvider = (context: ExtensionContext): void => {
  const provider = {
    provideCodeLenses: (document: TextDocument, token: CancellationToken) =>
      provideTraceFlagsCodeLens(document, token).pipe(
        Effect.provide(AllServicesLayer),
        Effect.tapError(e => Effect.logError(String(e))),
        Effect.catchAll(() => Effect.succeed<CodeLens[]>([])),
        Effect.runPromise
      )
  };
  context.subscriptions.push(languages.registerCodeLensProvider(TRACE_FLAGS_DOCUMENT_SELECTOR, provider));
};
