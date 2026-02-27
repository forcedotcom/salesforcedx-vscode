/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SObjectCategory, SObjectRefreshSource } from '../sobjects/types/general';
import { ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Runtime from 'effect/Runtime';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { AllServicesLayer } from '../services/extensionProvider';
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

const executeRefresh = Effect.fn('executeRefresh')(
  function* (category: SObjectCategory, source: SObjectRefreshSource | undefined) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;
    const extensionScope = yield* getExtensionScope();

    yield* channelService.appendToChannel(`Starting ${nls.localize('sobjects_refresh')}`);

    const progressLocation =
      source === 'manual' ? vscode.ProgressLocation.Notification : vscode.ProgressLocation.Window;

    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const rt = yield* Effect.runtime();

    const result = yield* Effect.promise(() =>
      vscode.window.withProgress(
        { title: nls.localize('sobjects_refresh'), location: progressLocation, cancellable: true },
        (progress, token) => {
          cancellationTokenSource.dispose();
          const artifactEffect =
            source === 'startupmin'
              ? writeSobjectArtifacts({ cancellationToken: token, sobjects: getMinObjects(), sobjectNames: getMinNames(), progress })
              : streamAndWriteSobjectArtifacts({ cancellationToken: token, category, source: source ?? 'manual', progress });
          return Runtime.runPromise(rt)(
            artifactEffect.pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope))
          );
        }
      )
    );

    const { standardObjects = 0, customObjects = 0 } = result.data;
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

    const exitCode = result.data.cancelled ? FAILURE_CODE : SUCCESS_CODE;
    yield* Effect.promise(() => vscode.commands.executeCommand(SOBJECT_REFRESH_COMPLETE_CMD, { exitCode }));
  },
  Effect.tapError(error =>
    Effect.gen(function* () {
      const msg = error instanceof Error ? error.message : String(error);
      yield* Effect.promise(() => vscode.window.showErrorMessage(msg));
      yield* Effect.promise(() => vscode.commands.executeCommand(SOBJECT_REFRESH_COMPLETE_CMD, { exitCode: FAILURE_CODE }));
    })
  ),
);

/**
 * Refresh SObject definitions command — Effect pattern, no SfCommandlet framework.
 * Registered as sf.internal.refreshsobjects in metadata's index.ts.
 */
const runRefresh = (source?: SObjectRefreshSource) =>
  Effect.fn('runRefresh')(function* () {
    if (!source || source === 'manual') {
      const picked = yield* gatherCategory();
      if (!picked) return;
      yield* executeRefresh(picked, source);
    } else {
      yield* executeRefresh('ALL', source);
    }
  });

export const refreshSObjectsCommand = Effect.fn('refreshSObjectsCommand')(function* (source?: SObjectRefreshSource) {
    const result = yield* refreshSemaphore.withPermitsIfAvailable(1)(runRefresh(source)());
    if (Option.isNone(result)) {
      yield* Effect.promise(() =>
        vscode.window.showErrorMessage(nls.localize('sobjects_no_refresh_if_already_active_error_text'))
      );
    }
  });
