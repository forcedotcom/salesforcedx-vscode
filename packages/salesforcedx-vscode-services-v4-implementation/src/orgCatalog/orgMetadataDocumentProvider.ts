/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ActiveMetadataOperationRef,
  FileChangePubSub,
  MetadataChangeNotificationService,
  ORG_METADATA_SCHEME,
  OrgMetadataCatalogChangePubSub,
  TargetOrgRef,
  WorkspaceService,
  orgIdFromOrgMetadataUri,
  type FileChangeEvent
} from '@salesforce/vscode-services-v2';
import { isUriEqualOrWithin } from '@salesforce/vscode-services-v2/uriComparison';
import type * as Context from 'effect/Context';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as HashMap from 'effect/HashMap';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { makeScopedFibers } from '../scopedFiber.js';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { OrgChanges } from '../targetOrgRef.js';
import { OrgCatalogDocuments } from './orgCatalogDocuments.js';
import { makeOrgCatalogOrg, type CatalogOrg } from './orgCatalogOrg.js';
import { OrgCatalogState } from './orgCatalogState.js';

/** Internal Salesforce state must not invalidate the catalog that produced it. */
const isCatalogRelevantWorkspaceUri = (workspaceUri: URI, uri: URI) =>
  !isUriEqualOrWithin(Utils.joinPath(workspaceUri, '.sf'), uri);
const tabInputUris = (input: unknown): readonly URI[] =>
  input instanceof vscode.TabInputText
    ? [input.uri]
    : input instanceof vscode.TabInputTextDiff
      ? [input.original, input.modified]
      : [];
const closeInactiveOrgDocuments = Effect.fn('OrgMetadataDocumentProvider.closeInactiveOrgDocuments')(function* (
  activeOrgId: string | undefined
) {
  const groups = vscode.window.tabGroups;
  if (!groups) return;
  const tabs = groups.all
    .flatMap(group => group.tabs)
    .filter(tab =>
      tabInputUris(tab.input).some(uri => {
        const orgId = orgIdFromOrgMetadataUri(URI.parse(uri.toString()));
        return orgId !== undefined && orgId !== activeOrgId;
      })
    );
  if (tabs.length > 0)
    yield* Effect.tryPromise(() => groups.close(tabs, true)).pipe(
      Effect.asVoid,
      Effect.catchTag('UnknownError', error =>
        Effect.logWarning('Unable to close inactive org metadata documents', error)
      )
    );
});
/** External VS Code callback boundary; the supplied read closes over the one scope-owned graph. */
const textDocumentProvider = <E>(
  read: (uri: URI) => Effect.Effect<string, E>,
  onDidChange: vscode.Event<URI>,
  context: Context.Context<never>
): vscode.TextDocumentContentProvider => ({
  onDidChange,
  provideTextDocumentContent: uri => Effect.runPromiseWith(context)(read(URI.parse(uri.toString())))
});

