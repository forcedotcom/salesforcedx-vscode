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
import { buildExtendedTraceFlagItemStruct, buildTraceFlagsSchemas } from '../schemas/traceFlagsSchema';
import { getRuntime } from '../services/runtime';

const TRACE_FLAGS_DOCUMENT_SELECTOR = { language: 'json', scheme: 'sf-traceflags' };

const hasActiveTraceFlagEffect = Effect.fn('ApexLog.hasActiveTraceFlag')(function* () {
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
  const ExtendedItemStruct = buildExtendedTraceFlagItemStruct(api.services.TraceFlagItemStruct);
  const { decodeTraceFlagsConfigFromJson } = buildTraceFlagsSchemas(ExtendedItemStruct);
  const parsed = decodeTraceFlagsConfigFromJson(document.getText());
  const text = document.getText();
  const allActiveItems = Object.values(parsed?.traceFlags ?? {}).flat().filter(item => item.isActive);
  const deleteLenses = allActiveItems.flatMap(item => {
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
  const itemsWithDebugLevel = allActiveItems.filter(
    (item): item is typeof item & { debugLevelName: string } =>
      typeof item.debugLevelName === 'string'
  );
  const changeDebugLevelLenses = itemsWithDebugLevel.flatMap(item => {
    const idIdx = text.indexOf(`"id": "${item.id}"`);
    if (idIdx < 0) return [];
    const debugLevelNameIdx = text.indexOf('"debugLevelName"', idIdx);
    if (debugLevelNameIdx < 0) return [];
    const pos = document.positionAt(debugLevelNameIdx);
    return [
      new CodeLens(new Range(pos.line, 0, pos.line, 0), {
        command: 'sf.apex.traceFlags.changeDebugLevel',
        title: nls.localize('trace_flag_codelens_change_debug_level') ?? 'Change',
        tooltip: nls.localize('trace_flag_codelens_change_debug_level') ?? 'Change',
        arguments: [item.id]
      })
    ];
  });

  const hasActive = yield* hasActiveTraceFlagEffect().pipe(
    Effect.tapError(e => Effect.logWarning(String(e))),
    Effect.catchAll(() => Effect.succeed(false))
  );
  const devLogIdx = text.indexOf('"DEVELOPER_LOG"');
  const createLenses =
    hasActive || devLogIdx < 0
      ? []
      : (() => {
          const pos = document.positionAt(devLogIdx);
          return [
            new CodeLens(new Range(pos.line, 0, pos.line, 0), {
              command: 'sf.apex.traceFlags.createForCurrentUser',
              title: nls.localize('trace_flag_codelens_create') ?? 'Create trace flag for current user',
              tooltip: nls.localize('trace_flag_codelens_create') ?? 'Create trace flag for current user'
            })
          ];
        })();
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
  const deleteDebugLevelLenses = (parsed?.debugLevels ?? []).flatMap(item => {
    const idx = text.indexOf(`"id": "${item.id}"`);
    if (idx < 0) return [];
    const pos = document.positionAt(idx);
    return [
      new CodeLens(new Range(pos.line, 0, pos.line, 0), {
        command: 'sf.apex.traceFlags.deleteDebugLevelForId',
        title: nls.localize('trace_flag_tooltip_stop') ?? 'Remove',
        tooltip: nls.localize('trace_flag_tooltip_stop') ?? 'Remove',
        arguments: [item.id]
      })
    ];
  });
  const debugLevelsIdx = text.indexOf('"debugLevels"');
  const createDebugLevelLenses =
    debugLevelsIdx < 0
      ? []
      : (() => {
          const pos = document.positionAt(debugLevelsIdx);
          return [
            new CodeLens(new Range(pos.line, 0, pos.line, 0), {
              command: 'sf.apex.traceFlags.createLogLevel',
              title: nls.localize('trace_flag_codelens_create_log_level') ?? 'Create Debug level',
              tooltip: nls.localize('trace_flag_codelens_create_log_level') ?? 'Create Debug level'
            })
          ];
        })();
  return [
    ...deleteLenses,
    ...changeDebugLevelLenses,
    ...createLenses,
    ...userDebugLenses,
    ...deleteDebugLevelLenses,
    ...createDebugLevelLenses
  ];
});

export const registerTraceFlagsCodeLensProvider = Effect.fn(
  'ApexLog.CodeLensProvider.registerTraceFlagsCodeLensProvider'
)(function* (context: ExtensionContext) {
  const provider = {
    provideCodeLenses: (document: TextDocument, token: CancellationToken) =>
      getRuntime().runPromise(
        provideTraceFlagsCodeLens(document, token).pipe(
          Effect.tapError(e => Effect.logError(String(e))),
          Effect.catchAll(() => Effect.succeed<CodeLens[]>([]))
        )
      )
  };
  context.subscriptions.push(languages.registerCodeLensProvider(TRACE_FLAGS_DOCUMENT_SELECTOR, provider));
});
