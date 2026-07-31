/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Deferred from 'effect/Deferred';
import * as Either from 'effect/Either';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Queue from 'effect/Queue';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ComponentSetService } from '../../../src/core/componentSetService';
import { ConnectionService } from '../../../src/core/connectionService';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { MetadataChangeNotificationService } from '../../../src/core/metadataChangeNotificationService';
import { MetadataDescribeService } from '../../../src/core/metadataDescribeService';
import { MetadataRegistryService } from '../../../src/core/metadataRegistryService';
import { MetadataRetrieveService } from '../../../src/core/metadataRetrieveService';
import { ProjectService } from '../../../src/core/projectService';
import { SourceTrackingService, type SourceTrackingRemoteChange } from '../../../src/core/sourceTrackingService';
import { TransmogrifierService, type SObject } from '../../../src/core/transmogrifierService';
import {
  OrgCatalogObservationSchema,
  OrgMetadataCatalog,
  OrgMetadataChangeStatusSchema,
  OrgSObjectDescriptionSchema,
  OrgSObjectSummarySchema
} from '../../../src/orgCatalog/orgMetadataCatalog';
import {
  OrgMetadataCatalogChangePubSub,
  type OrgMetadataCatalogChange
} from '../../../src/orgCatalog/orgMetadataCatalogChangePubSub';
import {
  OrgMetadataCatalogStore,
  type OrgMetadataCatalogSnapshot
} from '../../../src/orgCatalog/orgMetadataCatalogStore';
import { runOrgMetadataDocumentProvider } from '../../../src/orgCatalog/orgMetadataDocumentProvider';
import { OrgMetadataShadowStore } from '../../../src/orgCatalog/orgMetadataShadowStore';
import { FileChangePubSub } from '../../../src/vscode/fileChangePubSub';
import { FsService } from '../../../src/vscode/fsService';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

type ListedComponent = {
  readonly fullName: string;
  readonly namespacePrefix?: string;
  readonly lastModifiedDate?: string;
};

type WorkspaceComponent = {
  readonly type: { readonly name: string };
  readonly fullName: string;
  readonly content?: string;
};

type HarnessOptions = {
  readonly metadataByType?: Readonly<Record<string, readonly ListedComponent[]>>;
  readonly workspaceComponents?: readonly WorkspaceComponent[];
  readonly sobjects?: readonly { readonly name: string; readonly custom: boolean; readonly queryable: boolean }[];
  readonly descriptions?: Readonly<Record<string, SObject>>;
  readonly catalogSnapshots?: Map<string, OrgMetadataCatalogSnapshot>;
  readonly storeLoadError?: Error;
  readonly storeSaveError?: Error;
  readonly connectionOrgId?: string;
};

const emptySObject = (name: string): SObject => ({
  name,
  label: name,
  custom: name.endsWith('__c'),
  queryable: true,
  fields: [],
  childRelationships: []
});