const registerOrgMetadataDocumentProvider = Effect.gen(function* () {
  const documents = yield* OrgCatalogDocuments;
  const state = yield* OrgCatalogState;
  const catalogChanges = yield* OrgMetadataCatalogChangePubSub;
  const fileChanges = yield* FileChangePubSub;
  const metadataChanges = yield* MetadataChangeNotificationService;
  const orgRef = yield* TargetOrgRef;
  const active = yield* ActiveMetadataOperationRef;
  const workspace = yield* WorkspaceService;
  const changes = yield* OrgChanges;
  const orgs = yield* makeOrgCatalogOrg;
  const operations = yield* ServiceOperations;
  const fibers = yield* makeScopedFibers;
  const context = yield* Effect.context<never>();
  const requested = yield* Ref.make(HashMap.empty<string, URI>());
  const pending = yield* Ref.make<readonly { readonly event: FileChangeEvent; readonly org: CatalogOrg | undefined }[]>(
    []
  );
  const ready = yield* Deferred.make<void>();
  const emitter = yield* Effect.acquireRelease(
    Effect.sync(() => new vscode.EventEmitter<URI>()),
    value => Effect.sync(() => value.dispose())
  );
  yield* Effect.addFinalizer(() => Ref.set(requested, HashMap.empty()));
  const readDocument = Effect.fn('OrgMetadataDocumentProvider.readDocument')(function* (uri: URI) {
    const snapshot = yield* changes.snapshot;
    const orgId = snapshot.org.orgId;
    if (!orgId) return yield* Effect.fail(vscode.FileSystemError.FileNotFound(uri));
    yield* Ref.update(requested, current => HashMap.set(current, uri.toString(), uri));
    return yield* documents.readDocumentUri(orgId, uri);
  }, operations.run);
  yield* Effect.acquireRelease(
    Effect.sync(() =>
      vscode.workspace.registerTextDocumentContentProvider(
        ORG_METADATA_SCHEME,
        textDocumentProvider(readDocument, emitter.event, context)
      )
    ),
    value =>
      Effect.sync(() => {
        value.dispose();
      })
  );
  // Subscribe before exposing the registration as ready; no first notification/file event is lost.
  const catalogSubscription = yield* PubSub.subscribe(catalogChanges);
  const fileSubscription = yield* PubSub.subscribe(fileChanges);
  yield* Stream.fromSubscription(catalogSubscription).pipe(
    Stream.runForEach(change =>
      Effect.gen(function* () {
        const orgId = (yield* changes.snapshot).org.orgId;
        const changedOrg =
          change.kind === 'org' || change.kind === 'tracking'
            ? change.orgId
            : change.kind === 'operation'
              ? change.event.orgId
              : orgId;
        if (changedOrg !== orgId) return;
        yield* Ref.get(requested).pipe(
          Effect.flatMap(uris =>
            Effect.sync(() => {
              HashMap.toValues(uris)
                .filter(uri => orgIdFromOrgMetadataUri(uri) === orgId)
                .forEach(uri => emitter.fire(uri));
            })
          )
        );
      })
    ),
    fibers.fork
  );
  const invalidate = Effect.fn('OrgMetadataDocumentProvider.invalidate')(function* (
    org: CatalogOrg,
    mode: 'org' | 'workspace'
  ) {
    yield* state.ensureHydrated(org.orgId);
    yield* state.withOrgInvalidation(org.orgId, mode, program => orgs.commit(org, program));
    yield* state.persistOrg(org.orgId);
  });
  yield* SubscriptionRef.changes(orgRef).pipe(
    Stream.mapEffect(() => changes.snapshot),
    Stream.changesWith((left, right) => left.orgGeneration === right.orgGeneration),
    Stream.runForEach(snapshot =>
      Effect.gen(function* () {
        const orgId = snapshot.org.orgId;
        yield* Ref.update(requested, current => HashMap.filter(current, uri => orgIdFromOrgMetadataUri(uri) === orgId));
        yield* closeInactiveOrgDocuments(orgId);
        if (orgId)
          yield* invalidate({ orgId, orgGeneration: snapshot.orgGeneration }, 'org').pipe(
            Effect.catchTag('InactiveOrgOperationError', () => Effect.void)
          );
        yield* PubSub.publish(catalogChanges, { kind: 'org', orgId });
        yield* Deferred.succeed(ready, undefined);
      })
    ),
    Effect.onExit(exit => (Exit.isFailure(exit) ? Deferred.done(ready, exit) : Deferred.interrupt(ready))),
    fibers.fork
  );
  const applyWorkspaceChanges = Effect.fn('OrgMetadataDocumentProvider.applyWorkspaceChanges')(function* (
    events: readonly { readonly event: FileChangeEvent; readonly org: CatalogOrg | undefined }[]
  ) {
    const current = yield* changes.snapshot;
    const matching = events
      .filter(value => value.org?.orgGeneration === current.orgGeneration && value.org.orgId === current.org.orgId)
      .map(value => value.event);
    if (!current.org.orgId || matching.length === 0) return;
    const unmatched = yield* metadataChanges.dedupeWorkspaceEvents(matching);
    if (unmatched.length === 0) return;
    yield* invalidate({ orgId: current.org.orgId, orgGeneration: current.orgGeneration }, 'workspace').pipe(
      Effect.andThen(PubSub.publish(catalogChanges, { kind: 'workspace', events: unmatched })),
      Effect.catchTag('InactiveOrgOperationError', () => Effect.void)
    );
  });
  yield* Stream.fromSubscription(fileSubscription).pipe(
    Stream.filterEffect(event =>
      workspace
        .getWorkspaceInfo()
        .pipe(Effect.map(info => !info.isEmpty && isCatalogRelevantWorkspaceUri(info.uri, event.uri)))
    ),
    Stream.mapEffect(event =>
      Effect.gen(function* () {
        const snapshot = yield* changes.snapshot;
        return {
          event,
          org: snapshot.org.orgId ? { orgId: snapshot.org.orgId, orgGeneration: snapshot.orgGeneration } : undefined,
          activeOperations: yield* SubscriptionRef.get(active)
        };
      })
    ),
    Stream.groupedWithin(1000, Duration.millis(100)),
    Stream.runForEach(batch =>
      Effect.gen(function* () {
        yield* Ref.update(pending, current => [...current, ...batch.filter(value => value.activeOperations > 0)]);
        yield* applyWorkspaceChanges(batch.filter(value => value.activeOperations === 0));
      })
    ),
    fibers.fork
  );
  yield* SubscriptionRef.changes(active).pipe(
    Stream.filter(count => count === 0),
    Stream.runForEach(() =>
      Effect.sleep(Duration.millis(125)).pipe(
        // The initial zero (or a previous operation's zero) may be followed by a new active operation during the delay.
        // Drain under the existing ref permit without publishing another zero to this same stream.
        Effect.andThen(
          SubscriptionRef.modifySomeEffect(active, count =>
            (count === 0 ? Ref.getAndSet(pending, []) : Effect.succeed([])).pipe(
              Effect.map(events => [events, Option.none<number>()] as const)
            )
          )
        ),
        Effect.flatMap(applyWorkspaceChanges)
      )
    ),
    fibers.fork
  );
  yield* Deferred.await(ready);
  yield* Effect.addFinalizer(() => operations.close);
});
export const OrgMetadataDocumentProviderLayer = Layer.effectDiscard(registerOrgMetadataDocumentProvider).pipe(
  Layer.provideMerge(ServiceOperationsLayer)
);
