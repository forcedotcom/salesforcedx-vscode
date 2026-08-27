/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ComponentSetService } from '../../../src/core/componentSetService';
import { ConnectionService, InactiveOrgOperationError } from '../../../src/core/connectionService';
import { getDefaultOrgRef } from '../../../src/core/defaultOrgRef';
import { MetadataChangeNotificationService } from '../../../src/core/metadataChangeNotificationService';
import { FOLDERED_METADATA_TYPES, MetadataDescribeService } from '../../../src/core/metadataDescribeService';
import { MetadataRegistryService } from '../../../src/core/metadataRegistryService';
import { MetadataRetrieveService } from '../../../src/core/metadataRetrieveService';
import { ProjectService } from '../../../src/core/projectService';
import { TransmogrifierService } from '../../../src/core/transmogrifierService';
import type { SObject } from '../../../src/core/schemas/sObject';
import { OrgMetadataCatalog } from '../../../src/orgCatalog/orgMetadataCatalog';
import { OrgCatalogDocuments } from '../../../src/orgCatalog/orgCatalogDocuments';
import { OrgCatalogInventory } from '../../../src/orgCatalog/orgCatalogInventory';
import { OrgCatalogRemoteRetrieve } from '../../../src/orgCatalog/orgCatalogRemoteRetrieve';
import { OrgCatalogRemoteSource } from '../../../src/orgCatalog/orgCatalogRemoteSource';
import { OrgCatalogState } from '../../../src/orgCatalog/orgCatalogState';
import { OrgCatalogTreeProjection } from '../../../src/orgCatalog/orgCatalogTreeProjection';
import { OrgCatalogWorkspace } from '../../../src/orgCatalog/orgCatalogWorkspace';
import { OrgMetadataCatalogRecorder } from '../../../src/orgCatalog/orgMetadataCatalogRecorder';
import {
  OrgMetadataCatalogChangePubSub,
  type OrgMetadataCatalogChange
} from '../../../src/orgCatalog/orgMetadataCatalogChangePubSub';
import {
  OrgMetadataCatalogStore,
  type OrgMetadataCatalogSnapshot
} from '../../../src/orgCatalog/orgMetadataCatalogStore';
import { runOrgMetadataDocumentProvider } from '../../../src/orgCatalog/orgMetadataDocumentProvider';
import { OrgMetadataReferenceService } from '../../../src/orgCatalog/orgMetadataReference';
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
  readonly xml?: string;
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
  readonly listMetadataError?: InactiveOrgOperationError;
};

const emptySObject = (name: string): SObject => ({
  name,
  label: name,
  custom: name.endsWith('__c'),
  queryable: true,
  fields: [],
  childRelationships: []
});

const customStringField = (name: string): SObject['fields'][number] => ({
  aggregatable: true,
  custom: true,
  defaultValue: null,
  extraTypeInfo: null,
  filterable: true,
  groupable: true,
  inlineHelpText: null,
  label: name,
  length: 80,
  name,
  nillable: true,
  picklistValues: [],
  precision: 0,
  referenceTo: [],
  relationshipName: null,
  scale: 0,
  sortable: true,
  type: 'string'
});

