/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import type{ FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { nls } from '../messages';
import { AllServicesLayer, ExtensionProviderService } from '../services/extensionProvider';
import { diffComponentSet } from '../shared/diff/diffComponentSet';
import { HashableUri } from '../shared/hashableUri';


// TODO: this might belong on fsService as an option for readDirectory
/** Recursively get all file URIs from a directory */
const getAllFileUrisFromDirectory: (dirUri: URI) => Effect.Effect<URI[], Error, ExtensionProviderService | FsService> = (dirUri: URI) =>
  Effect.gen(function* () {
    yield* Effect.annotateCurrentSpan({ dirUri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const fsService = yield* api.services.FsService;
    if (!(yield* fsService.isDirectory(dirUri))) {
      return [];
    }
    const entries = yield* Effect.tryPromise({
      try: async () => await vscode.workspace.fs.readDirectory(dirUri),
      catch: () => new Error(`Failed to read directory: ${dirUri.toString()}`)
    });
    const fileUris = entries
      .filter(([, type]) => type === vscode.FileType.File)
      .map(([name]) => Utils.joinPath(dirUri, name));
    const dirUris = entries
      .filter(([, type]) => type === vscode.FileType.Directory)
      .map(([name]) => (Utils.joinPath(dirUri, name)));

    const subdirFiles = yield* Effect.all(dirUris.map(uri => getAllFileUrisFromDirectory(uri)), { concurrency: 'unbounded' });
    return [...fileUris, ...subdirFiles.flat()];
  }).pipe(Effect.withSpan('getAllFileUrisFromDirectory'));

/** Expand a URI: if it's a directory, return all file URIs; if it's a file, return the URI itself */
const expandUri = Effect.fn('expandUri')(function* (uri: URI) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  return (yield* fsService.isDirectory(uri))
    ? yield* getAllFileUrisFromDirectory(uri)
    : [uri];
});

/** Diff source paths from the default org */
const sourceDiffEffect = Effect.fn('sourceDiff')(function* (sourceUri: URI, uris: URI[]) {
  yield* Effect.annotateCurrentSpan({ sourceUri, uris });
  const allUris = new Set([sourceUri, ...uris]);
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const componentSetService = yield* api.services.ComponentSetService;
  const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
    yield* componentSetService.getComponentSetFromUris(allUris)
  );
  const hashableUris = HashSet.fromIterable(Array.from(allUris).map(uri => HashableUri.parse(uri.toString())));
  yield* diffComponentSet({ componentSet, initialUris: hashableUris });
});

/** Diff source paths from the default org */
// When a single file is selected and "Diff Source Against Org" is executed,
// sourceUri is passed, and the uris array contains a single element, the same
// path as sourceUri.
//
// When multiple files are selected and "Diff Source Against Org" is executed,
// sourceUri is passed, and is the path to the first selected file, and the uris
// array contains an array of all paths that were selected.
//
// When editing a file and "Diff This Source Against Org" is executed,
// sourceUri is passed, but uris is undefined.

export const sourceDiff = async (sourceUri: URI | undefined, uris: URI[] | undefined): Promise<void> => {
  const resolvedSourceUri =
    sourceUri ??
    (await Effect.runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        return yield* (yield* api.services.EditorService).getActiveEditorUri;
      })
        .pipe(Effect.provide(AllServicesLayer))
        .pipe(
          Effect.catchTag('NoActiveEditorError', () =>
            Effect.promise(() =>
              vscode.window.showErrorMessage(nls.localize('source_diff_unsupported_type'))
            ).pipe(Effect.as(undefined))
          )
        )
    ));

  if (!resolvedSourceUri) {
    return;
  }

  const resolvedUris = uris?.length ? uris : [resolvedSourceUri];
  const allUrisToExpand = uris?.length ? [resolvedSourceUri, ...resolvedUris] : resolvedUris;
  const expandedUris = await Effect.runPromise(
    Effect.gen(function* () {
      const expandedArrays = yield* Effect.all(
        allUrisToExpand.map(uri =>
          expandUri(uri).pipe(Effect.provide(AllServicesLayer))
        ),
        { concurrency: 'unbounded' }
      );
      return expandedArrays.flat();
    })
  );
  const expandedSourceUri = expandedUris[0] ?? resolvedSourceUri;
  const remainingExpandedUris = expandedUris.slice(1);
  await Effect.runPromise(
    sourceDiffEffect(expandedSourceUri, remainingExpandedUris).pipe(
      Effect.catchAll((error: unknown) =>
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          const channelService = yield* api.services.ChannelService;
          const errorMessage = error instanceof Error ? error.message : String(error);
          yield* channelService.appendToChannel(`Diff failed: ${errorMessage}`);
          yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
          yield* Effect.promise(() => vscode.window.showErrorMessage(nls.localize('source_diff_failed', errorMessage)));
        }).pipe(Effect.as(undefined))
      ),
      Effect.provide(AllServicesLayer)
    )
  );
};