const makeHarness = (options: HarnessOptions = {}) => {
  const metadataByType = options.metadataByType ?? {};
  const workspaceComponents = options.workspaceComponents ?? [];
  const descriptions = options.descriptions ?? {};

  const describe = jest.fn(() => Effect.succeed([]));
  const listMetadata = jest.fn((xmlName: string) =>
    Effect.sleep('5 millis').pipe(Effect.as([...(metadataByType[xmlName] ?? [])]))
  );
  const listSObjects = jest.fn(() => Effect.succeed([...(options.sobjects ?? [])]));
  const describeCustomObject = jest.fn((apiName: string) =>
    Effect.succeed(descriptions[apiName] ?? emptySObject(apiName))
  );
  const describeCustomObjects = jest.fn((apiNames: readonly string[]) =>
    Effect.succeed(Stream.fromIterable(apiNames.map(apiName => descriptions[apiName] ?? emptySObject(apiName))))
  );
  const invalidateDescribe = jest.fn(() => Effect.void);
  const invalidateListMetadata = jest.fn((_xmlName: string) => Effect.void);
  const invalidateAllListMetadata = jest.fn(() => Effect.void);
  const invalidateSObjectDescribe = jest.fn((_apiName: string) => Effect.void);
  const invalidateSObjectDescribes = jest.fn((_apiNames?: readonly string[]) => Effect.void);
  const invalidateListSObjects = jest.fn(() => Effect.void);
  const shadowArtifacts = new Map<
    string,
    {
      readonly rootUri: URI;
      readonly primaryUri: URI;
      readonly fileUris: readonly URI[];
      readonly remoteLastModifiedDate?: string;
      readonly materializedAt: string;
    }
  >();
  const shadowFiles = new Map<string, string>();
  const shadowKey = (
    orgId: string,
    reference: { readonly xmlName: string; readonly fullName: string },
    revision?: string
  ) => `${orgId}\0${reference.xmlName}\0${reference.fullName}\0${revision ?? 'unversioned'}`;
  const shadowGet = jest.fn(
    (orgId: string, reference: { readonly xmlName: string; readonly fullName: string }, revision?: string) =>
      Effect.succeed(shadowArtifacts.get(shadowKey(orgId, reference, revision)))
  );
  const shadowPrepare = jest.fn(
    (orgId: string, reference: { readonly xmlName: string; readonly fullName: string }, revision?: string) => {
      const rootUri = URI.file(
        `/workspace/.sf/orgs/${orgId}/metadata-shadow/${reference.xmlName}/${reference.fullName}/${revision ?? 'unversioned'}`
      );
      return Effect.succeed({ rootUri, stagingUri: rootUri.with({ path: `${rootUri.path}.__staging__` }) });
    }
  );
  const shadowPrepareBatch = jest.fn((orgId: string) =>
    Effect.succeed(URI.file(`/workspace/.sf/orgs/${orgId}/remoteMetadata/catalog-staging/batch.__staging__`))
  );
  const shadowPublish = jest.fn(
    ({
      orgId,
      reference,
      stagingUri,
      primaryUri,
      fileUris,
      remoteLastModifiedDate
    }: {
      readonly orgId: string;
      readonly reference: { readonly xmlName: string; readonly fullName: string };
      readonly stagingUri: URI;
      readonly primaryUri: URI;
      readonly fileUris: readonly URI[];
      readonly remoteLastModifiedDate?: string;
    }) =>
      Effect.sync(() => {
        const rootUri = stagingUri.with({ path: stagingUri.path.replace(/\.__staging__$/, '') });
        const publishedPrimaryUri = primaryUri.with({
          path: primaryUri.path.replace(stagingUri.path, rootUri.path)
        });
        const content = shadowFiles.get(primaryUri.toString());
        if (content !== undefined) shadowFiles.set(publishedPrimaryUri.toString(), content);
        const artifact = {
          rootUri,
          primaryUri: publishedPrimaryUri,
          fileUris: fileUris.map(uri => uri.with({ path: uri.path.replace(stagingUri.path, rootUri.path) })),
          remoteLastModifiedDate,
          materializedAt: new Date().toISOString()
        };
        shadowArtifacts.set(shadowKey(orgId, reference, remoteLastModifiedDate), artifact);
        return artifact;
      })
  );
  const toolingQuery = jest.fn(async () => ({
    records: [{ Body: 'public class RemoteTest {}', LastModifiedDate: 'tooling-revision' }]
  }));
  const buildComponentSetFromSource = jest.fn(() =>
    Effect.succeed({
      getSourceComponents: () => workspaceComponents
    })
  );
  const buildComponentSet = jest.fn(() => Effect.succeed({ size: 1 }));
  const ensureNonEmptyComponentSet = jest.fn((componentSet: unknown) => Effect.succeed(componentSet));
  const retrieveComponentSetToDirectory = jest.fn((_componentSet: unknown, _stagingUri: URI) =>
    Effect.die('unexpected remote materialization').pipe(Effect.as(undefined as unknown))
  );
  const readDirectoryWithTypes = jest.fn((_uri: URI) =>
    Effect.succeed([] as { readonly uri: URI; readonly type: vscode.FileType }[])
  );
  const getStatus = jest.fn((_options: unknown) => Effect.succeed([] as StatusOutputRow[]));
  const getStatusWithRemoteChanges = jest.fn((_options: unknown) =>
    Effect.succeed({
      status: [] as StatusOutputRow[],
      remoteChanges: [] as SourceTrackingRemoteChange[]
    })
  );
  const catalogChanges = Effect.runSync(PubSub.unbounded<OrgMetadataCatalogChange>({ replay: 16 }));
  const catalogSnapshots = options.catalogSnapshots ?? new Map<string, OrgMetadataCatalogSnapshot>();
  const storeLoad = jest.fn((orgId: string) =>
    options.storeLoadError ? Effect.fail(options.storeLoadError) : Effect.succeed(catalogSnapshots.get(orgId))
  );
  const storeSave = jest.fn((snapshot: OrgMetadataCatalogSnapshot) =>
    options.storeSaveError
      ? Effect.fail(options.storeSaveError)
      : Effect.sync(() => {
          catalogSnapshots.set(snapshot.orgId, snapshot);
          return URI.file(`/workspace/.sf/orgs/${snapshot.orgId}/metadata-catalog/catalog.json`);
        })
  );

  const getConnection = jest.fn(() =>
    Effect.succeed({
      getAuthInfoFields: () => ({ orgId: options.connectionOrgId ?? 'org-one' }),
      tooling: { query: toolingQuery }
    })
  );
  const dependencies = Layer.mergeAll(
    Layer.succeed(ComponentSetService, {
      ensureNonEmptyComponentSet
    } as unknown as InstanceType<typeof ComponentSetService>),
    Layer.succeed(ConnectionService, {
      getConnection
    } as unknown as InstanceType<typeof ConnectionService>),
    Layer.succeed(FsService, {
      readFile: (uri: URI) => Effect.succeed(shadowFiles.get(uri.toString()) ?? ''),
      readDirectoryWithTypes,
      toUri: (path: string | URI) => Effect.succeed(typeof path === 'string' ? URI.file(path) : path),
      safeDelete: () => Effect.void,
      safeWriteFile: (uri: URI, content: string) =>
        Effect.sync(() => {
          shadowFiles.set(uri.toString(), content);
        })
    } as unknown as InstanceType<typeof FsService>),
    Layer.succeed(MetadataDescribeService, {
      describe,
      listMetadata,
      listSObjects,
      describeCustomObject,
      describeCustomObjects,
      invalidateDescribe,
      invalidateListMetadata,
      invalidateAllListMetadata,
      invalidateSObjectDescribe,
      invalidateSObjectDescribes,
      invalidateListSObjects
    } as unknown as InstanceType<typeof MetadataDescribeService>),
    Layer.succeed(MetadataRegistryService, {
      getRegistryAccess: () => Effect.succeed(new RegistryAccess())
    } as unknown as InstanceType<typeof MetadataRegistryService>),
    Layer.succeed(MetadataRetrieveService, {
      buildComponentSet,
      buildComponentSetFromSource,
      retrieveComponentSetToDirectory
    } as unknown as InstanceType<typeof MetadataRetrieveService>),
    Layer.succeed(
      OrgMetadataCatalogChangePubSub,
      catalogChanges as unknown as InstanceType<typeof OrgMetadataCatalogChangePubSub>
    ),
    Layer.succeed(OrgMetadataCatalogStore, {
      load: storeLoad,
      save: storeSave
    } as unknown as InstanceType<typeof OrgMetadataCatalogStore>),
    Layer.succeed(OrgMetadataShadowStore, {
      get: shadowGet,
      prepare: shadowPrepare,
      prepareBatch: shadowPrepareBatch,
      publish: shadowPublish
    } as unknown as InstanceType<typeof OrgMetadataShadowStore>),
    Layer.succeed(ProjectService, {
      getSfProject: () =>
        Effect.succeed({
          getPackageDirectories: () => [{ fullPath: '/workspace/force-app' }]
        })
    } as unknown as InstanceType<typeof ProjectService>),
    Layer.succeed(SourceTrackingService, {
      getStatus,
      getStatusWithRemoteChanges
    } as unknown as InstanceType<typeof SourceTrackingService>),
    Layer.succeed(TransmogrifierService, {
      toMinimalSObject: (value: SObject) => Effect.succeed(value)
    } as unknown as InstanceType<typeof TransmogrifierService>)
  );

  return {
    catalogChanges,
    layer: Layer.provide(OrgMetadataCatalog.DefaultWithoutDependencies, dependencies),
    mocks: {
      buildComponentSetFromSource,
      buildComponentSet,
      describe,
      describeCustomObject,
      invalidateAllListMetadata,
      invalidateDescribe,
      invalidateListMetadata,
      invalidateListSObjects,
      invalidateSObjectDescribe,
      invalidateSObjectDescribes,
      getStatus,
      getStatusWithRemoteChanges,
      getConnection,
      listMetadata,
      listSObjects,
      readDirectoryWithTypes,
      storeLoad,
      storeSave,
      shadowGet,
      shadowPrepare,
      shadowPrepareBatch,
      shadowPublish,
      retrieveComponentSetToDirectory,
      ensureNonEmptyComponentSet,
      toolingQuery
    }
  };
};

const setOrg = (orgId: string) =>
  Effect.gen(function* () {
    yield* SubscriptionRef.set(yield* getDefaultOrgRef(), { orgId });
  });

const runWithCatalog = <A, E, LayerError>(
  layer: Layer.Layer<OrgMetadataCatalog, LayerError>,
  body: (catalog: InstanceType<typeof OrgMetadataCatalog>) => Effect.Effect<A, E>
): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* setOrg('org-one');
      return yield* body(yield* OrgMetadataCatalog);
    }).pipe(Effect.provide(layer))
  );

