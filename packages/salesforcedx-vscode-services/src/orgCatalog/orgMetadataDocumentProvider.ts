/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as Runtime from 'effect/Runtime';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getActiveMetadataOperationRef } from '../core/activeMetadataOperationRef';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { MetadataChangeNotificationService } from '../core/metadataChangeNotificationService';
import { FileChangePubSub, type FileChangeEvent } from '../vscode/fileChangePubSub';
import { WorkspaceService } from '../vscode/workspaceService';
import { OrgMetadataCatalog } from './orgMetadataCatalog';
import { OrgMetadataCatalogChangePubSub, type OrgMetadataCatalogChange } from './orgMetadataCatalogChangePubSub';
import { isOrgMetadataCatalogUri } from './orgMetadataCatalogStore';
import {
  ORG_METADATA_SCHEME,
  OrgMetadataReferenceService,
  type OrgMetadataDocumentLocation
} from './orgMetadataReference';
import { isOrgMetadataShadowUri } from './orgMetadataShadowStore';

/** @internal Exported for focused provider lifecycle tests; not part of the extension API. */
export class OrgMetadataDocumentProvider implements vscode.TextDocumentContentProvider {
  private readonly changeEmitter = new vscode.EventEmitter<URI>();
  private readonly requestedUris = new Map<string, URI>();

  public readonly onDidChange = this.changeEmitter.event;

  constructor(private readonly readDocument: (uri: URI) => Promise<string>) {}

  public provideTextDocumentContent(uri: URI): Promise<string> {
    this.requestedUris.set(uri.toString(), uri);
    return this.readDocument(uri);
  }

  public notifyCatalogChanged(
    activeOrgId: string | undefined,
    parseDocumentUri: (uri: URI) => OrgMetadataDocumentLocation | undefined
  ): void {
    this.requestedUris.forEach(uri => {
      if (parseDocumentUri(uri)?.orgId === activeOrgId) this.changeEmitter.fire(uri);
    });
  }

  public removeInactiveOrgUris(
    activeOrgId: string | undefined,
    parseDocumentUri: (uri: URI) => OrgMetadataDocumentLocation | undefined
  ): void {
    this.requestedUris.forEach((uri, key) => {
      if (parseDocumentUri(uri)?.orgId !== activeOrgId) this.requestedUris.delete(key);
    });
  }

  public dispose(): void {
    this.requestedUris.clear();
    this.changeEmitter.dispose();
  }
}

const tabInputUris = (input: unknown): readonly URI[] => {
  if (input instanceof vscode.TabInputText) return [input.uri];
  if (input instanceof vscode.TabInputTextDiff) return [input.original, input.modified];
  return [];
};

/** @internal Exported for focused provider lifecycle tests; not part of the extension API. */
export const closeInactiveOrgDocuments = (
  activeOrgId: string | undefined,
  parseDocumentUri: (uri: URI) => OrgMetadataDocumentLocation | undefined
) =>
  Effect.gen(function* () {
    const tabGroups = vscode.window.tabGroups;
    if (!tabGroups) return;
    const tabs = tabGroups.all.flatMap(group =>
      group.tabs.filter(tab =>
        tabInputUris(tab.input).some(uri => {
          const location = parseDocumentUri(URI.parse(uri.toString()));
          return location !== undefined && location.orgId !== activeOrgId;
        })
      )
    );
    if (tabs.length > 0) {
      yield* Effect.tryPromise(() => tabGroups.close(tabs, true)).pipe(Effect.asVoid);
    }
  });

/**
 * Owns the read-only VS Code document projection and catalog invalidation
 * lifecycle. It intentionally registers only a TextDocumentContentProvider:
 * org metadata is not exposed as a filesystem.
 */
