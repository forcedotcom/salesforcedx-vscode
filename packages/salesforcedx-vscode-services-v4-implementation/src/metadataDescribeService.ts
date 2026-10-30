/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import { standardValueSet } from '@salesforce/source-deploy-retrieve';
import {
  ChannelService,
  ConnectionService,
  FOLDERED_METADATA_TYPES,
  FilePropertiesByFullName,
  FilePropertiesSchema,
  InactiveOrgOperationError,
  ListMetadataError,
  MetadataDescribeError,
  MetadataDescribeService,
  NoTargetOrgConfiguredError,
  TransmogrifierService,
  authFieldsFromConnection,
  orgIdFromConnection,
  type DescribeSObjectResult,
  type OrgId
} from '@salesforce/vscode-services-v2';
import * as Arr from 'effect/Array';
import * as Cache from 'effect/Cache';
import * as Context from 'effect/Context';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as Schema from 'effect/Schema';
import * as Semaphore from 'effect/Semaphore';
import * as Stream from 'effect/Stream';
import { ConnectionHost } from './connectionHost.js';
import { unknownToErrorCause } from './errorCause.js';
import { referencesToAffectedSObjects } from './orgCatalog/orgCatalogKeys.js';
import { OrgMetadataCatalogRecorder } from './orgCatalog/orgMetadataCatalogRecorder.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { OrgChanges } from './targetOrgRef.js';

const NON_SUPPORTED_TYPES = new Set(['ContentWorkspace', 'InstalledPackage', 'Profile', 'Scontrol']);
type OrgCacheKey = { readonly orgId: OrgId; readonly orgGeneration: number };
type ListMetadataKey = { readonly type: string; readonly folder?: string };
type SObjectBatchResponse = {
  readonly results: readonly {
    readonly statusCode: number;
    readonly result: DescribeSObjectResult | { readonly errorCode: string; readonly message: string }[];
  }[];
};
const successTtl =
  (ttl: Duration.Input) =>
  <A, E>(exit: Exit.Exit<A, E>) =>
    Exit.isSuccess(exit) ? ttl : Duration.zero;
const metadataFailure = (cause: unknown, name: string, objectName?: string) =>
  new MetadataDescribeError({
    cause,
    function: name,
    ...(objectName ? { objectName } : {}),
    message: `Failed to ${name}${objectName ? ` ${objectName}` : ''}: ${unknownToErrorCause(cause).message}`
  });
const invalidatedDescribe = () =>
  new MetadataDescribeError({
    function: 'read',
    message: 'Metadata changed while its description was being read',
    cause: 'Metadata cache invalidated'
  });

/** Tracking validates the epoch only after acquiring describe observation permits, avoiding inverted org locks. */
export class MetadataDescribeInvalidation extends Context.Service<
  MetadataDescribeInvalidation,
  {
    readonly invalidateForTracking: (
      orgId: OrgId,
      orgGeneration: number,
      references: readonly { readonly xmlName: string; readonly fullName: string }[],
      sObjectOnly?: boolean
    ) => Effect.Effect<void, InactiveOrgOperationError>;
    readonly invalidateHierarchy: (
      orgId: OrgId,
      orgGeneration: number,
      xmlName?: string
    ) => Effect.Effect<void, InactiveOrgOperationError>;
  }
>()('@salesforce/vscode-services-v4-implementation/MetadataDescribeInvalidation') {}

