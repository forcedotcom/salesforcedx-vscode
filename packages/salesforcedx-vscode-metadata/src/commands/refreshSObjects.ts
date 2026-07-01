/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SObjectCategory, SObjectRefreshSource } from '../sobjects/types/general';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { CORE_EXTENSION_ID } from '../constants';
import { nls } from '../messages';
import { FAILURE_CODE, SUCCESS_CODE } from '../sobjects/constants';
import { getMinNames, getMinObjects } from '../sobjects/minObjectRetriever';
import { streamAndWriteSobjectArtifacts, writeSobjectArtifacts } from './sobjectArtifactWriter';

/** Command ID for cross-extension refresh completion notification */
export const SOBJECT_REFRESH_COMPLETE_CMD = 'sf.internal.sobjectrefresh.complete';

const refreshSemaphore = Effect.runSync(Effect.makeSemaphore(1));

const gatherCategory = () =>
  Effect.promise(async () => {
    const options = [
      nls.localize('sobject_refresh_all'),
      nls.localize('sobject_refresh_custom'),
      nls.localize('sobject_refresh_standard')
    ];
    const choice = await vscode.window.showQuickPick(options);
    if (!choice) return undefined;
    if (choice === options[1]) return 'CUSTOM' as const;
    if (choice === options[2]) return 'STANDARD' as const;
    return 'ALL' as const;
  });

/** Emit the cross-extension completion notification for the given exit code, if core is present. */
const emitCompletion = (exitCode: number) =>
  vscode.extensions.getExtension(CORE_EXTENSION_ID)
    ? Effect.promise(() => vscode.commands.executeCommand(SOBJECT_REFRESH_COMPLETE_CMD, { exitCode }))
    : Effect.void;

const executeRefresh = Effect.fn('executeRefresh')(function* (
  category: SObjectCategory,
  source: SObjectRefreshSource | undefined
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const promptService = yield* api.services.PromptService;

  yield* channelService.appendToChannel(`Starting ${nls.localize('sobjects_refresh')}`);

  const progressLocation = source === 'manual' ? vscode.ProgressLocation.Notification : vscode.ProgressLocation.Window;

  // Run the artifact effect in the current fiber (via the shared operator) so a typed FsServiceError
  // reaches the outer command error handler instead of being turned into a defect by a nested runtime.
  yield* promptService
    .withCancellableProgressReporting(
      nls.localize('sobjects_refresh'),
      progressLocation
    )((progress, token) =>
      Effect.gen(function* () {
        const result = yield* source === 'startupmin'
          ? writeSobjectArtifacts({
              cancellationToken: token,
              sobjects: getMinObjects(),
              sobjectNames: getMinNames(),
              progress
            })
          : streamAndWriteSobjectArtifacts({
              cancellationToken: token,
              category,
              source: source ?? 'manual',
              progress
            });

        const { standardObjects = 0, customObjects = 0, cancelled } = result.data;
        if (standardObjects > 0) {
          yield* channelService.appendToChannel(
            nls.localize('processed_sobjects_length_text', standardObjects, 'Standard')
          );
        }
        if (customObjects > 0) {
          yield* channelService.appendToChannel(
            nls.localize('processed_sobjects_length_text', customObjects, 'Custom')
          );
        }
        // token-based cancel returns cancelled=true without failing; treat it as a failed exit for completion.
        if (cancelled) return yield* new api.services.UserCancellationError();
      })
    )
    // onExit fires on success, typed failure, defect, and interrupt — the single place both completion
    // codes are emitted so no exit branch is missed (external Einstein GPT contract, both codes required).
    .pipe(Effect.onExit(exit => emitCompletion(Exit.isSuccess(exit) ? SUCCESS_CODE : FAILURE_CODE)));
});

const runRefresh = Effect.fn('runRefresh')(function* (source?: SObjectRefreshSource) {
  if (!source || source === 'manual') {
    const picked = yield* gatherCategory();
    if (!picked) return;
    yield* executeRefresh(picked, source);
  } else {
    yield* executeRefresh('ALL', source);
  }
});

export const refreshSObjectsCommand = Effect.fn('refreshSObjectsCommand')(function* (source?: SObjectRefreshSource) {
  const result = yield* refreshSemaphore.withPermitsIfAvailable(1)(runRefresh(source));
  if (Option.isNone(result)) {
    yield* Effect.promise(() =>
      vscode.window.showErrorMessage(nls.localize('sobjects_no_refresh_if_already_active_error_text'))
    );
  }
});