export const runOrgMetadataDocumentProvider = Effect.fn('runOrgMetadataDocumentProvider')(function* () {
  const [
    catalog,
    catalogChanges,
    fileChanges,
    metadataChanges,
    referenceService,
    defaultOrgRef,
    activeOperationRef,
    workspace
  ] = yield* Effect.all([
    OrgMetadataCatalog,
    OrgMetadataCatalogChangePubSub,
    FileChangePubSub,
    MetadataChangeNotificationService,
    OrgMetadataReferenceService,
    getDefaultOrgRef(),
    getActiveMetadataOperationRef(),
    WorkspaceService.pipe(Effect.flatMap(service => service.getWorkspaceInfoOrThrow()))
  ]);
  const runtime = yield* Effect.runtime();
  const provider = new OrgMetadataDocumentProvider(uri => Runtime.runPromise(runtime)(catalog.readDocumentUri(uri)));
  const registration = vscode.workspace.registerTextDocumentContentProvider(ORG_METADATA_SCHEME, provider);
  const pendingOperationWorkspaceEvents = yield* Ref.make<readonly FileChangeEvent[]>([]);

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      registration.dispose();
      provider.dispose();
    })
  );
  yield* Effect.forkScoped(
    catalogChanges.pipe(
      Stream.fromPubSub<OrgMetadataCatalogChange>,
      Stream.runForEach(change =>
        Effect.gen(function* () {
          const activeOrgId = (yield* SubscriptionRef.get(defaultOrgRef)).orgId;
          const changedOrgId =
            change.kind === 'org' || change.kind === 'tracking'
              ? change.orgId
              : change.kind === 'operation'
                ? change.event.orgId
                : activeOrgId;
          if (changedOrgId === activeOrgId) {
            yield* Effect.sync(() => provider.notifyCatalogChanged(activeOrgId, referenceService.parseDocumentUri));
          }
        })
      )
    )
  );

  const workspaceChanges = Stream.fromPubSub(fileChanges).pipe(
    Stream.filter(
      event => !isOrgMetadataShadowUri(workspace.uri, event.uri) && !isOrgMetadataCatalogUri(workspace.uri, event.uri)
    ),
    Stream.mapEffect(event =>
      SubscriptionRef.get(activeOperationRef).pipe(Effect.map(activeOperations => ({ activeOperations, event })))
    ),
    Stream.groupedWithin(1000, Duration.millis(100)),
    Stream.mapEffect(batch =>
      Effect.gen(function* () {
        const tagged = Chunk.toArray(batch);
        const duringOperation = tagged.filter(({ activeOperations }) => activeOperations > 0).map(({ event }) => event);
        const independent = tagged.filter(({ activeOperations }) => activeOperations === 0).map(({ event }) => event);
        if (duringOperation.length > 0) {
          yield* Ref.update(pendingOperationWorkspaceEvents, pending => [...pending, ...duringOperation]);
        }
        const unmatchedIndependent =
          independent.length > 0 ? yield* metadataChanges.dedupeWorkspaceEvents(independent) : independent;
        return unmatchedIndependent.length > 0
          ? Option.some<OrgMetadataCatalogChange>({ kind: 'workspace', events: unmatchedIndependent })
          : Option.none<OrgMetadataCatalogChange>();
      })
    ),
    Stream.filterMap(option => option)
  );

  const completedOperationWorkspaceChanges = activeOperationRef.changes.pipe(
    Stream.filter(activeOperations => activeOperations === 0),
    Stream.mapEffect(() =>
      Effect.sleep(Duration.millis(125)).pipe(
        Effect.andThen(Ref.getAndSet(pendingOperationWorkspaceEvents, [])),
        Effect.flatMap(metadataChanges.dedupeWorkspaceEvents),
        Effect.map(events =>
          events.length > 0
            ? Option.some<OrgMetadataCatalogChange>({ kind: 'workspace', events })
            : Option.none<OrgMetadataCatalogChange>()
        )
      )
    ),
    Stream.filterMap(option => option)
  );

  const changeStreams: readonly Stream.Stream<OrgMetadataCatalogChange>[] = [
    workspaceChanges,
    completedOperationWorkspaceChanges,
    defaultOrgRef.changes.pipe(Stream.map(org => ({ kind: 'org', orgId: org.orgId })))
  ];

  const handleCatalogChange = Effect.fn('OrgMetadataDocumentProvider.handleCatalogChange')(function* (
    change: OrgMetadataCatalogChange
  ) {
    yield* Effect.annotateCurrentSpan('changeKind', change.kind);
    if (change.kind === 'workspace') {
      yield* Effect.annotateCurrentSpan('workspaceEventCount', change.events.length);
    }
    if (change.kind === 'org') {
      yield* Effect.sync(() => provider.removeInactiveOrgUris(change.orgId, referenceService.parseDocumentUri));
      yield* closeInactiveOrgDocuments(change.orgId, referenceService.parseDocumentUri).pipe(
        Effect.catchAll(error => Effect.logWarning('Unable to close inactive org metadata documents', error))
      );
    }
    if (change.kind === 'workspace' || (change.kind === 'org' && change.orgId !== undefined)) {
      yield* catalog
        .invalidate()
        .pipe(Effect.catchAll(error => Effect.logWarning('Unable to invalidate org metadata catalog', error)));
    }
    yield* PubSub.publish(catalogChanges, change);
  });

  yield* Stream.mergeAll(changeStreams, { concurrency: 'unbounded' }).pipe(Stream.runForEach(handleCatalogChange));
});