export const MetadataDescribeServiceLayer = Layer.effectContext(
  Effect.gen(function* () {
    const connections = yield* ConnectionService;
    const changes = yield* OrgChanges;
    const host = yield* ConnectionHost;
    const channel = yield* ChannelService;
    const recorder = yield* OrgMetadataCatalogRecorder;
    const transmogrifier = yield* TransmogrifierService;
    const operations = yield* ServiceOperations;
    const changedError = (orgId: OrgId) =>
      new InactiveOrgOperationError({ expectedOrgId: orgId, message: host.messages.orgChanged(orgId) });
    const validate = (key: OrgCacheKey) =>
      changes.commitIfCurrent(key.orgGeneration, changedError(key.orgId), Effect.void);
    const capture = Effect.fn('MetadataDescribeService.capture')(function* (expectedOrgId?: OrgId) {
      const connection = yield* expectedOrgId
        ? connections.getConnectionForOrg(expectedOrgId)
        : connections.getConnection();
      const orgId = expectedOrgId ?? Option.getOrUndefined(orgIdFromConnection(connection));
      if (!orgId)
        return yield* new NoTargetOrgConfiguredError({
          message: 'No active org identity is available for metadata describe'
        });
      const snapshot = yield* changes.snapshot;
      const username =
        connection.getUsername() ??
        Option.getOrUndefined(Option.flatMap(authFieldsFromConnection(connection), fields => fields.username));
      if (snapshot.org.orgId !== orgId || snapshot.org.username?.toLowerCase() !== username?.toLowerCase())
        return yield* changedError(orgId);
      return { orgId, orgGeneration: snapshot.orgGeneration } as const;
    });
    // Cache lifetimes include the committed user/org epoch, not auth-attempt generation. A→B→A cannot revive old reads.
    const orgCaches = yield* Cache.makeWith(
      (key: OrgCacheKey) =>
        Effect.gen(function* () {
          yield* validate(key);
          const revision = yield* Ref.make(0);
          const observations = yield* Semaphore.make(1);
          const withRevision =
            <E>(expected: number, error: E) =>
            <A, E2, R>(program: Effect.Effect<A, E2, R>): Effect.Effect<A, E | E2, R> =>
              observations.withPermit(
                Ref.get(revision).pipe(
                  Effect.flatMap(
                    (current): Effect.Effect<A, E | E2, R> => (current === expected ? program : Effect.fail(error))
                  )
                )
              );
          // Credentials can refresh without changing user/org identity. Never pin a native connection to cache lifetime.
          const read = <A, E>(request: (connection: Connection) => Effect.Effect<A, E>) =>
            validate(key).pipe(
              Effect.andThen(connections.getConnectionForOrg(key.orgId)),
              Effect.flatMap(connection =>
                validate(key).pipe(
                  Effect.andThen(request(connection)),
                  Effect.tap(() => validate(key))
                )
              )
            );
          const describeCache = yield* Cache.makeWith(
            (_key: string) =>
              read(connection =>
                Effect.tryPromise({
                  try: () => connection.metadata.describe(),
                  catch: cause => metadataFailure(cause, 'describe')
                })
              ).pipe(
                Effect.map(value => value.metadataObjects.filter(type => !NON_SUPPORTED_TYPES.has(type.xmlName))),
                Effect.tap(value =>
                  channel.appendToChannel(`Metadata describe call completed. Found ${value.length} metadata types.`)
                )
              ),
            { capacity: 1, timeToLive: successTtl(Duration.minutes(30)) }
          );
          const listSObjectsCache = yield* Cache.makeWith(
            (_key: string) =>
              read(connection =>
                Effect.tryPromise({
                  try: () => connection.describeGlobal(),
                  catch: cause => metadataFailure(cause, 'listSObjects')
                })
              ).pipe(
                Effect.map(value =>
                  value.sobjects.map(({ name, custom, queryable, triggerable }) => ({
                    name,
                    custom,
                    queryable,
                    triggerable
                  }))
                )
              ),
            { capacity: 1, timeToLive: successTtl(Duration.minutes(15)) }
          );
          const sobjectDescribeCache = yield* Cache.makeWith(
            (objectName: string) =>
              read(connection =>
                Effect.tryPromise({
                  try: () => connection.describe(objectName),
                  catch: cause => metadataFailure(cause, 'describeCustomObject', objectName)
                }).pipe(Effect.tap(value => transmogrifier.toMinimalSObject(value)))
              ),
            { capacity: 2000, timeToLive: successTtl(Duration.minutes(15)) }
          );
          const listMetadataCache = yield* Cache.makeWith(
            (request: ListMetadataKey) =>
              read(connection =>
                Effect.gen(function* () {
                  if (request.type === 'StandardValueSet' && !request.folder)
                    return standardValueSet.fullnames
                      .map(fullName => ({ fullName, type: 'StandardValueSet' }))
                      .toSorted((left, right) => left.fullName.localeCompare(right.fullName));
                  const result = yield* Effect.tryPromise({
                    try: () =>
                      connection.metadata.list({
                        type: request.type,
                        ...(request.folder ? { folder: request.folder } : {})
                      }),
                    catch: cause =>
                      new ListMetadataError({
                        cause,
                        metadataType: request.type,
                        folder: request.folder,
                        message: `Failed to list metadata type ${request.type}${request.folder ? ` in folder ${request.folder}` : ''}: ${unknownToErrorCause(cause).message}`
                      })
                  });
                  return yield* Schema.decodeUnknownEffect(Schema.Array(FilePropertiesSchema))(
                    Array.isArray(result) ? result : [result]
                  ).pipe(
                    Effect.map(values =>
                      Arr.dedupeAdjacentWith(
                        values.toSorted((left, right) => left.fullName.localeCompare(right.fullName)),
                        FilePropertiesByFullName
                      )
                    ),
                    Effect.catchTag('SchemaError', cause =>
                      Effect.fail(
                        new ListMetadataError({
                          cause,
                          metadataType: request.type,
                          folder: request.folder,
                          message: `Failed to decode list metadata result for type ${request.type}: ${cause.message}`
                        })
                      )
                    )
                  );
                })
              ),
            { capacity: 500, timeToLive: successTtl(Duration.minutes(5)) }
          );
          const runSObjectBatch = Effect.fn('MetadataDescribeService.runSObjectBatch')(
            (names: readonly string[]) =>
              read(connection =>
                Effect.tryPromise({
                  try: () =>
                    connection.request<SObjectBatchResponse>({
                      method: 'POST',
                      url: '/composite/batch',
                      body: JSON.stringify({
                        batchRequests: names.map(name => ({
                          method: 'GET',
                          url: `v${connection.version}/sobjects/${name}/describe`
                        }))
                      }),
                      headers: { 'User-Agent': 'salesforcedx-extension', 'Sforce-Call-Options': 'client=sfdx-vscode' }
                    }),
                  catch: cause => metadataFailure(cause, 'describeCustomObjects')
                })
              ),
            operations.run
          );
          return {
            describeCache,
            listSObjectsCache,
            sobjectDescribeCache,
            listMetadataCache,
            runSObjectBatch,
            revision,
            observations,
            withRevision
          };
        }),
      { capacity: 20, timeToLive: successTtl(Duration.infinity) }
    );
    const describe = Effect.fn('MetadataDescribeService.describe')(function* (expectedOrgId?: OrgId) {
      const key = yield* capture(expectedOrgId);
      const caches = yield* Cache.get(orgCaches, key);
      const revision = yield* Ref.get(caches.revision);
      return yield* Cache.get(caches.describeCache, 'describe').pipe(
        Effect.tap(value =>
          recorder
            .recordMetadataTypes(key.orgId, key.orgGeneration, value)
            .pipe(caches.withRevision(revision, invalidatedDescribe()))
        )
      );
    }, operations.run);
    const listSObjects = Effect.fn('MetadataDescribeService.listSObjects')(function* (expectedOrgId?: OrgId) {
      const key = yield* capture(expectedOrgId);
      const caches = yield* Cache.get(orgCaches, key);
      const revision = yield* Ref.get(caches.revision);
      return yield* Cache.get(caches.listSObjectsCache, 'global').pipe(
        Effect.tap(value =>
          recorder
            .recordSObjectList(key.orgId, key.orgGeneration, value)
            .pipe(caches.withRevision(revision, invalidatedDescribe()))
        )
      );
    }, operations.run);
    const describeCustomObject = Effect.fn('MetadataDescribeService.describeCustomObject')(function* (
      objectName: string,
      expectedOrgId?: OrgId
    ) {
      const key = yield* capture(expectedOrgId);
      const caches = yield* Cache.get(orgCaches, key);
      const revision = yield* Ref.get(caches.revision);
      return yield* Cache.get(caches.sobjectDescribeCache, objectName).pipe(
        Effect.tap(value =>
          recorder
            .recordSObjectDescription(key.orgId, key.orgGeneration, value)
            .pipe(caches.withRevision(revision, invalidatedDescribe()))
        )
      );
    }, operations.run);
    const describeCustomObjects = Effect.fn('MetadataDescribeService.describeCustomObjects')(function* (
      objectNames: string[],
      expectedOrgId?: OrgId
    ) {
      const key = yield* capture(expectedOrgId);
      const caches = yield* Cache.get(orgCaches, key);
      const revision = yield* Ref.get(caches.revision);
      const checks = yield* Effect.forEach(objectNames, name =>
        Cache.getSuccess(caches.sobjectDescribeCache, name).pipe(Effect.map(value => ({ name, value })))
      );
      const hits = checks.flatMap(({ value }) => Option.toArray(value));
      const misses = checks.filter(({ value }) => Option.isNone(value)).map(({ name }) => name);
      const loadBatch = Effect.fn('MetadataDescribeService.loadBatch')(function* (names: readonly string[]) {
        const response = yield* caches.runSObjectBatch(names);
        return yield* Effect.forEach(
          response.results.flatMap((row, index) =>
            Array.isArray(row.result) ? [] : [{ name: names[index]!, result: row.result }]
          ),
          pair =>
            validate(key).pipe(
              Effect.andThen(transmogrifier.toMinimalSObject(pair.result)),
              Effect.andThen(Cache.set(caches.sobjectDescribeCache, pair.name, pair.result)),
              Effect.as(pair.result),
              caches.withRevision(revision, invalidatedDescribe())
            )
        );
      }, operations.run);
      const batches = Stream.fromIterable(misses).pipe(
        Stream.grouped(25),
        Stream.mapEffect(loadBatch, { concurrency: 15 }),
        Stream.flatMap(Stream.fromIterable)
      );
      // Both cache hits and network results remain owner/epoch guarded through lazy consumption.
      return Stream.concat(Stream.fromIterable(hits), batches).pipe(
        Stream.mapEffect(value =>
          operations.run(
            validate(key).pipe(
              Effect.andThen(recorder.recordSObjectDescription(key.orgId, key.orgGeneration, value)),
              Effect.as(value),
              caches.withRevision(revision, invalidatedDescribe())
            )
          )
        )
      );
    }, operations.run);
    const listMetadata = Effect.fn('MetadataDescribeService.listMetadata')(function* (
      type: string,
      folder?: string,
      expectedOrgId?: OrgId
    ) {
      const key = yield* capture(expectedOrgId);
      const caches = yield* Cache.get(orgCaches, key);
      const revision = yield* Ref.get(caches.revision);
      return yield* Cache.get(caches.listMetadataCache, { type, folder }).pipe(
        Effect.tap(value =>
          recorder.recordMetadataListing(key.orgId, key.orgGeneration, type, folder, value).pipe(
            caches.withRevision(
              revision,
              new ListMetadataError({
                metadataType: type,
                folder,
                message: 'Metadata changed while its listing was being read',
                cause: 'Metadata cache invalidated'
              })
            )
          )
        )
      );
    }, operations.run);
    const listMetadataCached = Effect.fn('MetadataDescribeService.listMetadataCached')(function* (
      type: string,
      folder?: string,
      expectedOrgId?: OrgId
    ) {
      const key = yield* capture(expectedOrgId);
      const caches = yield* Cache.get(orgCaches, key);
      return yield* caches.observations.withPermit(
        changes.commitIfCurrent(
          key.orgGeneration,
          changedError(key.orgId),
          Cache.getSuccess(caches.listMetadataCache, { type, folder })
        )
      );
    }, operations.run);
    const invalidate = Effect.fn('MetadataDescribeService.invalidate')(function* (
      expectedOrgId: OrgId | undefined,
      clear: (caches: Effect.Success<ReturnType<typeof orgCaches.lookup>>) => Effect.Effect<void>
    ) {
      const orgId = expectedOrgId ?? (yield* changes.snapshot).org.orgId;
      if (!orgId) return;
      const entries = yield* Cache.entries(orgCaches);
      yield* Effect.forEach(
        [...entries].filter(([key]) => key.orgId === orgId),
        ([, caches]) =>
          caches.observations.withPermit(
            Ref.update(caches.revision, value => value + 1).pipe(Effect.andThen(clear(caches)))
          ),
        { discard: true }
      );
    }, operations.run);
    const invalidateDescribe = (orgId?: OrgId) =>
      invalidate(orgId, caches => Cache.invalidate(caches.describeCache, 'describe'));
    const invalidateListSObjects = (orgId?: OrgId) =>
      invalidate(orgId, caches => Cache.invalidate(caches.listSObjectsCache, 'global'));
    const invalidateListMetadata = (type: string, folder?: string, orgId?: OrgId) =>
      invalidate(orgId, caches => Cache.invalidate(caches.listMetadataCache, { type, folder }));
    const invalidateAllListMetadata = (orgId?: OrgId) =>
      invalidate(orgId, caches => Cache.invalidateAll(caches.listMetadataCache));
    const invalidateSObjectDescribes = (names?: readonly string[], orgId?: OrgId) =>
      invalidate(orgId, caches =>
        names
          ? Effect.forEach(names, name => Cache.invalidate(caches.sobjectDescribeCache, name), { discard: true })
          : Cache.invalidateAll(caches.sobjectDescribeCache)
      );
    const invalidateForMetadataChanges = Effect.fn('MetadataDescribeService.invalidateForMetadataChanges')(function* (
      orgId: OrgId,
      references: readonly { readonly xmlName: string; readonly fullName: string }[]
    ) {
      yield* Effect.forEach(
        new Set(references.map(reference => reference.xmlName)),
        xmlName =>
          FOLDERED_METADATA_TYPES.has(xmlName)
            ? invalidateAllListMetadata(orgId)
            : invalidateListMetadata(xmlName, undefined, orgId),
        { discard: true }
      );
      const names = referencesToAffectedSObjects(references);
      if (names.size > 0) {
        yield* invalidateListSObjects(orgId);
        yield* invalidateSObjectDescribes([...names], orgId);
      }
    }, operations.run);
    const invalidateForTracking = Effect.fn('MetadataDescribeService.invalidateForTracking')(function* (
      orgId: OrgId,
      orgGeneration: number,
      references: readonly { readonly xmlName: string; readonly fullName: string }[],
      sObjectOnly = false
    ) {
      if (references.length === 0) return;
      const types = new Set(sObjectOnly ? [] : references.map(reference => reference.xmlName));
      const names = referencesToAffectedSObjects(references);
      const entries = yield* Cache.entries(orgCaches);
      yield* Effect.forEach(
        [...entries].filter(([key]) => key.orgId === orgId),
        ([, caches]) =>
          caches.observations.withPermit(
            changes.commitIfCurrent(
              orgGeneration,
              changedError(orgId),
              Ref.update(caches.revision, revision => revision + 1).pipe(
                Effect.andThen(
                  [...types].some(type => FOLDERED_METADATA_TYPES.has(type))
                    ? Cache.invalidateAll(caches.listMetadataCache)
                    : Effect.forEach(
                        types,
                        type => Cache.invalidate(caches.listMetadataCache, { type, folder: undefined }),
                        { discard: true }
                      )
                ),
                Effect.andThen(
                  names.size > 0
                    ? (sObjectOnly ? Effect.void : Cache.invalidate(caches.listSObjectsCache, 'global')).pipe(
                        Effect.andThen(
                          Effect.forEach(names, name => Cache.invalidate(caches.sobjectDescribeCache, name), {
                            discard: true
                          })
                        )
                      )
                    : Effect.void
                )
              )
            )
          ),
        { discard: true }
      );
      yield* changes.commitIfCurrent(orgGeneration, changedError(orgId), Effect.void);
    }, operations.run);
    const invalidateHierarchy = Effect.fn('MetadataDescribeService.invalidateHierarchy')(function* (
      orgId: OrgId,
      orgGeneration: number,
      xmlName?: string
    ) {
      const entries = yield* Cache.entries(orgCaches);
      yield* Effect.forEach(
        [...entries].filter(([key]) => key.orgId === orgId),
        ([, caches]) =>
          caches.observations.withPermit(
            changes.commitIfCurrent(
              orgGeneration,
              changedError(orgId),
              Ref.update(caches.revision, value => value + 1).pipe(
                Effect.andThen(() => {
                  if (!xmlName) return Cache.invalidate(caches.describeCache, 'describe');
                  return FOLDERED_METADATA_TYPES.has(xmlName)
                    ? Cache.invalidateAll(caches.listMetadataCache)
                    : Cache.invalidate(caches.listMetadataCache, { type: xmlName, folder: undefined });
                })
              )
            )
          ),
        { discard: true }
      );
      yield* changes.commitIfCurrent(orgGeneration, changedError(orgId), Effect.void);
    }, operations.run);
    yield* Effect.addFinalizer(() => operations.close);
    return Context.make(MetadataDescribeService, {
      describe,
      listSObjects,
      describeCustomObject,
      describeCustomObjects,
      listMetadata,
      listMetadataCached,
      invalidateDescribe,
      invalidateListSObjects,
      invalidateListMetadata,
      invalidateAllListMetadata,
      invalidateSObjectDescribes,
      invalidateSObjectDescribe: (name, orgId) => invalidateSObjectDescribes([name], orgId),
      invalidateForMetadataChanges
    }).pipe(Context.add(MetadataDescribeInvalidation, { invalidateForTracking, invalidateHierarchy }));
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