const makeHarness = (options: HarnessOptions = {}) => {
  const metadataByType = options.metadataByType ?? {};
  const workspaceComponents = options.workspaceComponents ?? [];
  const descriptions = options.descriptions ?? {};

  const describe = jest.fn(() => Effect.succeed([]));
  const listMetadata = jest.fn((xmlName: string, _folder?: string, _expectedOrgId?: string) =>
    options.listMetadataError
      ? setOrg(options.listMetadataError.observedOrgId ?? 'org-two').pipe(Effect.andThen(options.listMetadataError))
      : Effect.sleep('5 millis').pipe(Effect.as([...(metadataByType[xmlName] ?? [])]))
  );
  const listSObjects = jest.fn(() => Effect.succeed([...(options.sobjects ?? [])]));
  const describeCustomObject = jest.fn((apiName: string) =>
    Effect.succeed(descriptions[apiName] ?? emptySObject(apiName))
  );
  const describeCustomObjects = jest.fn((apiNames: readonly string[]) =>
    Effect.succeed(Stream.fromIterable(apiNames.map(apiName => descriptions[apiName] ?? emptySObject(apiName))))
  );
  const invalidateDescribe = jest.fn((_orgId?: string) => Effect.void);
  const invalidateListMetadata = jest.fn((_xmlName: string, _folder?: string, _orgId?: string) => Effect.void);
  const invalidateAllListMetadata = jest.fn((_orgId?: string) => Effect.void);
  const invalidateSObjectDescribe = jest.fn((_apiName: string, _orgId?: string) => Effect.void);
  const invalidateSObjectDescribes = jest.fn((_apiNames?: readonly string[], _orgId?: string) => Effect.void);
  const invalidateListSObjects = jest.fn((_orgId?: string) => Effect.void);
  const invalidateForMetadataChanges = jest.fn(
    (orgId: string, references: readonly { readonly xmlName: string; readonly fullName: string }[]) =>
      Effect.gen(function* () {
        const affectedTypes = new Set(references.map(reference => reference.xmlName));
        yield* Effect.forEach(
          affectedTypes,
          xmlName =>
            FOLDERED_METADATA_TYPES.has(xmlName)
              ? invalidateAllListMetadata(orgId)
              : invalidateListMetadata(xmlName, undefined, orgId),
          { discard: true }
        );
        const affectedSObjects = new Set<string>();
        references.forEach(reference => {
          if (reference.xmlName === 'CustomObject') affectedSObjects.add(reference.fullName);
          if (reference.xmlName === 'CustomField') affectedSObjects.add(reference.fullName.split('.')[0]);
        });
        if (affectedSObjects.size > 0) {
          yield* invalidateListSObjects(orgId);
          yield* invalidateSObjectDescribes([...affectedSObjects], orgId);
        }
      })
  );
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
  const retrieveComponentSetToDirectory = jest.fn((_componentSet: unknown, _stagingUri: URI, _expectedOrgId?: string) =>
    Effect.die('unexpected remote materialization').pipe(Effect.as(undefined as unknown))
  );
  const readDirectoryWithTypes = jest.fn((_uri: URI) =>
    Effect.succeed([] as { readonly uri: URI; readonly type: vscode.FileType }[])
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
  const getConnectionForOrg = jest.fn((_expectedOrgId: string) => getConnection());
  const dependencies = Layer.mergeAll(
    Layer.succeed(ComponentSetService, {
      ensureNonEmptyComponentSet
    } as unknown as InstanceType<typeof ComponentSetService>),
    Layer.succeed(ConnectionService, {
      getConnection,
      getConnectionForOrg
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
      invalidateListSObjects,
      invalidateForMetadataChanges
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
    Layer.succeed(TransmogrifierService, {
      toMinimalSObject: (value: SObject) => Effect.succeed(value)
    } as unknown as InstanceType<typeof TransmogrifierService>)
  );
  const stateLayer = OrgCatalogState.DefaultWithoutDependencies.pipe(Layer.provide(dependencies));
  const referenceLayer = OrgMetadataReferenceService.DefaultWithoutDependencies.pipe(Layer.provide(dependencies));
  const foundation = Layer.mergeAll(dependencies, stateLayer, referenceLayer);
  const recorderLayer = OrgMetadataCatalogRecorder.DefaultWithoutDependencies.pipe(Layer.provide(foundation));
  const workspaceLayer = OrgCatalogWorkspace.DefaultWithoutDependencies.pipe(Layer.provide(foundation));
  const remoteRetrieveLayer = OrgCatalogRemoteRetrieve.DefaultWithoutDependencies.pipe(Layer.provide(foundation));
  const inventoryRequirements = Layer.mergeAll(foundation, workspaceLayer);
  const inventoryLayer = OrgCatalogInventory.DefaultWithoutDependencies.pipe(Layer.provide(inventoryRequirements));
  const remoteSourceRequirements = Layer.mergeAll(inventoryRequirements, inventoryLayer, remoteRetrieveLayer);
  const remoteSourceLayer = OrgCatalogRemoteSource.DefaultWithoutDependencies.pipe(
    Layer.provide(remoteSourceRequirements)
  );
  const documentsLayer = OrgCatalogDocuments.DefaultWithoutDependencies.pipe(
    Layer.provide(Layer.mergeAll(remoteSourceRequirements, remoteSourceLayer))
  );
  const treeProjectionLayer = OrgCatalogTreeProjection.DefaultWithoutDependencies.pipe(
    Layer.provide(Layer.mergeAll(inventoryRequirements, inventoryLayer))
  );
  const catalogRequirements = Layer.mergeAll(
    dependencies,
    stateLayer,
    referenceLayer,
    workspaceLayer,
    inventoryLayer,
    remoteRetrieveLayer,
    remoteSourceLayer,
    documentsLayer,
    recorderLayer,
    treeProjectionLayer
  );

  return {
    catalogChanges,
    internalLayer: Layer.mergeAll(stateLayer, documentsLayer),
    layer: Layer.mergeAll(
      Layer.provide(OrgMetadataCatalog.DefaultWithoutDependencies, catalogRequirements),
      referenceLayer
    ),
    remoteSourceLayer,
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
      getConnection,
      getConnectionForOrg,
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

const setOrg = (orgId: string) => getDefaultOrgRef().pipe(Effect.flatMap(ref => SubscriptionRef.set(ref, { orgId })));

const runWithCatalog = <A, E, LayerError>(
  layer: Layer.Layer<OrgMetadataCatalog | OrgMetadataReferenceService, LayerError>,
  body: (catalog: InstanceType<typeof OrgMetadataCatalog>) => Effect.Effect<A, E>
): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* setOrg('org-one');
      return yield* body(yield* OrgMetadataCatalog);
    }).pipe(Effect.provide(layer))
  );

const getEntry = (
  catalog: InstanceType<typeof OrgMetadataCatalog>,
  reference: { readonly xmlName: string; readonly fullName: string }
) =>
  catalog
    .getEntries([{ type: reference.xmlName, fullName: reference.fullName }])
    .pipe(Effect.map(entries => entries[0]));

const materializeRemoteSource = (
  remoteSource: InstanceType<typeof OrgCatalogRemoteSource>,
  reference: { readonly xmlName: string; readonly fullName: string },
  options: { readonly consistency?: 'cache-first' | 'refresh' } = {}
) => remoteSource.materializeRemoteSource('org-one', reference, options);

const runWithCatalogAndRemoteSource = <A, E, LayerError>(
  layer: Layer.Layer<OrgMetadataCatalog | OrgCatalogRemoteSource | OrgMetadataReferenceService, LayerError>,
  body: (
    catalog: InstanceType<typeof OrgMetadataCatalog>,
    remoteSource: InstanceType<typeof OrgCatalogRemoteSource>
  ) => Effect.Effect<A, E>
): Promise<A> =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* setOrg('org-one');
      return yield* body(yield* OrgMetadataCatalog, yield* OrgCatalogRemoteSource);
    }).pipe(Effect.provide(layer))
  );

