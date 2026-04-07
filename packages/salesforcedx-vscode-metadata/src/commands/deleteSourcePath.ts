/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { detectConflicts, handleConflictWithRetry } from '../conflict/conflictFlow';
import { nls } from '../messages';
import { deleteComponentSet } from '../shared/delete/deleteComponentSet';
import { type DeleteSourceFailedError } from '../shared/delete/deleteErrors';
import { formatDeployOutput } from '../shared/deploy/formatDeployOutput';
import { withConfigurableSuccessNotification } from '../utils/withConfigurableSuccessNotification';

/** throws the standard UserCancellationError if the user cancels the deletion */
const showDeleteConfirmation = Effect.fn('showDeleteConfirmation')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const PROCEED = nls.localize('confirm_delete_source_button_text');
  const CANCEL = nls.localize('cancel_delete_source_button_text');
  const prompt = nls.localize('delete_source_confirmation_message');
  const response = yield* Effect.promise(
    async () => await vscode.window.showInformationMessage(prompt, PROCEED, CANCEL)
  );
  return response === PROCEED ? (true as const) : yield* new api.services.UserCancellationError();
});

const deletePaths = (uris: URI[]) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const componentSetService = yield* api.services.ComponentSetService;
    return yield* componentSetService.getComponentSetFromUris(uris).pipe(
      Effect.flatMap(componentSetService.ensureNonEmptyComponentSet),
      Effect.tap(cs => detectConflicts(cs, 'delete')),
      Effect.flatMap(cs => deleteComponentSet({ componentSet: cs }))
    );
  });

/** Delete source paths from the default org */
export const deleteSourcePathsCommand = Effect.fn('deleteSourcePaths')(
  function* (sourceUri: URI | undefined, uris: URI[] | undefined) {
    yield* Effect.annotateCurrentSpan({ sourceUri, uris });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;

    // Resolve source URI from parameter or active editor
    const resolvedSourceUri = sourceUri ?? (yield* api.services.EditorService.getActiveEditorUri());
    const resolvedUris = uris?.length ? [resolvedSourceUri, ...uris] : [resolvedSourceUri];
    yield* api.services.ProjectService.ensureInPackageDirectories(resolvedUris);

    // User confirmation
    yield* showDeleteConfirmation();

    // Delete the paths
    yield* deletePaths(resolvedUris).pipe(
      Effect.catchTag('ConflictsDetectedError', err =>
        handleConflictWithRetry({
          pairs: err.pairs,
          operationType: err.operationType,
          retryOperation: deleteComponentSet({ componentSet: err.componentSet })
        })
      ),
      // add the error output to the chanel, let the regular error handler do the rest
      Effect.tapErrorTag('DeleteSourceFailedError', (error: DeleteSourceFailedError) =>
        Effect.all([
          ...(error.result
            ? [formatDeployOutput(error.result).pipe(Effect.flatMap(o => channelService.appendToChannel(o)))]
            : []),
          channelService.getChannel.pipe(Effect.map(channel => channel.show()))
        ])
      )
    );
  },
  withConfigurableSuccessNotification(nls.localize('command_succeeded_text', nls.localize('delete_source_text'))),
  Effect.catchTag('NoActiveEditorError', () =>
    Effect.sync(() => {
      void vscode.window.showErrorMessage(nls.localize('delete_source_select_file_or_directory'));
    })
  )
);
