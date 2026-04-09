/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getConflictStateRef } from '../conflict/conflictTreeProvider';
import { CONFLICTS_VIEW_ID, conflictTreeProvider, ensureConflictView } from '../conflict/conflictView';
import { nls } from '../messages';
import { diffComponentSet } from '../shared/diff/diffComponentSet';
import { resolveDiffUrisForWorkbench } from '../shared/diff/sourceDiffVirtualDocument';

// TODO: this might belong on fsService as an option for readDirectory
/** Recursively get all file URIs from a directory */
const getAllFileUrisFromMaybeDirectory: (
  uri: URI
) => Effect.Effect<URI[], Error, ExtensionProviderService | FsService> = Effect.fn('getAllFileUrisFromDirectory')(
  function* (uri: URI) {
    yield* Effect.annotateCurrentSpan({ uri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    if (!(yield* api.services.FsService.isDirectory(uri))) {
      return [uri];
    }
    const childUris = yield* api.services.FsService.readDirectory(uri);

    const subdirFiles = yield* Effect.all(
      childUris.map(child => getAllFileUrisFromMaybeDirectory(child)),
      { concurrency: 'unbounded' }
    );
    return subdirFiles.flat();
  }
);

/** Diff source paths from the default org */
const sourceDiffCoreEffect = Effect.fn('sourceDiffCore')(function* (sourceUri: URI, uris: URI[]) {
  yield* Effect.annotateCurrentSpan({ sourceUri, uris });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  const componentSetService = yield* api.services.ComponentSetService;
  const allUris = [sourceUri, ...uris];
  const hashableUris = HashSet.fromIterable(allUris.map(fsService.HashableUri.fromUri));
  const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
    yield* componentSetService.getComponentSetFromUris(allUris)
  );
  yield* Effect.annotateCurrentSpan({ allUris });

  const diffsOpen = (yield* diffComponentSet({ componentSet, initialUris: hashableUris })).toSorted((a, b) =>
    a.fileName.localeCompare(b.fileName)
  );
  const firstPair = diffsOpen[0];

  if (firstPair) {
    const title = nls.localize('source_diff_title', 'remote', firstPair.fileName, firstPair.fileName);
    const { left, right } = yield* Effect.promise(() =>
      resolveDiffUrisForWorkbench(firstPair.remoteUri, firstPair.localUri)
    );
    yield* Effect.sync(() => void vscode.commands.executeCommand('vscode.diff', left, right, title));
  }

  if (diffsOpen.length >= 2) {
    yield* ensureConflictView();
    yield* SubscriptionRef.update(getConflictStateRef(), () => ({
      title: `${diffsOpen.length} file differences`,
      mode: 'diffs' as const,
      entries: diffsOpen,
      emptyLabel: nls.localize('conflict_detect_no_differences')
    }));
    conflictTreeProvider.fireChange();
    yield* Effect.sync(() => void vscode.commands.executeCommand(`${CONFLICTS_VIEW_ID}.focus`));
  }
});

export const sourceDiffCommand = Effect.fn('sourceDiff')(function* (
  sourceUri: URI | undefined,
  uris: URI[] | undefined
) {
  yield* Effect.annotateCurrentSpan({ sourceUri, uris });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const resolvedSourceUri =
    sourceUri ??
    (yield* api.services.EditorService.getActiveEditorUri().pipe(
      Effect.withSpan('resolveSourceUri', { attributes: { sourceUri, uris } }),
      Effect.catchTag('NoActiveEditorError', () =>
        Effect.promise(() => vscode.window.showErrorMessage(nls.localize('source_diff_unsupported_type'))).pipe(
          Effect.as(undefined)
        )
      )
    ));

  if (!resolvedSourceUri) {
    return;
  }

  yield* api.services.ProjectService.ensureInPackageDirectories([resolvedSourceUri, ...(uris ?? [])]);

  yield* Effect.annotateCurrentSpan({ resolvedSourceUri });
  const resolvedUris = uris?.length ? uris : [resolvedSourceUri];
  const allUrisToExpand = uris?.length ? [resolvedSourceUri, ...resolvedUris] : resolvedUris;
  const expandedUris = (yield* Effect.all(allUrisToExpand.map(getAllFileUrisFromMaybeDirectory), {
    concurrency: 'unbounded'
  })).flat();
  const expandedSourceUri = expandedUris[0] ?? resolvedSourceUri;
  const remainingExpandedUris = expandedUris.slice(1);
  yield* sourceDiffCoreEffect(expandedSourceUri, remainingExpandedUris).pipe(
    Effect.catchAll((error: unknown) =>
      Effect.gen(function* () {
        const channelService = yield* api.services.ChannelService;
        const errorMessage = error instanceof Error ? error.message : String(error);
        yield* channelService.appendToChannel(`Diff failed: ${errorMessage}`);
        yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
        yield* Effect.promise(() => vscode.window.showErrorMessage(nls.localize('source_diff_failed', errorMessage)));
      }).pipe(Effect.asVoid)
    )
  );
});