describe('OrgMetadataCatalog contract', () => {
  it('resolves consumer-known components during startup before the default org ref is populated', async () => {
    const { layer, mocks } = makeHarness({ connectionOrgId: 'startup-org' });

    const resolutions = await Effect.runPromise(
      Effect.gen(function* () {
        yield* SubscriptionRef.set(yield* getDefaultOrgRef(), {});
        const catalog = yield* OrgMetadataCatalog;
        return yield* catalog.resolveKnownOrgComponents([{ xmlName: 'ApexClass', fullName: 'RemoteTest' }]);
      }).pipe(Effect.provide(layer))
    );

    expect(resolutions[0]).toMatchObject({
      inWorkspace: false,
      documentUri: URI.parse('sf-org-metadata:/orgs/startup-org/ApexClass/RemoteTest.cls')
    });
    expect(mocks.getConnection).toHaveBeenCalledTimes(1);
    expect(mocks.listMetadata).not.toHaveBeenCalled();
  });

  it('resolves consumer-known org components without acquiring Metadata API inventory', async () => {
    const { layer, mocks } = makeHarness({
      workspaceComponents: [
        {
          type: { name: 'ApexClass' },
          fullName: 'LocalTest',
          content: '/workspace/force-app/main/default/classes/LocalTest.cls'
        }
      ]
    });

    const resolutions = await runWithCatalog(layer, catalog =>
      catalog.resolveKnownOrgComponents([
        { xmlName: 'ApexClass', fullName: 'LocalTest' },
        { xmlName: 'ApexClass', fullName: 'RemoteTest' }
      ])
    );

    expect(resolutions).toEqual([
      expect.objectContaining({
        reference: { xmlName: 'ApexClass', fullName: 'LocalTest' },
        inWorkspace: true,
        documentUri: URI.file('/workspace/force-app/main/default/classes/LocalTest.cls')
      }),
      expect.objectContaining({
        reference: { xmlName: 'ApexClass', fullName: 'RemoteTest' },
        inWorkspace: false,
        documentUri: URI.parse('sf-org-metadata:/orgs/org-one/ApexClass/RemoteTest.cls')
      })
    ]);
    expect(mocks.buildComponentSetFromSource).toHaveBeenCalledTimes(1);
    expect(mocks.listMetadata).not.toHaveBeenCalled();
    expect(mocks.storeLoad).not.toHaveBeenCalled();
    expect(mocks.storeSave).not.toHaveBeenCalled();
  });

  it('coalesces equivalent inventory requests and merges org/workspace presence with remote timestamps', async () => {
    const { layer, mocks } = makeHarness({
      metadataByType: {
        ApexClass: [
          { fullName: 'BothTest', lastModifiedDate: '2026-07-30T12:00:00.000Z' },
          { fullName: 'RemoteTest', lastModifiedDate: '2026-07-30T12:01:00.000Z' }
        ]
      },
      workspaceComponents: [
        {
          type: { name: 'ApexClass' },
          fullName: 'BothTest',
          content: '/workspace/force-app/main/default/classes/BothTest.cls'
        },
        {
          type: { name: 'ApexClass' },
          fullName: 'LocalTest',
          content: '/workspace/force-app/main/default/classes/LocalTest.cls'
        }
      ]
    });

    const [first, second, cached] = await runWithCatalog(layer, catalog =>
      Effect.gen(function* () {
        const concurrent = yield* Effect.all(
          [
            catalog.listMetadataComponents({ xmlName: 'ApexClass' }),
            catalog.listMetadataComponents({ xmlName: 'ApexClass' })
          ],
          { concurrency: 'unbounded' }
        );
        return [...concurrent, yield* catalog.listMetadataComponents({ xmlName: 'ApexClass' })] as const;
      })
    );

    expect(first).toEqual(second);
    expect(cached).toEqual(first);
    expect(mocks.listMetadata).toHaveBeenCalledTimes(1);
    expect(mocks.buildComponentSetFromSource).toHaveBeenCalledTimes(1);
    expect(first.map(entry => entry.name)).toEqual(['BothTest', 'LocalTest', 'RemoteTest']);
    expect(first.find(entry => entry.name === 'BothTest')).toMatchObject({
      inOrg: true,
      inWorkspace: true,
      provenance: 'metadata-api+workspace',
      remoteLastModifiedDate: '2026-07-30T12:00:00.000Z',
      workspaceUri: URI.file('/workspace/force-app/main/default/classes/BothTest.cls')
    });
    expect(first.find(entry => entry.name === 'LocalTest')).toMatchObject({
      inOrg: false,
      inWorkspace: true,
      provenance: 'workspace'
    });
  });

  it('restores persisted inventory and SObject observations after a catalog restart', async () => {
    const catalogSnapshots = new Map<string, OrgMetadataCatalogSnapshot>();
    const first = makeHarness({
      catalogSnapshots,
      metadataByType: {
        ApexClass: [{ fullName: 'RemoteTest', lastModifiedDate: '2026-07-31T12:00:00.000Z' }]
      },
      sobjects: [{ name: 'Property__c', custom: true, queryable: true }],
      descriptions: { Property__c: emptySObject('Property__c') }
    });

    await runWithCatalog(first.layer, catalog =>
      Effect.gen(function* () {
        yield* catalog.listMetadataComponents({ xmlName: 'ApexClass' });
        yield* catalog.listSObjects();
        yield* catalog.describeSObject('Property__c');
      })
    );

    expect(catalogSnapshots.get('org-one')).toEqual(
      expect.objectContaining({
        orgId: 'org-one',
        inventory: [expect.objectContaining({ xmlName: 'ApexClass' })],
        sobjects: expect.objectContaining({
          list: [expect.objectContaining({ name: 'Property__c' })],
          descriptions: [expect.objectContaining({ name: 'Property__c' })]
        })
      })
    );
    const persistedObservedAt = catalogSnapshots.get('org-one')?.inventory[0]?.observedAt;

    const restarted = makeHarness({
      catalogSnapshots,
      workspaceComponents: [{ type: { name: 'ApexClass' }, fullName: 'LocalOnly', content: '/workspace/LocalOnly.cls' }]
    });
    const restored = await runWithCatalog(restarted.layer, catalog =>
      Effect.all([
        catalog.listMetadataComponents({ xmlName: 'ApexClass' }),
        catalog.listSObjects(),
        catalog.describeSObject('Property__c')
      ])
    );

    expect(restored[0].map(entry => [entry.name, entry.inOrg, entry.inWorkspace])).toEqual([
      ['LocalOnly', false, true],
      ['RemoteTest', true, false]
    ]);
    expect(restored[0].find(entry => entry.name === 'RemoteTest')?.observedAt).toBe(persistedObservedAt);
    expect(restored[1]).toEqual([expect.objectContaining({ name: 'Property__c' })]);
    expect(restored[2]).toEqual(expect.objectContaining({ name: 'Property__c' }));
    expect(restarted.mocks.storeLoad).toHaveBeenCalledWith('org-one');
    expect(restarted.mocks.listMetadata).not.toHaveBeenCalled();
    expect(restarted.mocks.listSObjects).not.toHaveBeenCalled();
    expect(restarted.mocks.describeCustomObject).not.toHaveBeenCalled();
  });

  it('persists targeted invalidation so a restart does not restore stale inventory', async () => {
    const catalogSnapshots = new Map<string, OrgMetadataCatalogSnapshot>();
    const first = makeHarness({
      catalogSnapshots,
      metadataByType: { ApexClass: [{ fullName: 'OldTest' }] }
    });
    await runWithCatalog(first.layer, catalog =>
      Effect.gen(function* () {
        yield* catalog.listMetadataComponents({ xmlName: 'ApexClass' });
        yield* catalog.invalidateReferences([{ xmlName: 'ApexClass', fullName: 'OldTest' }]);
      })
    );

    expect(catalogSnapshots.get('org-one')?.inventory).toEqual([]);

    const restarted = makeHarness({
      catalogSnapshots,
      metadataByType: { ApexClass: [{ fullName: 'NewTest' }] }
    });
    const entries = await runWithCatalog(restarted.layer, catalog =>
      catalog.listMetadataComponents({ xmlName: 'ApexClass' })
    );

    expect(entries.map(entry => entry.name)).toEqual(['NewTest']);
    expect(restarted.mocks.listMetadata).toHaveBeenCalledWith('ApexClass');
  });

  it('continues with provider-backed reads when catalog hydration or persistence fails', async () => {
    const { layer, mocks } = makeHarness({
      metadataByType: { ApexClass: [{ fullName: 'ProviderTest' }] },
      storeLoadError: new Error('invalid snapshot'),
      storeSaveError: new Error('read-only workspace')
    });

    const entries = await runWithCatalog(layer, catalog => catalog.listMetadataComponents({ xmlName: 'ApexClass' }));

    expect(entries.map(entry => entry.name)).toEqual(['ProviderTest']);
    expect(mocks.listMetadata).toHaveBeenCalledWith('ApexClass');
    expect(mocks.storeSave).toHaveBeenCalledTimes(1);
  });

  it('refreshes and invalidates only affected metadata projections', async () => {
    const { layer, mocks } = makeHarness({
      metadataByType: {
        ApexClass: [{ fullName: 'MyTest' }],
        AuraDefinitionBundle: [{ fullName: 'MyAura' }]
      }
    });

    await runWithCatalog(layer, catalog =>
      Effect.gen(function* () {
        yield* catalog.listMetadataComponents({ xmlName: 'ApexClass' });
        yield* catalog.listMetadataComponents({ xmlName: 'AuraDefinitionBundle' });
        yield* catalog.invalidateReferences([{ xmlName: 'ApexClass', fullName: 'MyTest' }]);
        yield* catalog.listMetadataComponents({ xmlName: 'ApexClass' });
        yield* catalog.listMetadataComponents({ xmlName: 'AuraDefinitionBundle' });
        yield* catalog.refreshMetadataComponents({ xmlName: 'ApexClass' });
      })
    );

    const listedTypes = mocks.listMetadata.mock.calls.map(([xmlName]) => xmlName);
    expect(listedTypes.filter(xmlName => xmlName === 'ApexClass')).toHaveLength(3);
    expect(listedTypes.filter(xmlName => xmlName === 'AuraDefinitionBundle')).toHaveLength(1);
    expect(mocks.invalidateListMetadata).toHaveBeenCalledTimes(2);
    expect(mocks.invalidateListMetadata).toHaveBeenNthCalledWith(1, 'ApexClass');
    expect(mocks.invalidateListMetadata).toHaveBeenNthCalledWith(2, 'ApexClass');
  });

  it('does not retain workspace presence from an inventory load that overlaps invalidation', async () => {
    const { layer, mocks } = makeHarness({
      metadataByType: { ApexClass: [{ fullName: 'FileUtilitiesTest' }] }
    });

    const presence = await runWithCatalog(layer, catalog =>
      Effect.scoped(
        Effect.gen(function* () {
          const scanStarted = yield* Deferred.make<void>();
          const finishStaleScan = yield* Deferred.make<void>();
          mocks.buildComponentSetFromSource
            .mockImplementationOnce(() =>
              Deferred.succeed(scanStarted, undefined).pipe(
                Effect.andThen(Deferred.await(finishStaleScan)),
                Effect.as({
                  getSourceComponents: () => [
                    {
                      type: { name: 'ApexClass' },
                      fullName: 'FileUtilitiesTest',
                      content: '/workspace/force-app/main/default/classes/FileUtilitiesTest.cls'
                    }
                  ]
                })
              )
            )
            .mockImplementationOnce(() => Effect.succeed({ getSourceComponents: () => [] }));

          const initialLoad = yield* Effect.forkScoped(catalog.listMetadataComponents({ xmlName: 'ApexClass' }));
          yield* Deferred.await(scanStarted);
          const invalidation = yield* Effect.forkScoped(catalog.invalidate());
          yield* Deferred.succeed(finishStaleScan, undefined);
          yield* Fiber.join(initialLoad);
          yield* Fiber.join(invalidation);

          return yield* catalog.getPresence({ xmlName: 'ApexClass', fullName: 'FileUtilitiesTest' });
        })
      )
    );

    expect(presence).toEqual({ inOrg: true, inWorkspace: false });
    expect(mocks.buildComponentSetFromSource).toHaveBeenCalledTimes(2);
  });

  it('invalidates correlated SObject observations for Custom Object and Custom Field changes', async () => {
    const { layer, mocks } = makeHarness();

    await runWithCatalog(layer, catalog =>
      catalog.invalidateReferences([
        { xmlName: 'CustomField', fullName: 'Account.Rating__c' },
        { xmlName: 'CustomObject', fullName: 'Property__c' }
      ])
    );

    expect(mocks.invalidateSObjectDescribes).toHaveBeenCalledWith(['Account', 'Property__c']);
    expect(mocks.invalidateListSObjects).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateListMetadata).toHaveBeenCalledWith('CustomField');
    expect(mocks.invalidateListMetadata).toHaveBeenCalledWith('CustomObject');
  });

  it('propagates a Custom Field operation notification to parent SObject reacquisition', async () => {
    const { catalogChanges, layer, mocks } = makeHarness({
      descriptions: { Account: emptySObject('Account') }
    });
    jest.mocked(vscode.workspace.registerTextDocumentContentProvider).mockReturnValue({
      dispose: jest.fn()
    });
    const providerLayer = Layer.mergeAll(
      layer,
      MetadataChangeNotificationService.Default,
      FileChangePubSub.Default,
      Layer.succeed(
        OrgMetadataCatalogChangePubSub,
        catalogChanges as unknown as InstanceType<typeof OrgMetadataCatalogChangePubSub>
      ),
      Layer.succeed(MetadataRegistryService, {
        getRegistryAccess: () => Effect.succeed(new RegistryAccess())
      } as unknown as InstanceType<typeof MetadataRegistryService>),
      Layer.succeed(WorkspaceService, {
        getWorkspaceInfoOrThrow: () =>
          Effect.succeed({
            uri: URI.file('/workspace'),
            path: '/workspace',
            fsPath: '/workspace',
            isEmpty: false,
            isVirtualFs: false,
            cwd: '/workspace'
          })
      } as unknown as InstanceType<typeof WorkspaceService>)
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* setOrg('org-one');
          const invalidated = yield* Deferred.make<readonly string[]>();
          mocks.invalidateSObjectDescribes.mockImplementation(apiNames =>
            Deferred.succeed(invalidated, apiNames ?? []).pipe(Effect.asVoid)
          );
          const catalog = yield* OrgMetadataCatalog;
          const notifications = yield* MetadataChangeNotificationService;
          const before = yield* catalog.describeSObject('Account');
          mocks.describeCustomObject.mockReturnValue(
            Effect.succeed({
              ...emptySObject('Account'),
              label: 'Account after Custom Field change'
            })
          );

          yield* Effect.forkScoped(runOrgMetadataDocumentProvider());
          yield* Effect.sleep('10 millis');
          yield* notifications.publishOperation({
            orgId: 'org-one',
            operation: 'deploy',
            completedAt: '2026-07-30T00:00:00.000Z',
            changes: [
              {
                metadataType: 'CustomField',
                fullName: 'Account.Rating__c',
                changeType: 'changed',
                fileUri: Option.none()
              }
            ]
          });

          const invalidatedApiNames = yield* Deferred.await(invalidated);
          const after = yield* catalog.describeSObject('Account');
          return { after, before, invalidatedApiNames };
        })
      ).pipe(Effect.provide(providerLayer), Effect.timeout('2 seconds'))
    );

    expect(result.before.label).toBe('Account');
    expect(result.after.label).toBe('Account after Custom Field change');
    expect(result.invalidatedApiNames).toEqual(['Account']);
    expect(mocks.invalidateListMetadata).toHaveBeenCalledWith('CustomField');
    expect(mocks.invalidateListSObjects).toHaveBeenCalledTimes(1);
    expect(mocks.describeCustomObject).toHaveBeenCalledTimes(2);
  });

  it('removes workspace presence after source and sidecar deletion notifications', async () => {
    const workspaceComponents: WorkspaceComponent[] = [
      {
        type: { name: 'ApexClass' },
        fullName: 'FileUtilitiesTest',
        content: '/workspace/force-app/main/default/classes/FileUtilitiesTest.cls'
      }
    ];
    const { catalogChanges, layer } = makeHarness({
      metadataByType: { ApexClass: [{ fullName: 'FileUtilitiesTest' }] },
      workspaceComponents
    });
    jest.mocked(vscode.workspace.registerTextDocumentContentProvider).mockReturnValue({
      dispose: jest.fn()
    });
    const providerLayer = Layer.mergeAll(
      layer,
      MetadataChangeNotificationService.Default,
      FileChangePubSub.Default,
      Layer.succeed(
        OrgMetadataCatalogChangePubSub,
        catalogChanges as unknown as InstanceType<typeof OrgMetadataCatalogChangePubSub>
      ),
      Layer.succeed(MetadataRegistryService, {
        getRegistryAccess: () => Effect.succeed(new RegistryAccess())
      } as unknown as InstanceType<typeof MetadataRegistryService>),
      Layer.succeed(WorkspaceService, {
        getWorkspaceInfoOrThrow: () =>
          Effect.succeed({
            uri: URI.file('/workspace'),
            path: '/workspace',
            fsPath: '/workspace',
            isEmpty: false,
            isVirtualFs: false,
            cwd: '/workspace'
          })
      } as unknown as InstanceType<typeof WorkspaceService>)
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* setOrg('org-one');
          const catalog = yield* OrgMetadataCatalog;
          const fileChanges = yield* FileChangePubSub;
          const metadataChanges = yield* MetadataChangeNotificationService;
          const subscription = yield* PubSub.subscribe(catalogChanges);
          const before = yield* catalog.getPresence({ xmlName: 'ApexClass', fullName: 'FileUtilitiesTest' });

          yield* Effect.forkScoped(runOrgMetadataDocumentProvider());
          yield* Queue.take(subscription); // provider's initial active-org observation
          const sourceUri = URI.file('/workspace/force-app/main/default/classes/FileUtilitiesTest.cls');
          const metadataUri = URI.file('/workspace/force-app/main/default/classes/FileUtilitiesTest.cls-meta.xml');
          yield* metadataChanges.publishOperation({
            orgId: 'org-one',
            operation: 'retrieve',
            completedAt: '2026-07-31T00:00:00.000Z',
            changes: [
              {
                metadataType: 'ApexClass',
                fullName: 'FileUtilitiesTest',
                changeType: 'created',
                fileUri: Option.some(sourceUri),
                fileUris: [sourceUri, metadataUri]
              }
            ]
          });
          yield* Queue.take(subscription); // targeted retrieve operation
          yield* Effect.sync(() => workspaceComponents.splice(0));
          yield* PubSub.publish(fileChanges, {
            type: 'delete',
            uri: sourceUri
          });
          yield* PubSub.publish(fileChanges, {
            type: 'delete',
            uri: metadataUri
          });

          const event = yield* Queue.take(subscription);
          const after = yield* catalog.getPresence({ xmlName: 'ApexClass', fullName: 'FileUtilitiesTest' });
          return { after, before, event };
        })
      ).pipe(Effect.provide(providerLayer), Effect.timeout('2 seconds'))
    );

    expect(result.before).toMatchObject({ inOrg: true, inWorkspace: true });
    expect(result.after).toMatchObject({ inOrg: true, inWorkspace: false });
    expect(result.event).toMatchObject({ kind: 'workspace' });
  });

  it('correlates Custom Object children with custom REST fields and metadata inventory', async () => {
    const accountDescription: SObject = {
      ...emptySObject('Account'),
      fields: [
        {
          aggregatable: true,
          custom: false,
          defaultValue: null,
          extraTypeInfo: null,
          filterable: true,
          groupable: true,
          inlineHelpText: null,
          label: 'Name',
          name: 'Name',
          nillable: false,
          picklistValues: [],
          referenceTo: [],
          relationshipName: null,
          sortable: true,
          type: 'string'
        },
        {
          aggregatable: true,
          custom: true,
          defaultValue: null,
          extraTypeInfo: null,
          filterable: true,
          groupable: true,
          inlineHelpText: null,
          label: 'Rating',
          length: 80,
          name: 'Rating__c',
          nillable: true,
          picklistValues: [],
          referenceTo: [],
          relationshipName: null,
          sortable: true,
          type: 'string'
        },
        {
          aggregatable: false,
          custom: true,
          defaultValue: null,
          extraTypeInfo: null,
          filterable: false,
          groupable: false,
          inlineHelpText: null,
          label: 'Runtime Only',
          name: 'RuntimeOnly__c',
          nillable: true,
          picklistValues: [],
          referenceTo: [],
          relationshipName: null,
          sortable: false,
          type: 'textarea'
        }
      ]
    };
    const { layer } = makeHarness({
      metadataByType: {
        CustomObject: [{ fullName: 'Account' }],
        CustomField: [
          {
            fullName: 'Account.Rating__c',
            lastModifiedDate: '2026-07-30T12:00:00.000Z'
          }
        ]
      },
      descriptions: { Account: accountDescription }
    });

    const children = await runWithCatalog(layer, catalog =>
      catalog.getChildren({ xmlName: 'CustomObject', fullName: 'Account' })
    );

    expect(children.map(child => child.name)).toEqual(['Rating__c', 'RuntimeOnly__c']);
    expect(children[0]).toMatchObject({
      reference: { xmlName: 'CustomField', fullName: 'Account.Rating__c' },
      provenance: 'metadata-api',
      remoteLastModifiedDate: '2026-07-30T12:00:00.000Z',
      field: { name: 'Rating__c', type: 'string', length: 80 }
    });
    expect(children[1]).toMatchObject({
      reference: { xmlName: 'CustomField', fullName: 'Account.RuntimeOnly__c' },
      provenance: 'rest-api',
      inOrg: true,
      inWorkspace: false,
      field: { name: 'RuntimeOnly__c', type: 'textarea' }
    });
  });

  it('partitions cached inventory and document identities by org', async () => {
    const { layer, mocks } = makeHarness({
      metadataByType: { ApexClass: [{ fullName: 'SharedTest' }] }
    });

    const [orgOne, orgTwo, orgOneAgain] = await runWithCatalog(layer, catalog =>
      Effect.gen(function* () {
        const first = yield* catalog.getEntry({ xmlName: 'ApexClass', fullName: 'SharedTest' });
        yield* setOrg('org-two');
        const second = yield* catalog.getEntry({ xmlName: 'ApexClass', fullName: 'SharedTest' });
        yield* setOrg('org-one');
        const third = yield* catalog.getEntry({ xmlName: 'ApexClass', fullName: 'SharedTest' });
        return [first, second, third] as const;
      })
    );

    expect(mocks.listMetadata).toHaveBeenCalledTimes(2);
    expect(orgOne?.orgId).toBe('org-one');
    expect(orgTwo?.orgId).toBe('org-two');
    expect(orgOneAgain?.documentUri.toString()).toBe(orgOne?.documentUri.toString());
    expect(orgTwo?.documentUri.toString()).not.toBe(orgOne?.documentUri.toString());
  });

  it('rejects document URIs from an inactive org after an org switch', async () => {
    const { layer } = makeHarness({
      metadataByType: { ApexClass: [{ fullName: 'SharedTest' }] }
    });

    const { inactiveDocument, inactiveReference, orgOneUri, orgTwoUri } = await runWithCatalog(layer, catalog =>
      Effect.gen(function* () {
        const reference = { xmlName: 'ApexClass', fullName: 'SharedTest' };
        const firstUri = yield* catalog.getDocumentUri(reference);
        yield* setOrg('org-two');
        const secondUri = yield* catalog.getDocumentUri(reference);
        return {
          inactiveDocument: yield* Effect.either(catalog.readDocumentUri(firstUri)),
          inactiveReference: yield* catalog.getDocumentReference(firstUri),
          orgOneUri: firstUri,
          orgTwoUri: secondUri
        };
      })
    );

    expect(orgTwoUri.toString()).not.toBe(orgOneUri.toString());
    expect(inactiveReference).toBeUndefined();
    expect(Either.isLeft(inactiveDocument)).toBe(true);
    if (Either.isLeft(inactiveDocument)) {
      expect(inactiveDocument.left).toMatchObject({ code: 'FileNotFound' });
    }
  });

  it('reuses a materialized document for the same remote revision and isolates a newer revision', async () => {
    const remoteComponent = {
      fullName: 'RemoteTest',
      lastModifiedDate: 'revision-1'
    };
    const { layer, mocks } = makeHarness({
      metadataByType: { ApexClass: [remoteComponent] }
    });
    const reference = { xmlName: 'ApexClass', fullName: 'RemoteTest' };

    const [first, repeated, revised] = await runWithCatalog(layer, catalog =>
      Effect.gen(function* () {
        const [firstRead, repeatedRead] = yield* Effect.all([catalog.read(reference), catalog.read(reference)], {
          concurrency: 'unbounded'
        });
        yield* Effect.sync(() => {
          remoteComponent.lastModifiedDate = 'revision-2';
        });
        yield* catalog.refresh({ xmlName: 'ApexClass' });
        return [firstRead, repeatedRead, yield* catalog.read(reference)] as const;
      })
    );

    expect(first).toBe('public class RemoteTest {}');
    expect(repeated).toBe(first);
    expect(revised).toBe(first);
    expect(mocks.toolingQuery).toHaveBeenCalledTimes(2);
    expect(mocks.shadowPrepare).toHaveBeenCalledTimes(2);
    expect(mocks.shadowPublish).toHaveBeenCalledTimes(2);
    expect(mocks.shadowGet).toHaveBeenNthCalledWith(1, 'org-one', reference, 'revision-1');
    expect(mocks.shadowGet).toHaveBeenNthCalledWith(2, 'org-one', reference, 'revision-1');
    expect(mocks.shadowGet).toHaveBeenNthCalledWith(3, 'org-one', reference, 'revision-2');
  });

  it('materializes decomposed metadata represented only by a metadata XML file', async () => {
    const { layer, mocks } = makeHarness({
      metadataByType: { ListView: [{ fullName: 'Broker__c.All', lastModifiedDate: 'revision-1' }] }
    });
    mocks.retrieveComponentSetToDirectory.mockImplementation((_componentSet: unknown, stagingUri: URI) => {
      const filePath = Utils.joinPath(
        stagingUri,
        'package',
        'main',
        'default',
        'objects',
        'Broker__c',
        'listViews',
        'All.listView-meta.xml'
      ).fsPath;
      return Effect.succeed({
        components: {
          getSourceComponents: () => [],
          getComponentFilenamesByNameAndType: () => []
        },
        getFileResponses: () => [
          {
            filePath,
            fullName: 'Broker__c.All',
            state: 'Created',
            type: 'ListView'
          }
        ],
        response: {
          fileProperties: [
            {
              fullName: 'Broker__c.All',
              lastModifiedDate: 'revision-1',
              type: 'ListView'
            }
          ]
        }
      });
    });

    const artifact = await runWithCatalog(layer, catalog =>
      catalog.materializeRemoteSource({ xmlName: 'ListView', fullName: 'Broker__c.All' })
    );

    expect(artifact.primaryUri.path.endsWith('/objects/Broker__c/listViews/All.listView-meta.xml')).toBe(true);
    expect(artifact.fileUris).toEqual([artifact.primaryUri]);
    expect(mocks.shadowPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: { xmlName: 'ListView', fullName: 'Broker__c.All' },
        primaryUri: expect.objectContaining({ path: expect.stringMatching(/\/All\.listView-meta\.xml$/) })
      })
    );
  });

  it('materializes metadata by discovering files written to the staging directory', async () => {
    const { layer, mocks } = makeHarness({
      metadataByType: { Prompt: [{ fullName: 'Property', lastModifiedDate: 'revision-1' }] }
    });
    let retrievedUri: URI | undefined;
    mocks.retrieveComponentSetToDirectory.mockImplementation((_componentSet: unknown, stagingUri: URI) => {
      retrievedUri = Utils.joinPath(stagingUri, 'package', 'main', 'default', 'prompts', 'Property.prompt-meta.xml');
      return Effect.succeed({
        components: {
          getSourceComponents: () => [],
          getComponentFilenamesByNameAndType: () => []
        },
        getFileResponses: () => [],
        response: { fileProperties: [] }
      });
    });
    mocks.readDirectoryWithTypes.mockImplementation(() =>
      Effect.succeed(retrievedUri ? [{ uri: retrievedUri, type: vscode.FileType.File }] : [])
    );

    const artifact = await runWithCatalog(layer, catalog =>
      catalog.materializeRemoteSource({ xmlName: 'Prompt', fullName: 'Property' })
    );

    expect(artifact.primaryUri.path.endsWith('/prompts/Property.prompt-meta.xml')).toBe(true);
    expect(artifact.fileUris).toEqual([artifact.primaryUri]);
  });

  it('refreshes remote source independently of cached inventory and records the observed revision', async () => {
    const reference = { xmlName: 'Prompt', fullName: 'Property' };
    const { layer, mocks } = makeHarness({
      metadataByType: { Prompt: [{ fullName: 'Property', lastModifiedDate: 'revision-1' }] }
    });
    mocks.shadowGet.mockImplementation(() =>
      Effect.succeed({
        rootUri: URI.file('/workspace/.sf/orgs/org-one/metadata-shadow/Prompt/Property/revision-1'),
        primaryUri: URI.file(
          '/workspace/.sf/orgs/org-one/metadata-shadow/Prompt/Property/revision-1/Property.prompt-meta.xml'
        ),
        fileUris: [
          URI.file('/workspace/.sf/orgs/org-one/metadata-shadow/Prompt/Property/revision-1/Property.prompt-meta.xml')
        ],
        remoteLastModifiedDate: 'revision-1',
        materializedAt: '2026-07-30T00:00:00.000Z'
      })
    );
    mocks.retrieveComponentSetToDirectory.mockImplementation((_componentSet: unknown, stagingUri: URI) => {
      const filePath = Utils.joinPath(
        stagingUri,
        'package',
        'main',
        'default',
        'prompts',
        'Property.prompt-meta.xml'
      ).fsPath;
      return Effect.succeed({
        components: {
          getSourceComponents: () => [],
          getComponentFilenamesByNameAndType: () => []
        },
        getFileResponses: () => [{ filePath, fullName: 'Property', state: 'Changed', type: 'Prompt' }],
        response: {
          fileProperties: [{ fullName: 'Property', lastModifiedDate: 'revision-2', type: 'Prompt' }]
        }
      });
    });

    const { artifact, entry } = await runWithCatalog(layer, catalog =>
      Effect.gen(function* () {
        yield* catalog.getEntry(reference);
        const materialized = yield* catalog.materializeRemoteSource(reference, { consistency: 'refresh' });
        return { artifact: materialized, entry: yield* catalog.getEntry(reference) };
      })
    );

    expect(mocks.shadowGet).not.toHaveBeenCalled();
    expect(mocks.retrieveComponentSetToDirectory).toHaveBeenCalledTimes(1);
    expect(mocks.shadowPrepare).toHaveBeenCalledWith('org-one', reference, undefined);
    expect(artifact.remoteLastModifiedDate).toBe('revision-2');
    expect(entry?.lastModifiedDate).toBe('revision-2');
  });

  it('does not gate fresh materialization on cached inventory presence', async () => {
    const reference = { xmlName: 'Prompt', fullName: 'Property' };
    const { layer, mocks } = makeHarness();
    mocks.retrieveComponentSetToDirectory.mockImplementation((_componentSet: unknown, stagingUri: URI) => {
      const filePath = Utils.joinPath(
        stagingUri,
        'package',
        'main',
        'default',
        'prompts',
        'Property.prompt-meta.xml'
      ).fsPath;
      return Effect.succeed({
        components: {
          getSourceComponents: () => [],
          getComponentFilenamesByNameAndType: () => []
        },
        getFileResponses: () => [{ filePath, fullName: 'Property', state: 'Changed', type: 'Prompt' }],
        response: { fileProperties: [] }
      });
    });

    const artifact = await runWithCatalog(layer, catalog =>
      catalog.materializeRemoteSource(reference, { consistency: 'refresh' })
    );

    expect(artifact.primaryUri.path.endsWith('/prompts/Property.prompt-meta.xml')).toBe(true);
    expect(mocks.listMetadata).not.toHaveBeenCalled();
  });

  it('materializes multiple fresh components with one retrieve operation', async () => {
    const references = [
      { xmlName: 'Prompt', fullName: 'Property' },
      { xmlName: 'Prompt', fullName: 'Broker' }
    ];
    const { layer, mocks } = makeHarness();
    mocks.retrieveComponentSetToDirectory.mockImplementation((_componentSet: unknown, stagingUri: URI) => {
      const filePath = (fullName: string) =>
        Utils.joinPath(stagingUri, 'package', 'main', 'default', 'prompts', `${fullName}.prompt-meta.xml`).fsPath;
      return Effect.succeed({
        components: {
          getSourceComponents: () => [],
          getComponentFilenamesByNameAndType: ({ fullName }: { fullName: string }) => [filePath(fullName)]
        },
        getFileResponses: () =>
          references.map(reference => ({
            filePath: filePath(reference.fullName),
            fullName: reference.fullName,
            state: 'Changed',
            type: reference.xmlName
          })),
        response: {
          fileProperties: references.map(reference => ({
            fullName: reference.fullName,
            lastModifiedDate: `revision-${reference.fullName}`,
            type: reference.xmlName
          }))
        }
      });
    });

    const materialized = await runWithCatalog(layer, catalog =>
      catalog.materializeRemoteSources(references, { consistency: 'refresh' })
    );

    expect(materialized.map(({ reference }) => reference)).toEqual(references);
    expect(mocks.buildComponentSet).toHaveBeenCalledWith(
      references.map(reference => ({ type: reference.xmlName, fullName: reference.fullName }))
    );
    expect(mocks.retrieveComponentSetToDirectory).toHaveBeenCalledTimes(1);
    expect(mocks.shadowPrepareBatch).toHaveBeenCalledTimes(1);
    expect(mocks.shadowPublish).toHaveBeenCalledTimes(2);
  });

  it('returns schema-valid observation, SObject, and change-status projections', async () => {
    const { layer, mocks } = makeHarness({
      sobjects: [{ name: 'Property__c', custom: true, queryable: true }],
      descriptions: { Property__c: emptySObject('Property__c') }
    });

    const [summaries, description] = await runWithCatalog(layer, catalog =>
      Effect.all([catalog.listSObjects(), catalog.describeSObject('Property__c')])
    );

    expect(Schema.is(OrgSObjectSummarySchema)(summaries[0])).toBe(true);
    expect(Schema.is(OrgSObjectDescriptionSchema)(description)).toBe(true);
    expect(Schema.is(OrgCatalogObservationSchema)(description)).toBe(true);
    expect(
      Schema.is(OrgMetadataChangeStatusSchema)({
        orgId: 'org-one',
        observedAt: new Date().toISOString(),
        provenance: 'source-tracking',
        fullName: 'Property__c',
        type: 'CustomObject',
        origin: 'remote',
        state: 'Changed'
      })
    ).toBe(true);
    expect(mocks.listSObjects).toHaveBeenCalledTimes(1);
    expect(mocks.describeCustomObject).toHaveBeenCalledWith('Property__c');
    expect(mocks.listMetadata).not.toHaveBeenCalled();
  });

  it('refreshes individual SObject descriptions without invoking metadata inventory providers', async () => {
    const { layer, mocks } = makeHarness({
      descriptions: { Account: emptySObject('Account') }
    });

    const description = await runWithCatalog(layer, catalog => catalog.refreshSObject('Account'));

    expect(description).toMatchObject({ name: 'Account', orgId: 'org-one', provenance: 'rest-api' });
    expect(mocks.invalidateSObjectDescribe).toHaveBeenCalledWith('Account');
    expect(mocks.describeCustomObject).toHaveBeenCalledWith('Account');
    expect(mocks.listMetadata).not.toHaveBeenCalled();
    expect(mocks.describe).not.toHaveBeenCalled();
  });

  it('publishes one targeted change batch for added, modified, and deleted remote observations', async () => {
    const { catalogChanges, layer, mocks } = makeHarness();
    const status: StatusOutputRow[] = [
      {
        fullName: 'NewTest',
        type: 'ApexClass',
        filePath: 'force-app/main/default/classes/NewTest.cls',
        origin: 'remote',
        state: 'add'
      },
      {
        fullName: 'Account.Rating__c',
        type: 'CustomField',
        filePath: 'force-app/main/default/objects/Account/fields/Rating__c.field-meta.xml',
        origin: 'remote',
        state: 'modify'
      },
      {
        fullName: 'OldAura',
        type: 'AuraDefinitionBundle',
        filePath: 'force-app/main/default/aura/OldAura',
        origin: 'remote',
        state: 'delete'
      }
    ];
    const remoteChanges: SourceTrackingRemoteChange[] = [
      { name: 'NewTest', type: 'ApexClass', origin: 'remote', revisionCounter: 1 },
      { name: 'Account.Rating__c', type: 'CustomField', origin: 'remote', revisionCounter: 2 },
      { name: 'OldAura', type: 'AuraDefinitionBundle', origin: 'remote', revisionCounter: 3, deleted: true }
    ];
    mocks.getStatusWithRemoteChanges.mockReturnValue(Effect.succeed({ remoteChanges, status }));

    const event = await runWithCatalog(layer, catalog =>
      Effect.scoped(
        Effect.gen(function* () {
          const subscription = yield* PubSub.subscribe(catalogChanges);
          yield* catalog.refreshChangeStatus({ local: true, remote: true });
          return yield* Queue.take(subscription);
        })
      )
    );

    expect(event).toEqual({
      kind: 'tracking',
      orgId: 'org-one',
      references: [
        { xmlName: 'ApexClass', fullName: 'NewTest' },
        { xmlName: 'CustomField', fullName: 'Account.Rating__c' },
        { xmlName: 'AuraDefinitionBundle', fullName: 'OldAura' }
      ]
    });
    expect(mocks.invalidateListMetadata).toHaveBeenCalledWith('ApexClass');
    expect(mocks.invalidateListMetadata).toHaveBeenCalledWith('CustomField');
    expect(mocks.invalidateListMetadata).toHaveBeenCalledWith('AuraDefinitionBundle');
    expect(mocks.invalidateSObjectDescribes).toHaveBeenCalledWith(['Account']);
    expect(mocks.invalidateListSObjects).toHaveBeenCalledTimes(1);
    expect(mocks.storeSave).toHaveBeenCalledTimes(1);
  });

  it('does not republish an unchanged observation but detects a later revision of the same remote change', async () => {
    const { catalogChanges, layer, mocks } = makeHarness();
    const status: StatusOutputRow[] = [
      {
        fullName: 'MyTest',
        type: 'ApexClass',
        filePath: 'force-app/main/default/classes/MyTest.cls',
        origin: 'remote',
        state: 'modify'
      }
    ];
    const revision = (revisionCounter: number): SourceTrackingRemoteChange[] => [
      { name: 'MyTest', type: 'ApexClass', origin: 'remote', revisionCounter }
    ];
    mocks.getStatusWithRemoteChanges
      .mockReturnValueOnce(Effect.succeed({ remoteChanges: revision(1), status }))
      .mockReturnValueOnce(Effect.succeed({ remoteChanges: revision(1), status }))
      .mockReturnValueOnce(Effect.succeed({ remoteChanges: revision(2), status }));

    const { first, queueSizeAfterRepeat, revised } = await runWithCatalog(layer, catalog =>
      Effect.scoped(
        Effect.gen(function* () {
          const subscription = yield* PubSub.subscribe(catalogChanges);
          yield* catalog.refreshChangeStatus({ remote: true });
          const firstEvent = yield* Queue.take(subscription);
          yield* catalog.refreshChangeStatus({ remote: true });
          const repeatedQueueSize = yield* Queue.size(subscription);
          yield* catalog.refreshChangeStatus({ remote: true });
          const revisedEvent = yield* Queue.take(subscription);
          return {
            first: firstEvent,
            queueSizeAfterRepeat: repeatedQueueSize,
            revised: revisedEvent
          };
        })
      )
    );

    expect(first).toMatchObject({
      kind: 'tracking',
      references: [{ xmlName: 'ApexClass', fullName: 'MyTest' }]
    });
    expect(queueSizeAfterRepeat).toBe(0);
    expect(revised).toEqual(first);
    expect(mocks.invalidateListMetadata).toHaveBeenCalledTimes(2);
    expect(mocks.storeSave).toHaveBeenCalledTimes(2);
  });

  it('partitions source-tracking observations by org across switches', async () => {
    const { catalogChanges, layer, mocks } = makeHarness();
    const status: StatusOutputRow[] = [
      {
        fullName: 'SharedTest',
        type: 'ApexClass',
        filePath: 'force-app/main/default/classes/SharedTest.cls',
        origin: 'remote',
        state: 'modify'
      }
    ];
    mocks.getStatusWithRemoteChanges.mockReturnValue(
      Effect.succeed({
        remoteChanges: [
          {
            name: 'SharedTest',
            type: 'ApexClass',
            origin: 'remote',
            revisionCounter: 1
          }
        ],
        status
      })
    );

    const { first, queueSizeAfterReturn, second } = await runWithCatalog(layer, catalog =>
      Effect.scoped(
        Effect.gen(function* () {
          const subscription = yield* PubSub.subscribe(catalogChanges);
          yield* catalog.refreshChangeStatus({ remote: true });
          const firstEvent = yield* Queue.take(subscription);
          yield* setOrg('org-two');
          yield* catalog.refreshChangeStatus({ remote: true });
          const secondEvent = yield* Queue.take(subscription);
          yield* setOrg('org-one');
          yield* catalog.refreshChangeStatus({ remote: true });
          return {
            first: firstEvent,
            queueSizeAfterReturn: yield* Queue.size(subscription),
            second: secondEvent
          };
        })
      )
    );

    expect(first).toMatchObject({ kind: 'tracking', orgId: 'org-one' });
    expect(second).toMatchObject({ kind: 'tracking', orgId: 'org-two' });
    expect(queueSizeAfterReturn).toBe(0);
    expect(mocks.invalidateListMetadata).toHaveBeenCalledTimes(2);
    expect(mocks.storeSave).toHaveBeenCalledTimes(2);
  });

  it('does not invalidate catalog inventory for local-only status changes', async () => {
    const { catalogChanges, layer, mocks } = makeHarness();
    mocks.getStatusWithRemoteChanges.mockReturnValue(
      Effect.succeed({
        remoteChanges: [],
        status: [
          {
            fullName: 'LocalOnly',
            type: 'ApexClass',
            filePath: 'force-app/main/default/classes/LocalOnly.cls',
            origin: 'local',
            state: 'modify'
          }
        ]
      })
    );

    const queueSize = await runWithCatalog(layer, catalog =>
      Effect.scoped(
        Effect.gen(function* () {
          const subscription = yield* PubSub.subscribe(catalogChanges);
          yield* catalog.refreshChangeStatus({ local: true, remote: true });
          return yield* Queue.size(subscription);
        })
      )
    );

    expect(queueSize).toBe(0);
    expect(mocks.invalidateListMetadata).not.toHaveBeenCalled();
  });

  it('does not republish a remote-row removal already covered by operation invalidation', async () => {
    const { catalogChanges, layer, mocks } = makeHarness();
    const remoteStatus: StatusOutputRow[] = [
      {
        fullName: 'RetrievedTest',
        type: 'ApexClass',
        filePath: 'force-app/main/default/classes/RetrievedTest.cls',
        origin: 'remote',
        state: 'modify'
      }
    ];
    mocks.getStatusWithRemoteChanges
      .mockReturnValueOnce(
        Effect.succeed({
          remoteChanges: [
            {
              name: 'RetrievedTest',
              type: 'ApexClass',
              origin: 'remote',
              revisionCounter: 1
            }
          ],
          status: remoteStatus
        })
      )
      .mockReturnValueOnce(Effect.succeed({ remoteChanges: [], status: [] }));

    const queueSize = await runWithCatalog(layer, catalog =>
      Effect.scoped(
        Effect.gen(function* () {
          const subscription = yield* PubSub.subscribe(catalogChanges);
          yield* catalog.refreshChangeStatus({ remote: true });
          yield* Queue.take(subscription);
          yield* catalog.invalidateReferences([{ xmlName: 'ApexClass', fullName: 'RetrievedTest' }]);
          yield* catalog.refreshChangeStatus({ remote: true });
          return yield* Queue.size(subscription);
        })
      )
    );

    expect(queueSize).toBe(0);
  });
});
