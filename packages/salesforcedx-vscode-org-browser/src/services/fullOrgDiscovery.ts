/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import type { OrgMetadataCatalog, OrgMetadataCatalogEntry } from 'salesforcedx-vscode-services';
import { isFolderType } from '../tree/orgBrowserNode';

export type FullOrgDiscoveryProgress = {
  readonly completed: number;
  readonly total: number;
  readonly componentCompleted: number;
  readonly componentTotal: number;
};

const componentEntries = (entries: readonly OrgMetadataCatalogEntry[]) =>
  entries.filter(
    (entry): entry is OrgMetadataCatalogEntry & { readonly reference: { readonly fullName: string } } =>
      entry.kind === 'component' && Boolean(entry.reference.fullName)
  );

const folderEntries = (entries: readonly OrgMetadataCatalogEntry[]) =>
  entries.filter(
    (entry): entry is OrgMetadataCatalogEntry & { readonly reference: { readonly fullName: string } } =>
      entry.kind === 'folder' && Boolean(entry.reference.fullName)
  );

/** Acquires every branch that the Org Browser currently exposes, without changing the view state. */
export const discoverFullOrgMetadata = (
  catalog: OrgMetadataCatalog,
  reportProgress: (progress: FullOrgDiscoveryProgress) => void
) =>
  Effect.gen(function* () {
    const roots = yield* catalog.getChildren();
    const types = roots.filter(
      (entry): entry is OrgMetadataCatalogEntry & { readonly reference: { readonly type: string } } =>
        entry.kind === 'type' && Boolean(entry.reference.type)
    );
    const completed = yield* Ref.make(0);
    const componentCompleted = yield* Ref.make(0);
    const componentTotal = yield* Ref.make(0);
    const report = () =>
      Effect.all([Ref.get(completed), Ref.get(componentCompleted), Ref.get(componentTotal)]).pipe(
        Effect.tap(([current, nestedCompleted, nestedTotal]) =>
          Effect.sync(() =>
            reportProgress({
              completed: current,
              total: types.length,
              componentCompleted: nestedCompleted,
              componentTotal: nestedTotal
            })
          )
        )
      );
    const continueAfterFailure = (error: unknown) =>
      Effect.logWarning('Failed to discover Org Browser metadata branch', error);
    const discoverFolder: (
      type: string,
      fullName: string,
      reportFolderCompleted: () => Effect.Effect<void>
    ) => Effect.Effect<void, unknown, never> = Effect.fn('discoverFullOrgMetadata.folder')(function* (
      type: string,
      fullName: string,
      reportFolderCompleted: () => Effect.Effect<void>
    ) {
      const children = yield* catalog.getChildren({ type, fullName });
      const folders = folderEntries(children);
      yield* Ref.update(componentTotal, current => current + folders.length);
      yield* report();
      yield* Effect.forEach(
        folders,
        folder =>
          discoverFolder(type, folder.reference.fullName, reportFolderCompleted).pipe(
            Effect.catchAll(continueAfterFailure)
          ),
        { concurrency: 5, discard: true }
      );
      yield* reportFolderCompleted();
    });
    yield* report();

    yield* Effect.forEach(
      types,
      type =>
        Effect.gen(function* () {
          const children = yield* catalog.getChildren({ type: type.reference.type });
          if (isFolderType(type.reference.type)) {
            const folders = folderEntries(children);
            const reportFolderCompleted = () =>
              Ref.update(componentCompleted, current => current + 1).pipe(Effect.zipRight(report()));
            yield* Ref.update(componentTotal, current => current + folders.length);
            yield* report();
            yield* Effect.forEach(
              folders,
              folder =>
                discoverFolder(type.reference.type, folder.reference.fullName, reportFolderCompleted).pipe(
                  Effect.catchAll(continueAfterFailure)
                ),
              { concurrency: 5, discard: true }
            );
          } else if (type.reference.type === 'CustomObject') {
            const customObjects = componentEntries(children);
            yield* Ref.update(componentTotal, current => current + customObjects.length);
            yield* report();
            yield* Effect.forEach(
              customObjects,
              component =>
                catalog
                  .getChildren({ type: 'CustomObject', fullName: component.reference.fullName })
                  .pipe(
                    Effect.catchAll(continueAfterFailure),
                    Effect.ensuring(
                      Ref.update(componentCompleted, current => current + 1).pipe(Effect.zipRight(report()))
                    )
                  ),
              { concurrency: 5, discard: true }
            );
          }
        }).pipe(
          Effect.catchAll(continueAfterFailure),
          Effect.ensuring(Ref.update(completed, current => current + 1).pipe(Effect.zipRight(report())))
        ),
      { concurrency: 10, discard: true }
    );
  }).pipe(
    Effect.catchAll(error => Effect.logWarning('Failed to discover Org Browser metadata branch', error)),
    Effect.withSpan('OrgBrowser.fullMetadataDiscovery')
  );
