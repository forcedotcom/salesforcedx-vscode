/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Queue from 'effect/Queue';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import {
  closeInactiveOrgDocuments,
  isCatalogRelevantWorkspaceUri,
  OrgMetadataDocumentProvider,
  runOrgMetadataDocumentProvider
} from '../../../src/orgCatalog/orgMetadataDocumentProvider';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { MetadataChangeNotificationService } from '../../../src/core/metadataChangeNotificationService';
import { OrgId } from '../../../src/core/schemas/salesforceId';
import { OrgCatalogDocuments } from '../../../src/orgCatalog/orgCatalogDocuments';
import { OrgCatalogState } from '../../../src/orgCatalog/orgCatalogState';
import { OrgMetadataCatalogChangePubSub } from '../../../src/orgCatalog/orgMetadataCatalogChangePubSub';
import { FileChangePubSub } from '../../../src/vscode/fileChangePubSub';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

const setOrg = (orgId: string) =>
  getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, { orgId: Schema.decodeSync(OrgId)(orgId) })));

const makeHarness = (isEmpty: boolean) => {
  const invalidateOrgInventories = vi.fn(() => Effect.void);
  const invalidateWorkspaceInventories = vi.fn(() => Effect.void);
  const readDocumentUri = vi.fn(() => Effect.succeed('body'));
  const layer = Layer.mergeAll(
    Layer.mock(OrgCatalogDocuments, { _tag: 'OrgCatalogDocuments', readDocumentUri }),
    Layer.mock(OrgCatalogState, {
      _tag: 'OrgCatalogState',
      ensureHydrated: () => Effect.void,
      invalidateOrgInventories,
      invalidateWorkspaceInventories,
      persistOrg: () => Effect.void
    }),
    OrgMetadataCatalogChangePubSub.Default,
    FileChangePubSub.Default,
    MetadataChangeNotificationService.Default,
    Layer.mock(WorkspaceService, {
      _tag: 'WorkspaceService',
      getWorkspaceInfo: () =>
        Effect.succeed({
          uri: URI.file('/workspace'),
          path: '/workspace',
          fsPath: '/workspace',
          isEmpty,
          isVirtualFs: false,
          cwd: '/workspace'
        })
    })
  );
  return { invalidateOrgInventories, invalidateWorkspaceInventories, layer, readDocumentUri };
};

const documentUri = (orgId: string, fullName: string): URI =>
  URI.parse(`sf-org-metadata:/orgs/${orgId}/ApexClass/${fullName}.cls`);

