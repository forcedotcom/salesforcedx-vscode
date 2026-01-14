/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type { SourceTrackingConflictError } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { deleteComponentSet } from '../shared/delete/deleteComponentSet';
import { type DeleteSourceFailedError } from '../shared/delete/deleteErrors';
import { formatDeployOutput } from '../shared/deploy/formatDeployOutput';

const showDeleteConfirmation = () =>
  Effect.promise(async () => {
    const PROCEED = nls.localize('confirm_delete_source_button_text');
    const CANCEL = nls.localize('cancel_delete_source_button_text');
    const prompt = nls.localize('delete_source_confirmation_message');
    return await vscode.window.showInformationMessage(prompt, PROCEED, CANCEL).then(response => response === PROCEED);
  });

const deletePaths = (paths: Set<string>) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const componentSetService = yield* api.services.ComponentSetService;
    const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
      yield* componentSetService.getComponentSetFromPaths(paths)
    );
    yield* deleteComponentSet({ componentSet });
  });

/** Delete source paths from the default org */
export const deleteSourcePaths = async (sourceUri: URI | undefined, uris: URI[] | undefined): Promise<void> =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ sourceUri, uris });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;

    // Resolve source URI from parameter or active editor
    const resolvedSourceUri =
      sourceUri ??
      (yield* (yield* api.services.EditorService).getActiveEditorUri.pipe(
        Effect.catchTag('NoActiveEditorError', () =>
          Effect.promise(() =>
            vscode.window.showErrorMessage(nls.localize('delete_source_select_file_or_directory'))
          ).pipe(Effect.as(undefined))
        )
      ));

    if (!resolvedSourceUri) {
      return;
    }

    // User confirmation
    const confirmed = yield* showDeleteConfirmation();
    if (!confirmed) {
      return;
    }

    const resolvedUris = uris?.length ? [resolvedSourceUri, ...uris] : [resolvedSourceUri];
    const paths = new Set(resolvedUris.map(uri => uri.path));

    // Delete the paths
    yield* deletePaths(paths).pipe(
      Effect.catchTag('SourceTrackingConflictError', (error: SourceTrackingConflictError) => {
        const message = `${nls.localize('delete_source_conflicts_detected')} Conflicts: ${error.conflicts.join(', ')}`;
        return Effect.all([
          channelService.appendToChannel(message),
          channelService.getChannel.pipe(Effect.map(channel => channel.show())),
          Effect.promise(() => vscode.window.showErrorMessage(message))
        ]);
      }),
      Effect.catchTag('DeleteSourceFailedError', (error: DeleteSourceFailedError) => {
        const errorMessage = error.cause?.message ?? nls.localize('delete_failed', 'Unknown error');
        return Effect.all([
          channelService.appendToChannel(errorMessage),
          ...(error.result
            ? [formatDeployOutput(error.result).pipe(Effect.flatMap(o => channelService.appendToChannel(o)))]
            : []),
          channelService.getChannel.pipe(Effect.map(channel => channel.show())),
          Effect.promise(() => vscode.window.showErrorMessage(errorMessage))
        ]);
      }),
      Effect.catchAll(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return Effect.all([
          channelService.appendToChannel(`Delete failed: ${errorMessage}`),
          channelService.getChannel.pipe(Effect.map(channel => channel.show())),
          Effect.promise(() => vscode.window.showErrorMessage(errorMessage))
        ]);
      })
    );
  }).pipe(Effect.provide(AllServicesLayer), Effect.runPromise);