describe('OrgMetadataCatalog contract', () => {
  it('exposes only consumer-shaped operations', async () => {
    const { layer } = makeHarness();

    const keys = await runWithCatalog(layer, catalog => Effect.succeed(Object.keys(catalog).toSorted()));

    expect(keys).toEqual(['getChildren', 'getEntries', 'resolveComponents']);
  });

  it('starts the metadata document provider when no workspace is open', async () => {
    const { catalogChanges, internalLayer, layer } = makeHarness();
    jest.mocked(vscode.workspace.registerTextDocumentContentProvider).mockReturnValue({
      dispose: jest.fn()
    });
    const providerLayer = Layer.mergeAll(
      layer,
      internalLayer,
      MetadataChangeNotificationService.Default,
      FileChangePubSub.Default,
      OrgMetadataReferenceService.Default,
      Layer.succeed(
        OrgMetadataCatalogChangePubSub,
        catalogChanges as unknown as InstanceType<typeof OrgMetadataCatalogChangePubSub>
      ),
      Layer.succeed(MetadataRegistryService, {
        getRegistryAccess: () => Effect.succeed(new RegistryAccess())
      } as unknown as InstanceType<typeof MetadataRegistryService>),
      Layer.succeed(WorkspaceService, {
        getWorkspaceInfo: () =>
          Effect.succeed({
            uri: URI.parse(''),
            path: '',
            fsPath: '',
            isEmpty: true,
            isVirtualFs: false,
            cwd: '/workspace'
          }),
        getWorkspaceInfoOrThrow: () => Effect.die('getWorkspaceInfoOrThrow must not run during activation')
      } as unknown as InstanceType<typeof WorkspaceService>)
    );

    const result = await runOrgMetadataDocumentProvider().pipe(
      Effect.timeoutOption('20 millis'),
      Effect.provide(providerLayer),
      Effect.scoped,
      Effect.runPromise
    );

    expect(Option.isNone(result)).toBe(true);
  });

  it('resolves consumer-known components during startup before the default org ref is populated', async () => {
    const { layer, mocks } = makeHarness({ connectionOrgId: 'startup-org' });

    const resolutions = await Effect.runPromise(
      Effect.gen(function* () {
        yield* SubscriptionRef.set(yield* getDefaultOrgRef(), {});
        const catalog = yield* OrgMetadataCatalog;
        return yield* catalog.resolveComponents([{ type: 'ApexClass', fullName: 'RemoteTest' }]);
      }).pipe(Effect.provide(layer))
    );

    expect(resolutions[0]).toMatchObject({
      presence: 'org',
      preferredUri: URI.parse('sf-org-metadata:/orgs/startup-org/ApexClass/RemoteTest.cls')
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
      catalog.resolveComponents([
        { type: 'ApexClass', fullName: 'LocalTest' },
        { type: 'ApexClass', fullName: 'RemoteTest' }
      ])
    );

    expect(resolutions).toEqual([
      expect.objectContaining({
        reference: { type: 'ApexClass', fullName: 'LocalTest' },
        presence: 'both',
        preferredUri: URI.file('/workspace/force-app/main/default/classes/LocalTest.cls'),
        orgUri: URI.parse('sf-org-metadata:/orgs/org-one/ApexClass/LocalTest.cls'),
        workspaceUri: URI.file('/workspace/force-app/main/default/classes/LocalTest.cls')
      }),
      expect.objectContaining({
        reference: { type: 'ApexClass', fullName: 'RemoteTest' },
        presence: 'org',
        preferredUri: URI.parse('sf-org-metadata:/orgs/org-one/ApexClass/RemoteTest.cls'),
        orgUri: URI.parse('sf-org-metadata:/orgs/org-one/ApexClass/RemoteTest.cls')
      })
    ]);
    expect(mocks.buildComponentSetFromSource).toHaveBeenCalledTimes(1);
    expect(mocks.listMetadata).not.toHaveBeenCalled();
    expect(mocks.storeLoad).toHaveBeenCalledWith('org-one');
    expect(mocks.storeSave).toHaveBeenCalledWith(
      expect.objectContaining({
        inventory: [
          expect.objectContaining({
            complete: false,
            components: expect.arrayContaining([
              expect.objectContaining({ fullName: 'LocalTest' }),
              expect.objectContaining({ fullName: 'RemoteTest' })
            ])
          })
        ]
      })
    );
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
          [catalog.getChildren({ type: 'ApexClass' }), catalog.getChildren({ type: 'ApexClass' })],
          { concurrency: 'unbounded' }
        );
        return [...concurrent, yield* catalog.getChildren({ type: 'ApexClass' })] as const;
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

  it('does not commit inventory when acquisition detects that the active org changed', async () => {
    const { layer, mocks } = makeHarness({
      listMetadataError: new InactiveOrgOperationError({
        message: "The active org changed while an operation for 'org-one' was in progress",
        expectedOrgId: 'org-one',
        observedOrgId: 'org-two'
      })
    });

    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        yield* setOrg('org-one');
        return yield* (yield* OrgMetadataCatalog).getChildren({ type: 'ApexClass' });
      }).pipe(Effect.provide(layer))
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (!Exit.isFailure(exit)) return;
    expect(Cause.failureOption(exit.cause).pipe(Option.getOrUndefined)).toMatchObject({
      _tag: 'InactiveOrgOperationError',
      expectedOrgId: 'org-one',
      observedOrgId: 'org-two'
    });
    expect(mocks.listMetadata).toHaveBeenCalledWith('ApexClass', undefined, 'org-one');
    expect(mocks.storeSave).not.toHaveBeenCalled();
  });

  it('restores persisted inventory after a catalog restart', async () => {
    const catalogSnapshots = new Map<string, OrgMetadataCatalogSnapshot>();
    const first = makeHarness({
      catalogSnapshots,
      metadataByType: {
        ApexClass: [{ fullName: 'RemoteTest', lastModifiedDate: '2026-07-31T12:00:00.000Z' }]
      }
    });

    await runWithCatalog(first.layer, catalog => catalog.getChildren({ type: 'ApexClass' }));

    expect(catalogSnapshots.get('org-one')).toEqual(
      expect.objectContaining({
        orgId: 'org-one',
        inventory: [expect.objectContaining({ xmlName: 'ApexClass' })]
      })
    );
    const persistedObservedAt = catalogSnapshots.get('org-one')?.inventory[0]?.observedAt;

    const restarted = makeHarness({
      catalogSnapshots,
      workspaceComponents: [{ type: { name: 'ApexClass' }, fullName: 'LocalOnly', content: '/workspace/LocalOnly.cls' }]
    });
    const restored = await runWithCatalog(restarted.layer, catalog => catalog.getChildren({ type: 'ApexClass' }));

    expect(restored.map(entry => [entry.name, entry.inOrg, entry.inWorkspace])).toEqual([
      ['LocalOnly', false, true],
      ['RemoteTest', true, false]
    ]);
    expect(restored.find(entry => entry.name === 'RemoteTest')?.observedAt).toBe(persistedObservedAt);
    expect(restarted.mocks.storeLoad).toHaveBeenCalledWith('org-one');
    expect(restarted.mocks.listMetadata).not.toHaveBeenCalled();
  });

  it('persists refreshed inventory for a catalog restart', async () => {
    const catalogSnapshots = new Map<string, OrgMetadataCatalogSnapshot>();
    const apexClasses: ListedComponent[] = [{ fullName: 'OldTest' }];
    const first = makeHarness({
      catalogSnapshots,
      metadataByType: { ApexClass: apexClasses }
    });
    await runWithCatalog(first.layer, catalog =>
      Effect.gen(function* () {
        yield* catalog.getChildren({ type: 'ApexClass' });
        yield* Effect.sync(() => apexClasses.splice(0));
        yield* catalog.getChildren({ type: 'ApexClass' }, { consistency: 'refresh' });
      })
    );

    expect(catalogSnapshots.get('org-one')?.inventory).toEqual([
      expect.objectContaining({ xmlName: 'ApexClass', components: [] })
    ]);

    const restarted = makeHarness({
      catalogSnapshots,
      metadataByType: { ApexClass: [{ fullName: 'NewTest' }] }
    });
    const entries = await runWithCatalog(restarted.layer, catalog => catalog.getChildren({ type: 'ApexClass' }));

    expect(entries).toEqual([]);
    expect(restarted.mocks.listMetadata).not.toHaveBeenCalled();
  });

  it('continues with provider-backed reads when catalog hydration or persistence fails', async () => {
    const { layer, mocks } = makeHarness({
      metadataByType: { ApexClass: [{ fullName: 'ProviderTest' }] },
      storeLoadError: new Error('invalid snapshot'),
      storeSaveError: new Error('read-only workspace')
    });

    const entries = await runWithCatalog(layer, catalog => catalog.getChildren({ type: 'ApexClass' }));

    expect(entries.map(entry => entry.name)).toEqual(['ProviderTest']);
    expect(mocks.listMetadata).toHaveBeenCalledWith('ApexClass', undefined, 'org-one');
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
        yield* catalog.getChildren({ type: 'ApexClass' });
        yield* catalog.getChildren({ type: 'AuraDefinitionBundle' });
        yield* catalog.getChildren({ type: 'ApexClass' }, { consistency: 'refresh' });
        yield* catalog.getChildren({ type: 'AuraDefinitionBundle' });
        yield* catalog.getChildren({ type: 'ApexClass' }, { consistency: 'refresh' });
      })
    );

    const listedTypes = mocks.listMetadata.mock.calls.map(([xmlName]) => xmlName);
    expect(listedTypes.filter(xmlName => xmlName === 'ApexClass')).toHaveLength(3);
    expect(listedTypes.filter(xmlName => xmlName === 'AuraDefinitionBundle')).toHaveLength(1);
    expect(mocks.invalidateListMetadata).toHaveBeenCalledTimes(2);
    expect(mocks.invalidateListMetadata).toHaveBeenNthCalledWith(1, 'ApexClass', undefined, 'org-one');
    expect(mocks.invalidateListMetadata).toHaveBeenNthCalledWith(2, 'ApexClass', undefined, 'org-one');
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

          const initialLoad = yield* Effect.forkScoped(catalog.getChildren({ type: 'ApexClass' }));
          yield* Deferred.await(scanStarted);
          const invalidation = yield* Effect.forkScoped(
            catalog.getChildren({ type: 'ApexClass' }, { consistency: 'refresh' })
          );
          yield* Deferred.succeed(finishStaleScan, undefined);
          yield* Fiber.join(initialLoad);
          yield* Fiber.join(invalidation);

          return yield* getEntry(catalog, { xmlName: 'ApexClass', fullName: 'FileUtilitiesTest' });
        })
      )
    );

    expect(presence).toMatchObject({ inOrg: true, inWorkspace: false });
    expect(mocks.buildComponentSetFromSource).toHaveBeenCalledTimes(2);
  });

  it('removes workspace presence after source and sidecar deletion notifications', async () => {
    const workspaceComponents: WorkspaceComponent[] = [
      {
        type: { name: 'ApexClass' },
        fullName: 'FileUtilitiesTest',
        content: '/workspace/force-app/main/default/classes/FileUtilitiesTest.cls'
      }
    ];
    const { catalogChanges, internalLayer, layer } = makeHarness({
      metadataByType: { ApexClass: [{ fullName: 'FileUtilitiesTest' }] },
      workspaceComponents
    });
    jest.mocked(vscode.workspace.registerTextDocumentContentProvider).mockReturnValue({
      dispose: jest.fn()
    });
    const providerLayer = Layer.mergeAll(
      layer,
      internalLayer,
      MetadataChangeNotificationService.Default,
      FileChangePubSub.Default,
      OrgMetadataReferenceService.Default,
      Layer.succeed(
        OrgMetadataCatalogChangePubSub,
        catalogChanges as unknown as InstanceType<typeof OrgMetadataCatalogChangePubSub>
      ),
      Layer.succeed(MetadataRegistryService, {
        getRegistryAccess: () => Effect.succeed(new RegistryAccess())
      } as unknown as InstanceType<typeof MetadataRegistryService>),
      Layer.succeed(WorkspaceService, {
        getWorkspaceInfo: () =>
          Effect.succeed({
            uri: URI.file('/workspace'),
            path: '/workspace',
            fsPath: '/workspace',
            isEmpty: false,
            isVirtualFs: false,
            cwd: '/workspace'
          }),
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

    const result = await Effect.scoped(
      Effect.gen(function* () {
        yield* setOrg('org-one');
        const catalog = yield* OrgMetadataCatalog;
        const fileChanges = yield* FileChangePubSub;
        const subscription = yield* PubSub.subscribe(catalogChanges);
        const before = yield* getEntry(catalog, { xmlName: 'ApexClass', fullName: 'FileUtilitiesTest' });

        yield* Effect.forkScoped(runOrgMetadataDocumentProvider());
        yield* Queue.take(subscription); // provider's initial active-org observation
        const sourceUri = URI.file('/workspace/force-app/main/default/classes/FileUtilitiesTest.cls');
        const metadataUri = URI.file('/workspace/force-app/main/default/classes/FileUtilitiesTest.cls-meta.xml');
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
        const after = yield* getEntry(catalog, { xmlName: 'ApexClass', fullName: 'FileUtilitiesTest' });
        return { after, before, event };
      })
    ).pipe(Effect.provide(providerLayer), Effect.timeout('2 seconds'), Effect.runPromise);

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
      catalog.getChildren({ type: 'CustomObject', fullName: 'Account' })
    );

    expect(children.map(child => child.name)).toEqual(['Rating__c', 'RuntimeOnly__c']);
    expect(children[0]).toMatchObject({
      reference: { type: 'CustomField', fullName: 'Account.Rating__c' },
      provenance: 'metadata-api',
      remoteLastModifiedDate: '2026-07-30T12:00:00.000Z',
      field: { name: 'Rating__c', type: 'string', length: 80 }
    });
    expect(children[1]).toMatchObject({
      reference: { type: 'CustomField', fullName: 'Account.RuntimeOnly__c' },
      provenance: 'rest-api',
      inOrg: true,
      inWorkspace: false,
      field: { name: 'RuntimeOnly__c', type: 'textarea' }
    });
  });

  it('uses Custom Field inventory when the SObject description has no matching fields', async () => {
    const { layer } = makeHarness({
      metadataByType: {
        CustomObject: [{ fullName: 'Broker__c' }],
        CustomField: [{ fullName: 'Broker__c.Email__c' }]
      },
      workspaceComponents: [
        {
          type: { name: 'CustomField' },
          fullName: 'Broker__c.Email__c',
          xml: '/workspace/force-app/main/default/objects/Broker__c/fields/Email__c.field-meta.xml'
        }
      ],
      descriptions: { Broker__c: emptySObject('Broker__c') }
    });

    const children = await runWithCatalog(layer, catalog =>
      catalog.getChildren({ type: 'CustomObject', fullName: 'Broker__c' })
    );

    expect(children).toEqual([
      expect.objectContaining({
        name: 'Email__c',
        reference: { type: 'CustomField', fullName: 'Broker__c.Email__c' },
        inOrg: true,
        inWorkspace: true,
        workspaceUri: URI.file('/workspace/force-app/main/default/objects/Broker__c/fields/Email__c.field-meta.xml')
      })
    ]);
  });

  it('returns an empty child collection for a known empty metadata folder', async () => {
    const { layer } = makeHarness({
      metadataByType: {
        ReportFolder: [{ fullName: 'EmptyReports' }],
        Report: []
      }
    });

    const folders = await runWithCatalog(layer, catalog => catalog.getChildren({ type: 'Report' }));
    const children = await runWithCatalog(layer, catalog =>
      catalog.getChildren({ type: 'Report', fullName: 'EmptyReports' })
    );

    expect(folders).toEqual([
      expect.objectContaining({
        kind: 'folder',
        reference: { type: 'Report', fullName: 'EmptyReports' }
      })
    ]);
    expect(children).toEqual([]);
  });

  it('reacquires a persisted SObject description older than Custom Field inventory', async () => {
    const staleDescription = {
      ...emptySObject('Broker__c'),
      orgId: 'org-one',
      observedAt: '2026-07-31T17:07:00.000Z',
      provenance: 'rest-api' as const
    };
    const catalogSnapshots = new Map<string, OrgMetadataCatalogSnapshot>([
      [
        'org-one',
        {
          version: 2,
          orgId: 'org-one',
          writtenAt: '2026-08-03T13:35:00.000Z',
          generation: 1,
          inventory: [
            {
              xmlName: 'CustomObject',
              observedAt: '2026-08-03T13:34:00.000Z',
              components: [{ fullName: 'Broker__c' }],
              folders: []
            },
            {
              xmlName: 'CustomField',
              observedAt: '2026-08-03T13:35:00.000Z',
              components: [{ fullName: 'Broker__c.Email__c' }],
              folders: []
            }
          ],
          sobjects: { descriptions: [staleDescription] },
          tracking: [],
          metadataTypes: [],
          metadataListings: []
        }
      ]
    ]);
    const freshDescription = {
      ...emptySObject('Broker__c'),
      fields: [customStringField('Email__c')]
    };
    const { layer, mocks } = makeHarness({
      catalogSnapshots,
      descriptions: { Broker__c: freshDescription }
    });

    const children = await runWithCatalog(layer, catalog =>
      catalog.getChildren({ type: 'CustomObject', fullName: 'Broker__c' })
    );

    expect(mocks.invalidateSObjectDescribe).toHaveBeenCalledWith('Broker__c', 'org-one');
    expect(mocks.describeCustomObject).toHaveBeenCalledWith('Broker__c', 'org-one');
    expect(children).toEqual([
      expect.objectContaining({
        name: 'Email__c',
        field: expect.objectContaining({ name: 'Email__c', type: 'string', length: 80 })
      })
    ]);
  });

  it('partitions cached inventory and document identities by org', async () => {
    const { layer, mocks } = makeHarness({
      metadataByType: { ApexClass: [{ fullName: 'SharedTest' }] }
    });

    const [orgOne, orgTwo, orgOneAgain] = await runWithCatalog(layer, catalog =>
      Effect.gen(function* () {
        const first = yield* getEntry(catalog, { xmlName: 'ApexClass', fullName: 'SharedTest' });
        yield* setOrg('org-two');
        const second = yield* getEntry(catalog, { xmlName: 'ApexClass', fullName: 'SharedTest' });
        yield* setOrg('org-one');
        const third = yield* getEntry(catalog, { xmlName: 'ApexClass', fullName: 'SharedTest' });
        return [first, second, third] as const;
      })
    );

    expect(mocks.listMetadata).toHaveBeenCalledTimes(2);
    expect(orgOne?.orgId).toBe('org-one');
    expect(orgTwo?.orgId).toBe('org-two');
    expect(orgOneAgain?.documentUri.toString()).toBe(orgOne?.documentUri.toString());
    expect(orgTwo?.documentUri.toString()).not.toBe(orgOne?.documentUri.toString());
  });

  it('materializes decomposed metadata represented only by a metadata XML file', async () => {
    const { layer, mocks, remoteSourceLayer } = makeHarness({
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

    const artifact = await runWithCatalogAndRemoteSource(Layer.merge(layer, remoteSourceLayer), (_, remoteSource) =>
      materializeRemoteSource(remoteSource, { xmlName: 'ListView', fullName: 'Broker__c.All' })
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
    const { layer, mocks, remoteSourceLayer } = makeHarness({
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

    const artifact = await runWithCatalogAndRemoteSource(Layer.merge(layer, remoteSourceLayer), (_, remoteSource) =>
      materializeRemoteSource(remoteSource, { xmlName: 'Prompt', fullName: 'Property' })
    );

    expect(artifact.primaryUri.path.endsWith('/prompts/Property.prompt-meta.xml')).toBe(true);
    expect(artifact.fileUris).toEqual([artifact.primaryUri]);
  });

  it('refreshes remote source independently of cached inventory and records the observed revision', async () => {
    const reference = { xmlName: 'Prompt', fullName: 'Property' };
    const { layer, mocks, remoteSourceLayer } = makeHarness({
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

    const { artifact, entry } = await runWithCatalogAndRemoteSource(
      Layer.merge(layer, remoteSourceLayer),
      (catalog, remoteSource) =>
        Effect.gen(function* () {
          yield* getEntry(catalog, reference);
          const materialized = yield* materializeRemoteSource(remoteSource, reference, { consistency: 'refresh' });
          return { artifact: materialized, entry: yield* getEntry(catalog, reference) };
        })
    );

    expect(mocks.shadowGet).not.toHaveBeenCalled();
    expect(mocks.retrieveComponentSetToDirectory).toHaveBeenCalledTimes(1);
    expect(mocks.retrieveComponentSetToDirectory.mock.calls[0]?.[2]).toBe('org-one');
    expect(mocks.shadowPrepare).toHaveBeenCalledWith('org-one', reference, undefined);
    expect(artifact.remoteLastModifiedDate).toBe('revision-2');
    expect(entry?.lastModifiedDate).toBe('revision-2');
  });

  it('does not gate fresh materialization on cached inventory presence', async () => {
    const reference = { xmlName: 'Prompt', fullName: 'Property' };
    const { layer, mocks, remoteSourceLayer } = makeHarness();
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

    const artifact = await runWithCatalogAndRemoteSource(Layer.merge(layer, remoteSourceLayer), (_, remoteSource) =>
      materializeRemoteSource(remoteSource, reference, { consistency: 'refresh' })
    );

    expect(artifact.primaryUri.path.endsWith('/prompts/Property.prompt-meta.xml')).toBe(true);
    expect(mocks.listMetadata).not.toHaveBeenCalled();
  });

  it('materializes multiple fresh components with one retrieve operation', async () => {
    const references = [
      { xmlName: 'Prompt', fullName: 'Property' },
      { xmlName: 'Prompt', fullName: 'Broker' }
    ];
    const { layer, mocks, remoteSourceLayer } = makeHarness();
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

    const materialized = await runWithCatalogAndRemoteSource(Layer.merge(layer, remoteSourceLayer), (_, remoteSource) =>
      remoteSource.materializeRemoteSources('org-one', references, { consistency: 'refresh' })
    );

    expect(materialized.map(({ reference }) => reference)).toEqual(references);
    expect(mocks.buildComponentSet).toHaveBeenCalledWith(
      references.map(reference => ({ type: reference.xmlName, fullName: reference.fullName }))
    );
    expect(mocks.retrieveComponentSetToDirectory).toHaveBeenCalledTimes(1);
    expect(mocks.shadowPrepareBatch).toHaveBeenCalledTimes(1);
    expect(mocks.shadowPublish).toHaveBeenCalledTimes(2);
  });
});
