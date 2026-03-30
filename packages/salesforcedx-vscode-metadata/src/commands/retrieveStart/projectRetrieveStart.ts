/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { detectConflicts, handleConflictWithRetry } from '../../conflict/conflictFlow';
import { nls } from '../../messages';
import { retrieveComponentSet } from '../../shared/retrieve/retrieveComponentSet';

const applyDeletesAndRetrieve = Effect.fn('projectRetrieve.applyDeletesAndRetrieve')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { componentSetFromNonDeletes: componentSetToRetrieve } =
    yield* api.services.SourceTrackingService.maybeApplyRemoteDeletesToLocal(true);

  yield* retrieveComponentSet({ componentSet: componentSetToRetrieve, ignoreConflicts: true });
});

const retrieveEffect = Effect.fn('retrieveEffect')(function* (ignoreConflicts: boolean) {
  yield* Effect.annotateCurrentSpan({ ignoreConflicts });

  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [sourceTrackingService, channelService, componentSetService] = yield* Effect.all(
    [api.services.SourceTrackingService, api.services.ChannelService, api.services.ComponentSetService],
    { concurrency: 'unbounded' }
  );

  const componentSet = yield* sourceTrackingService
    .getRemoteNonDeletesAsComponentSet({ applyIgnore: true })
    .pipe(
      Effect.flatMap(componentSetService.ensureNonEmptyComponentSet),
      Effect.tap(cs =>
        channelService.appendToChannel(`Found ${cs.size} remote change${cs.size === 1 ? '' : 's'} to retrieve`)
      )
    );

  if (!ignoreConflicts) {
    const pairs = yield* detectConflicts(componentSet, 'retrieve');
    if (pairs.length > 0) {
      return yield* handleConflictWithRetry({
        retryOperation: applyDeletesAndRetrieve(),
        operationType: 'retrieve',
        componentSet
      });
    }
  }

  yield* applyDeletesAndRetrieve();
});

/** Retrieve remote changes from the default org */
export const projectRetrieveStartCommand = (ignoreConflicts: boolean) =>
  retrieveEffect(ignoreConflicts).pipe(
    Effect.catchTag('EmptyComponentSetError', () =>
      Effect.sync(() => {
        void vscode.window.showInformationMessage(nls.localize('no_remote_changes_to_retrieve'));
      })
    )
  );
