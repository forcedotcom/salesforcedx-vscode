/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SObjectCategory, SObjectRefreshSource } from '../sobjects/types/general';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { FAILURE_CODE, SUCCESS_CODE } from '../sobjects/constants';
import { getMinNames, getMinObjects } from '../sobjects/minObjectRetriever';
import { streamAndWriteSobjectArtifacts, writeSobjectArtifacts } from './sobjectArtifactWriter';

/** Command ID for cross-extension refresh completion notification */
export const SOBJECT_REFRESH_COMPLETE_CMD = 'sf.internal.sobjectrefresh.complete';

/** Module-level active state — prevents concurrent executions. Object mutation is used to avoid `let`. */
const activeState = { isActive: false };

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

const executeRefresh = (category: SObjectCategory, source: SObjectRefreshSource | undefined) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;

    yield* channelService.appendToChannel(`Starting ${nls.localize('sobjects_refresh')}`);

    const progressLocation =
      source === 'manual' ? vscode.ProgressLocation.Notification : vscode.ProgressLocation.Window;

    const cancellationTokenSource = new vscode.CancellationTokenSource();

    const result = yield* Effect.promise(() =>
      vscode.window.withProgress(
        { title: nls.localize('sobjects_refresh'), location: progressLocation, cancellable: true },
        (_progress, token) => {
          cancellationTokenSource.dispose();
          if (source === 'startupmin') {
            return writeSobjectArtifacts({ cancellationToken: token, sobjects: getMinObjects(), sobjectNames: getMinNames() });
          }
          return streamAndWriteSobjectArtifacts({ cancellationToken: token, category, source: source ?? 'manual' });
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
  }).pipe(
    Effect.tapError(error =>
      Effect.gen(function* () {
        const msg = error instanceof Error ? error.message : String(error);
        yield* Effect.promise(() => vscode.window.showErrorMessage(msg));
        yield* Effect.promise(() => vscode.commands.executeCommand(SOBJECT_REFRESH_COMPLETE_CMD, { exitCode: FAILURE_CODE }));
      })
    ),
    Effect.ensuring(Effect.sync(() => { activeState.isActive = false; }))
  );

/**
 * Refresh SObject definitions command — Effect pattern, no SfCommandlet framework.
 * Registered as sf.internal.refreshsobjects in metadata's index.ts.
 */
export const refreshSObjectsCommand = (source?: SObjectRefreshSource) =>
  Effect.gen(function* () {
    if (activeState.isActive) {
      yield* Effect.promise(() =>
        vscode.window.showErrorMessage(nls.localize('sobjects_no_refresh_if_already_active_error_text'))
      );
      return;
    }

    activeState.isActive = true;

    if (!source || source === 'manual') {
      const picked = yield* gatherCategory();
      if (!picked) {
        activeState.isActive = false;
        return;
      }
      yield* executeRefresh(picked, source);
    } else {
      yield* executeRefresh('ALL', source);
    }
  });
