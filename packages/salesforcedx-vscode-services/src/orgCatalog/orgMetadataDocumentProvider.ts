/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as PubSub from 'effect/PubSub';
import * as Runtime from 'effect/Runtime';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { FileChangePubSub } from '../vscode/fileChangePubSub';
import { OrgMetadataCatalog } from './orgMetadataCatalog';
import { OrgMetadataCatalogChangePubSub } from './orgMetadataCatalogChangePubSub';
import { ORG_METADATA_SCHEME, parseOrgMetadataDocumentUri } from './orgMetadataReference';

class OrgMetadataDocumentProvider implements vscode.TextDocumentContentProvider {
  private readonly changeEmitter = new vscode.EventEmitter<URI>();
  private readonly requestedUris = new Map<string, URI>();

  public readonly onDidChange = this.changeEmitter.event;

  constructor(private readonly readDocument: (uri: URI) => Promise<string>) {}

  public provideTextDocumentContent(uri: URI): Promise<string> {
    this.requestedUris.set(uri.toString(), uri);
    return this.readDocument(uri);
  }

  public notifyCatalogChanged(): void {
    this.requestedUris.forEach(uri => this.changeEmitter.fire(uri));
  }

  public dispose(): void {
    this.requestedUris.clear();
    this.changeEmitter.dispose();
  }
}

const closeInactiveOrgDocuments = (activeOrgId: string | undefined) =>
  Effect.gen(function* () {
    const tabGroups = vscode.window.tabGroups;
    if (!tabGroups) return;
    const tabs = tabGroups.all.flatMap(group =>
      group.tabs.filter(tab => {
        if (!(tab.input instanceof vscode.TabInputText)) return false;
        const location = parseOrgMetadataDocumentUri(URI.parse(tab.input.uri.toString()));
        return location !== undefined && location.orgId !== activeOrgId;
      })
    );
    if (tabs.length > 0) {
      yield* Effect.promise(() => tabGroups.close(tabs, true)).pipe(Effect.asVoid);
    }
  });

/**
 * Owns the read-only VS Code document projection and catalog invalidation
 * lifecycle. It intentionally registers only a TextDocumentContentProvider:
 * org metadata is not exposed as a filesystem.
 */
export const runOrgMetadataDocumentProvider = Effect.fn('runOrgMetadataDocumentProvider')(function* () {
  const [catalog, catalogChanges, fileChanges, defaultOrgRef] = yield* Effect.all([
    OrgMetadataCatalog,
    OrgMetadataCatalogChangePubSub,
    FileChangePubSub,
    getDefaultOrgRef()
  ]);
  const runtime = yield* Effect.runtime();
  const provider = new OrgMetadataDocumentProvider(uri => Runtime.runPromise(runtime)(catalog.readDocumentUri(uri)));
  const registration = vscode.workspace.registerTextDocumentContentProvider(ORG_METADATA_SCHEME, provider);

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => {
      registration.dispose();
      provider.dispose();
    })
  );

  yield* Stream.merge(
    Stream.fromPubSub(fileChanges).pipe(Stream.map(event => ({ kind: 'workspace' as const, event }))),
    defaultOrgRef.changes.pipe(Stream.map(org => ({ kind: 'org' as const, orgId: org.orgId })))
  ).pipe(
    Stream.runForEach(change =>
      Effect.gen(function* () {
        yield* catalog.invalidate();
        if (change.kind === 'org') {
          yield* closeInactiveOrgDocuments(change.orgId);
        }
        yield* PubSub.publish(catalogChanges, change);
        yield* Effect.sync(() => provider.notifyCatalogChanged());
      })
    )
  );
});
