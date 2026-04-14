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
import { formatRetrieveOutput } from '../../shared/retrieve/formatRetrieveOutput';
import { retrieveComponentSet } from '../../shared/retrieve/retrieveComponentSet';
import { withConfigurableSuccessNotification } from '../../utils/withConfigurableSuccessNotification';

/**
 * Apply remote deletes and retrieve non-deletes. Skips retrieve when only deletes exist.
 * Always surfaces fileResponsesFromDelete in output.
 */
const applyAndRetrieve = Effect.fn('projectRetrieve.applyAndRetrieve')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const { componentSetFromNonDeletes, fileResponsesFromDelete } =
    yield* api.services.SourceTrackingService.maybeApplyRemoteDeletesToLocal();

  yield* componentSetFromNonDeletes.size > 0
    ? retrieveComponentSet({
        componentSet: componentSetFromNonDeletes,
        ignoreConflicts: true,
        fileResponsesFromDelete
      })
    : channelService.appendToChannel(yield* formatRetrieveOutput(undefined, fileResponsesFromDelete));
});

const retrieveEffect = Effect.fn('retrieveEffect')(
  function* (ignoreConflicts: boolean) {
    yield* Effect.annotateCurrentSpan({ ignoreConflicts });

    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const [sourceTrackingService, channelService, componentSetService] = yield* Effect.all(
      [api.services.SourceTrackingService, api.services.ChannelService, api.services.ComponentSetService],
      { concurrency: 'unbounded' }
    );

    const [nonDeletesCS, deletesCS] = yield* Effect.all(
      [
        sourceTrackingService.getRemoteNonDeletesAsComponentSet({ applyIgnore: true }),
        sourceTrackingService.getRemoteDeletesAsComponentSet()
      ],
      { concurrency: 'unbounded' }
    );

    // Merge delete members into non-deletes ComponentSet for a combined conflict check + non-empty guard.
    // deletesCS members are added so detectConflictsFromTracking filters include locally-modified files
    // that were remotely deleted.
    [...deletesCS].map(member => nonDeletesCS.add(member));

    const combinedCS = yield* componentSetService.ensureNonEmptyComponentSet(nonDeletesCS).pipe(
      Effect.tap(cs =>
        channelService.appendToChannel(`Found ${cs.size} remote change${cs.size === 1 ? '' : 's'} to retrieve`)
      )
    );

    if (!ignoreConflicts) yield* detectConflicts(combinedCS, 'retrieve');
    yield* applyAndRetrieve();
  },
  Effect.catchTag('ConflictsDetectedError', err =>
    handleConflictWithRetry({
      pairs: err.pairs,
      operationType: err.operationType,
      retryOperation: applyAndRetrieve()
    })
  )
);

/** Retrieve remote changes from the default org */
export const projectRetrieveStartCommand = (ignoreConflicts: boolean) =>
  retrieveEffect(ignoreConflicts).pipe(
    withConfigurableSuccessNotification(
      nls.localize(
        'command_succeeded_text',
        ignoreConflicts
          ? nls.localize('project_retrieve_start_ignore_conflicts_default_org_text')
          : nls.localize('project_retrieve_start_default_org_text')
      )
    ),
    Effect.catchTag('EmptyComponentSetError', () =>
      Effect.sync(() => {
        void vscode.window.showInformationMessage(nls.localize('no_remote_changes_to_retrieve'));
      })
    )
  );