describe('OrgMetadataDocumentProvider lifecycle', () => {
  afterEach(() => {
    Object.defineProperty(vscode.window, 'tabGroups', { configurable: true, value: undefined });
  });

  it('keeps the provider alive across org changes when no workspace is open', async () => {
    const { layer, readDocumentUri } = makeHarness(true);
    let provider: OrgMetadataDocumentProvider | undefined;
    vi.mocked(vscode.workspace.registerTextDocumentContentProvider).mockImplementation((_scheme, value) => {
      provider = value as OrgMetadataDocumentProvider;
      return { dispose: vi.fn() };
    });

    const result = await Effect.gen(function* () {
      yield* setOrg('00D000000000001');
      const subscription = yield* PubSub.subscribe(yield* OrgMetadataCatalogChangePubSub);
      yield* Effect.forkScoped(runOrgMetadataDocumentProvider());
      yield* Queue.take(subscription);
      const registeredProvider = provider;
      if (!registeredProvider) return yield* Effect.die('document provider was not registered');
      const staleUri = documentUri('00D000000000001', 'Stale');
      const activeUri = documentUri('00D000000000002', 'Active');
      const contents = yield* Effect.all(
        [staleUri, activeUri].map(uri => Effect.tryPromise(() => registeredProvider.provideTextDocumentContent(uri))),
        { concurrency: 'unbounded' }
      );
      yield* setOrg('00D000000000002');
      const transition = yield* Queue.take(subscription);
      const requestedUris = registeredProvider.requestedUriEntries().map(([, uri]) => uri.toString());
      yield* setOrg('00D000000000003');
      return { contents, requestedUris, transition, subsequentTransition: yield* Queue.take(subscription) };
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.timeout('2 seconds'), Effect.runPromise);

    expect(result.contents).toEqual(['body', 'body']);
    expect(result.transition).toEqual({ kind: 'org', orgId: '00D000000000002' });
    expect(result.requestedUris).toEqual([documentUri('00D000000000002', 'Active').toString()]);
    expect(result.subsequentTransition).toEqual({ kind: 'org', orgId: '00D000000000003' });
    expect(readDocumentUri).toHaveBeenCalledWith(
      '00D000000000001',
      expect.objectContaining({ path: '/orgs/00D000000000001/ApexClass/Stale.cls' })
    );
  });

  it('invalidates workspace inventory and publishes source and sidecar deletion notifications', async () => {
    const { invalidateWorkspaceInventories, layer } = makeHarness(false);
    vi.mocked(vscode.workspace.registerTextDocumentContentProvider).mockReturnValue({ dispose: vi.fn() });
    const events = [
      { type: 'delete' as const, uri: URI.file('/workspace/force-app/main/default/classes/FileUtilitiesTest.cls') },
      {
        type: 'delete' as const,
        uri: URI.file('/workspace/force-app/main/default/classes/FileUtilitiesTest.cls-meta.xml')
      }
    ];
    const event = await Effect.gen(function* () {
      yield* setOrg('00D000000000001');
      const subscription = yield* PubSub.subscribe(yield* OrgMetadataCatalogChangePubSub);
      const fileChanges = yield* FileChangePubSub;
      yield* Effect.forkScoped(runOrgMetadataDocumentProvider());
      yield* Queue.take(subscription); // provider's initial active-org observation
      yield* Effect.sync(() => invalidateWorkspaceInventories.mockClear());
      yield* PubSub.publishAll(fileChanges, events);
      return yield* Queue.take(subscription);
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.timeout('2 seconds'), Effect.runPromise);

    expect(invalidateWorkspaceInventories).toHaveBeenCalledWith('00D000000000001');
    expect(event).toEqual({ kind: 'workspace', events });
  });

  it('prunes inactive-org URIs and only notifies documents for the active org', async () => {
    const provider = new OrgMetadataDocumentProvider(async () => 'body');
    const orgOneUri = documentUri('org-one', 'One');
    const orgTwoUri = documentUri('org-two', 'Two');
    const notified: string[] = [];
    provider.onDidChange(uri => notified.push(uri.toString()));

    await provider.provideTextDocumentContent(orgOneUri);
    await provider.provideTextDocumentContent(orgTwoUri);
    const orgIds = new Map([
      [orgOneUri.toString(), 'org-one'],
      [orgTwoUri.toString(), 'org-two']
    ]);
    provider.removeInactiveOrgUris('org-two', orgIds);
    provider.notifyCatalogChanged('org-two', orgIds);
    provider.notifyCatalogChanged('org-one', orgIds);

    expect(notified).toEqual([orgTwoUri.toString()]);
    provider.dispose();
  });

  it('closes stale text and diff tabs while preserving tabs for the active org', async () => {
    const staleTextTab = { input: new vscode.TabInputText(documentUri('org-one', 'One')) } as vscode.Tab;
    const activeTextTab = { input: new vscode.TabInputText(documentUri('org-two', 'Two')) } as vscode.Tab;
    const staleDiffTab = {
      input: new vscode.TabInputTextDiff(
        documentUri('org-one', 'RemoteOne'),
        URI.file('/workspace/force-app/main/default/classes/One.cls')
      )
    } as vscode.Tab;
    const close = vi.fn(async () => true);
    Object.defineProperty(vscode.window, 'tabGroups', {
      configurable: true,
      value: {
        all: [{ tabs: [staleTextTab, activeTextTab, staleDiffTab] }],
        close
      }
    });

    await Effect.runPromise(closeInactiveOrgDocuments('org-two'));

    expect(close).toHaveBeenCalledWith([staleTextTab, staleDiffTab], true);
  });

  it('ignores internal Salesforce state with Windows drive-letter casing differences', () => {
    const workspaceUri = URI.parse('file:///C:/workspace');

    expect(
      isCatalogRelevantWorkspaceUri(
        workspaceUri,
        URI.parse('file:///c:/workspace/.sf/orgs/00D/metadata-catalog/catalog.json')
      )
    ).toBe(false);
    expect(
      isCatalogRelevantWorkspaceUri(workspaceUri, URI.parse('file:///c:/workspace/force-app/main/default/Foo.cls'))
    ).toBe(true);
  });
});
