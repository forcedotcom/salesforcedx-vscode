/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type {
  InventoryCache,
  MetadataListingObservation,
  MetadataTypeObservation,
  PersistedInventoryCache,
  RemoteTrackingObservations,
  TypeInventory,
  WorkspaceTypeInventory
} from './orgCatalogInternalTypes.js';
import {
  isOrgMetadataComponentReference,
  type OrgId,
  type OrgSObjectDescription,
  type OrgSObjectSummary
} from '@salesforce/vscode-services-v2';
import * as Cause from 'effect/Cause';
import * as Clock from 'effect/Clock';
import * as Context from 'effect/Context';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as HashMap from 'effect/HashMap';
import * as HashSet from 'effect/HashSet';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Order from 'effect/Order';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Semaphore from 'effect/Semaphore';
import { finalizerFailureCause, makeScopedFibers } from '../scopedFiber.js';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { componentIdentity, metadataListingKey, sobjectDescriptionKey, typeCacheKey } from './orgCatalogKeys.js';
import {
  OrgMetadataCatalogStoreCleanup,
  type OrgMetadataCatalogSnapshot,
  type PersistedTypeInventory
} from './orgMetadataCatalogStore.js';

const hierarchyGenerationKey = (orgId: OrgId, xmlName?: string) => `${orgId}\0${xmlName ?? ''}`;
const emptyTracking = (): RemoteTrackingObservations => ({ byIdentity: HashMap.empty(), identityOrder: [] });
const byXmlName = Order.mapInput(Order.String, (value: PersistedTypeInventory) => value.xmlName);
const bySObjectName = Order.mapInput(Order.String, (value: OrgSObjectDescription) => value.name);
const byTrackingIdentity = Order.combine(
  Order.mapInput(Order.String, (value: OrgMetadataCatalogSnapshot['tracking'][number]) => value.xmlName),
  Order.mapInput(Order.String, (value: OrgMetadataCatalogSnapshot['tracking'][number]) => value.fullName)
);
const byListing = Order.combine(
  Order.mapInput(Order.String, (value: OrgMetadataCatalogSnapshot['metadataListings'][number]) => value.xmlName),
  Order.mapInput(Order.String, (value: OrgMetadataCatalogSnapshot['metadataListings'][number]) => value.folder ?? '')
);
const toPersistedInventory = (xmlName: string, inventory: TypeInventory): PersistedTypeInventory => ({
  xmlName,
  observedAt: inventory.observedAt,
  complete: inventory.complete,
  components: inventory.componentIdentityOrder.flatMap(identity =>
    Option.match(HashMap.get(inventory.components, identity), {
      onNone: () => [],
      onSome: component =>
        component.inOrg
          ? [
              {
                fullName: isOrgMetadataComponentReference(component.reference)
                  ? component.reference.fullName
                  : component.name,
                namespacePrefix: component.namespacePrefix,
                manageableState: component.manageableState,
                fileName: component.fileName,
                lastModifiedByName: component.lastModifiedByName,
                lastModifiedDate: component.lastModifiedDate
              }
            ]
          : []
    })
  ),
  folders: inventory.folderFullNameOrder.flatMap(name =>
    Option.match(HashMap.get(inventory.folders, name), { onNone: () => [], onSome: folder => [folder] })
  )
});

const makeOrgCatalogState = Effect.gen(function* () {
  const cleanupStore = yield* OrgMetadataCatalogStoreCleanup;
  const operations = yield* ServiceOperations;
  const scopedFibers = yield* makeScopedFibers;
  const inventoryCache = yield* Ref.make<InventoryCache>(HashMap.empty());
  const hierarchyGenerations = yield* Ref.make<HashMap.HashMap<string, number>>(HashMap.empty());
  const persistedInventoryCache = yield* Ref.make<PersistedInventoryCache>(HashMap.empty());
  const inventorySemaphores = yield* Ref.make<HashMap.HashMap<string, Semaphore.Semaphore>>(HashMap.empty());
  const remoteTrackingCache = yield* Ref.make<HashMap.HashMap<OrgId, RemoteTrackingObservations>>(HashMap.empty());
  const metadataTypeCache = yield* Ref.make<HashMap.HashMap<OrgId, readonly MetadataTypeObservation[]>>(
    HashMap.empty()
  );
  const metadataListingCache = yield* Ref.make<HashMap.HashMap<string, MetadataListingObservation>>(HashMap.empty());
  const workspaceTypeCache = yield* Ref.make<HashMap.HashMap<OrgId, WorkspaceTypeInventory>>(HashMap.empty());
  const sobjectListCache = yield* Ref.make<HashMap.HashMap<OrgId, readonly OrgSObjectSummary[]>>(HashMap.empty());
  const sobjectDescriptionCache = yield* Ref.make<HashMap.HashMap<string, OrgSObjectDescription>>(HashMap.empty());
  const hydratedOrgIds = yield* Ref.make<HashSet.HashSet<OrgId>>(HashSet.empty());
  // Deletions before the first successful hydration are newer evidence, just like present volatile values.
  const invalidatedInventories = yield* Ref.make<HashSet.HashSet<string>>(HashSet.empty());
  const invalidatedSObjectLists = yield* Ref.make<HashSet.HashSet<OrgId>>(HashSet.empty());
  const invalidatedSObjectDescriptions = yield* Ref.make<HashSet.HashSet<string>>(HashSet.empty());
  const removedTracking = yield* Ref.make<HashSet.HashSet<string>>(HashSet.empty());
  const persistedGenerations = yield* Ref.make<HashMap.HashMap<OrgId, number>>(HashMap.empty());
  const hydratePermit = yield* Semaphore.make(1);
  const persistPermit = yield* Semaphore.make(1);
  // Generation comparisons and bounded cache publication share the same permit as every hierarchy invalidator.
  // Acquire after inventory permits, before the org permit; never hold it across SDK/network work.
  const hierarchyCommitPermit = yield* Semaphore.make(1);
  const requests = yield* Effect.acquireRelease(Queue.unbounded<void>(), Queue.shutdown);
  // Keep a version until its native save settles. New changes during a save must survive its acknowledgment.
  const dirtyVersions = yield* Ref.make<HashMap.HashMap<OrgId, number>>(HashMap.empty());
  const markDirty = (orgId: OrgId) =>
    Ref.update(dirtyVersions, current =>
      HashMap.set(current, orgId, Option.getOrElse(HashMap.get(current, orgId), () => 0) + 1)
    );

  const persistOrgRaw = Effect.fn('OrgCatalogState.persistOrg')((orgId: OrgId) =>
    persistPermit.withPermit(
      Effect.gen(function* () {
        // Also required during shutdown: an org can become writable before another reader hydrates it.
        yield* ensureHydratedRaw(orgId);
        const dirtyVersion = Option.getOrUndefined(HashMap.get(yield* Ref.get(dirtyVersions), orgId));
        const [loaded, restored, lists, descriptions, tracking, metadataTypes, listings] = yield* Effect.all([
          Ref.get(inventoryCache),
          Ref.get(persistedInventoryCache),
          Ref.get(sobjectListCache),
          Ref.get(sobjectDescriptionCache),
          Ref.get(remoteTrackingCache),
          Ref.get(metadataTypeCache),
          Ref.get(metadataListingCache)
        ]);
        const inventories = HashMap.reduce(
          loaded,
          HashMap.reduce(restored, HashMap.empty<string, PersistedTypeInventory>(), (result, value, key) =>
            key.startsWith(`${orgId}\0`) ? HashMap.set(result, value.xmlName, value) : result
          ),
          (result, value, key) =>
            key.startsWith(`${orgId}\0`)
              ? HashMap.set(
                  result,
                  key.slice(orgId.length + 1),
                  toPersistedInventory(key.slice(orgId.length + 1), value)
                )
              : result
        );
        const generation = yield* Ref.modify(persistedGenerations, current => {
          const next = Option.getOrElse(HashMap.get(current, orgId), () => 0) + 1;
          return [next, HashMap.set(current, orgId, next)] as const;
        });
        const snapshot: OrgMetadataCatalogSnapshot = {
          version: 2,
          orgId,
          generation,
          writtenAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
          inventory: HashMap.toValues(inventories).toSorted(byXmlName),
          sobjects: {
            list: Option.getOrUndefined(HashMap.get(lists, orgId)),
            descriptions: HashMap.toEntries(descriptions)
              .filter(([key]) => key.startsWith(`${orgId}\0`))
              .map(([, value]) => value)
              .toSorted(bySObjectName)
          },
          tracking: HashMap.toValues(Option.getOrElse(HashMap.get(tracking, orgId), emptyTracking).byIdentity)
            .map(value => ({
              xmlName: value.reference.xmlName,
              fullName: value.reference.fullName,
              signature: value.signature
            }))
            .toSorted(byTrackingIdentity),
          metadataTypes: [...Option.getOrElse(HashMap.get(metadataTypes, orgId), () => [])],
          metadataListings: HashMap.toEntries(listings)
            .filter(([key]) => key.startsWith(`${orgId}\0`))
            .map(([, value]) => value)
            .toSorted(byListing)
        };
        yield* cleanupStore.save(snapshot);
        yield* Ref.update(dirtyVersions, current =>
          Option.getOrUndefined(HashMap.get(current, orgId)) === dirtyVersion ? HashMap.remove(current, orgId) : current
        );
        return true;
      }).pipe(
        Effect.onError(() => markDirty(orgId)),
        Effect.uninterruptible
      )
    )
  );
  const persistOrg = Effect.fn('OrgCatalogState.persistOrg.bestEffort')((orgId: OrgId) =>
    persistOrgRaw(orgId).pipe(
      Effect.catchTag('NoWorkspaceOpenError', () => Effect.succeed(false)),
      Effect.catchTag(['FsServiceError', 'SchemaError', 'OrgMetadataCatalogSnapshotOrgMismatchError'], error =>
        Effect.logWarning('Failed to persist org metadata catalog', error).pipe(Effect.as(false))
      ),
      Effect.uninterruptible
    )
  );
  const queuePersist = Effect.fn('OrgCatalogState.queuePersist')((orgId: OrgId) =>
    markDirty(orgId).pipe(
      Effect.andThen(Queue.offer(requests, undefined)),
      Effect.flatMap(offered => (offered ? Effect.void : Effect.interrupt)),
      Effect.uninterruptible
    )
  );
  const flushOrg = Effect.fn('OrgCatalogState.flushOrg')(function* (orgId: OrgId) {
    const dirty = HashMap.has(yield* Ref.get(dirtyVersions), orgId);
    const persisted = dirty ? yield* persistOrg(orgId) : false;
    yield* Effect.annotateCurrentSpan({ orgId, dirty, persisted });
    return persisted;
  });
  const pendingOrgIds = Ref.get(dirtyVersions).pipe(Effect.map(current => [...HashMap.keys(current)].toSorted()));
  yield* Effect.addFinalizer(() =>
    pendingOrgIds.pipe(
      Effect.flatMap(ids =>
        Effect.forEach(
          ids,
          orgId =>
            persistOrgRaw(orgId).pipe(
              Effect.catchTag('NoWorkspaceOpenError', () => Effect.void),
              Effect.exit
            ),
          { concurrency: 1 }
        )
      ),
      Effect.flatMap(exits => {
        const cause = finalizerFailureCause(
          Cause.fromReasons(exits.flatMap(exit => (Exit.isFailure(exit) ? exit.cause.reasons : [])))
        );
        return cause.reasons.length > 0 ? Effect.failCause(cause) : Effect.void;
      })
    )
  );
  yield* Effect.forever(
    Effect.gen(function* () {
      yield* Queue.take(requests);
      yield* Effect.sleep(Duration.millis(250));
      // V4 takeAll waits on empty queues. Clearing must not require a second change to flush the first.
      yield* Queue.clear(requests);
      yield* pendingOrgIds.pipe(
        Effect.flatMap(ids => Effect.forEach(ids, persistOrg, { concurrency: 1, discard: true }))
      );
    })
  ).pipe(scopedFibers.fork);

  const ensureHydratedRaw = Effect.fn('OrgCatalogState.ensureHydratedRaw')((orgId: OrgId) =>
    hydratePermit.withPermit(
      Effect.gen(function* () {
        if (HashSet.has(yield* Ref.get(hydratedOrgIds), orgId)) return;
        // The scope-owned shutdown flush is allowed to load after ordinary service admission closes.
        const snapshot = yield* cleanupStore.load(orgId);
        if (snapshot) {
          const inventoriesRemoved = yield* Ref.get(invalidatedInventories);
          const listsRemoved = yield* Ref.get(invalidatedSObjectLists);
          const descriptionsRemoved = yield* Ref.get(invalidatedSObjectDescriptions);
          const trackingRemoved = yield* Ref.get(removedTracking);
          const inventory = snapshot.inventory.filter(
            value =>
              !HashSet.has(inventoriesRemoved, hierarchyGenerationKey(orgId)) &&
              !HashSet.has(inventoriesRemoved, typeCacheKey(orgId, value.xmlName))
          );
          const descriptions = snapshot.sobjects.descriptions.filter(
            value =>
              !HashSet.has(descriptionsRemoved, hierarchyGenerationKey(orgId)) &&
              !HashSet.has(descriptionsRemoved, sobjectDescriptionKey(orgId, value.name))
          );
          const tracking = snapshot.tracking.filter(
            value =>
              !HashSet.has(
                trackingRemoved,
                `${orgId}\0${componentIdentity({ xmlName: value.xmlName, fullName: value.fullName })}`
              )
          );
          // Volatile observations learned before mounting are newer than the restored on-disk snapshot.
          yield* Ref.update(persistedInventoryCache, current =>
            HashMap.union(
              HashMap.fromIterable(inventory.map(value => [typeCacheKey(orgId, value.xmlName), value] as const)),
              current
            )
          );
          if (snapshot.sobjects.list && !HashSet.has(listsRemoved, orgId))
            yield* Ref.update(sobjectListCache, current =>
              HashMap.has(current, orgId) ? current : HashMap.set(current, orgId, snapshot.sobjects.list ?? [])
            );
          yield* Ref.update(sobjectDescriptionCache, current =>
            HashMap.union(
              HashMap.fromIterable(
                descriptions.map(value => [sobjectDescriptionKey(orgId, value.name), value] as const)
              ),
              current
            )
          );
          yield* Ref.update(remoteTrackingCache, current =>
            HashMap.has(current, orgId)
              ? current
              : HashMap.set(current, orgId, {
                  byIdentity: HashMap.fromIterable(
                    tracking.map(
                      value =>
                        [
                          componentIdentity({ xmlName: value.xmlName, fullName: value.fullName }),
                          {
                            reference: { xmlName: value.xmlName, fullName: value.fullName },
                            signature: value.signature
                          }
                        ] as const
                    )
                  ),
                  identityOrder: tracking.map(value =>
                    componentIdentity({ xmlName: value.xmlName, fullName: value.fullName })
                  )
                })
          );
          yield* Ref.update(metadataTypeCache, current =>
            HashMap.has(current, orgId) ? current : HashMap.set(current, orgId, snapshot.metadataTypes)
          );
          yield* Ref.update(metadataListingCache, current =>
            HashMap.union(
              HashMap.fromIterable(
                snapshot.metadataListings.map(
                  value => [metadataListingKey(orgId, value.xmlName, value.folder), value] as const
                )
              ),
              current
            )
          );
          yield* Ref.update(persistedGenerations, current =>
            HashMap.set(
              current,
              orgId,
              Math.max(
                snapshot.generation,
                Option.getOrElse(HashMap.get(current, orgId), () => 0)
              )
            )
          );
        }
        yield* Ref.update(hydratedOrgIds, current => HashSet.add(current, orgId));
      })
    )
  );
  const ensureHydrated = Effect.fn('OrgCatalogState.ensureHydrated')((orgId: OrgId) =>
    ensureHydratedRaw(orgId).pipe(
      // Missing/unreadable workspaces remain retryable, never authoritative empty snapshots.
      Effect.catchTag('NoWorkspaceOpenError', () => Effect.void),
      Effect.catchTag(['FsServiceError', 'OrgMetadataCatalogSnapshotOrgMismatchError'], error =>
        Effect.logWarning('Failed to hydrate org metadata catalog', error)
      )
    )
  );
  const getInventorySemaphore = Effect.fn('OrgCatalogState.getInventorySemaphore')(function* (key: string) {
    const existing = HashMap.get(yield* Ref.get(inventorySemaphores), key);
    if (Option.isSome(existing)) return existing.value;
    const candidate = yield* Semaphore.make(1);
    return yield* Ref.modify(inventorySemaphores, current =>
      Option.match(HashMap.get(current, key), {
        onNone: () => [candidate, HashMap.set(current, key, candidate)] as const,
        onSome: value => [value, current] as const
      })
    );
  });
  const withInventorySemaphores =
    (semaphores: readonly Semaphore.Semaphore[]) =>
    <A, E, R>(program: Effect.Effect<A, E, R>) =>
      semaphores.reduceRight((guarded, permit) => permit.withPermit(guarded), program);
  const activeInventorySemaphores = (orgId: OrgId) =>
    Ref.get(inventorySemaphores).pipe(
      Effect.map(current =>
        HashMap.toEntries(current)
          .filter(([key]) => key.startsWith(`${orgId}\0`))
          .toSorted(([left], [right]) => Order.String(left, right))
          .map(([, value]) => value)
      )
    );
  const invalidateHierarchyGenerations = (orgId: OrgId, xmlNames?: ReadonlySet<string>) =>
    Ref.update(hierarchyGenerations, current =>
      [
        hierarchyGenerationKey(orgId),
        ...(xmlNames ? [...xmlNames].map(name => hierarchyGenerationKey(orgId, name)) : [])
      ].reduce(
        (result, key) => HashMap.set(result, key, Option.getOrElse(HashMap.get(result, key), () => 0) + 1),
        current
      )
    );
  const invalidateOrgInventoriesRaw = (orgId: OrgId) =>
    Effect.all(
      [
        Ref.update(invalidatedInventories, current => HashSet.add(current, hierarchyGenerationKey(orgId))),
        invalidateHierarchyGenerations(orgId),
        Ref.update(inventoryCache, current => HashMap.filter(current, (_value, key) => !key.startsWith(`${orgId}\0`))),
        Ref.update(persistedInventoryCache, current =>
          HashMap.filter(current, (_value, key) => !key.startsWith(`${orgId}\0`))
        ),
        Ref.update(workspaceTypeCache, current => HashMap.remove(current, orgId))
      ],
      { discard: true }
    ).pipe(Effect.uninterruptible, program => hydratePermit.withPermit(program));
  const invalidateWorkspaceInventoriesRaw = (orgId: OrgId) =>
    Effect.gen(function* () {
      const loaded = yield* Ref.get(inventoryCache);
      yield* Ref.update(persistedInventoryCache, current =>
        HashMap.reduce(loaded, current, (result, value, key) =>
          key.startsWith(`${orgId}\0`) && value.complete
            ? HashMap.set(result, key, toPersistedInventory(key.slice(orgId.length + 1), value))
            : result
        )
      );
      yield* invalidateHierarchyGenerations(orgId);
      yield* Ref.update(inventoryCache, current =>
        HashMap.filter(current, (_value, key) => !key.startsWith(`${orgId}\0`))
      );
      yield* Ref.update(workspaceTypeCache, current => HashMap.remove(current, orgId));
    }).pipe(Effect.uninterruptible);
  /** Snapshot inventory permits before the caller's bounded org validation. */
  const withOrgInvalidation = <A, E, R>(
    orgId: OrgId,
    mode: 'org' | 'workspace',
    commit: (invalidate: Effect.Effect<void>) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R> =>
    activeInventorySemaphores(orgId).pipe(
      Effect.flatMap(semaphores =>
        hierarchyCommitPermit
          .withPermit(
            commit(mode === 'org' ? invalidateOrgInventoriesRaw(orgId) : invalidateWorkspaceInventoriesRaw(orgId))
          )
          .pipe(withInventorySemaphores(semaphores))
      ),
      operations.run,
      Effect.withSpan('OrgCatalogState.withOrgInvalidation')
    );
  const invalidateOrgInventories = Effect.fn('OrgCatalogState.invalidateOrgInventories')((orgId: OrgId) =>
    withOrgInvalidation(orgId, 'org', program => program)
  );
  const invalidateWorkspaceInventories = Effect.fn('OrgCatalogState.invalidateWorkspaceInventories')((orgId: OrgId) =>
    withOrgInvalidation(orgId, 'workspace', program => program)
  );
  const invalidateTypesRaw = (orgId: OrgId, xmlNames: ReadonlySet<string>) =>
    Effect.all(
      [
        invalidateHierarchyGenerations(orgId, xmlNames),
        Ref.update(invalidatedInventories, current =>
          HashSet.union(current, HashSet.fromIterable([...xmlNames].map(name => typeCacheKey(orgId, name))))
        ),
        Ref.update(inventoryCache, current =>
          HashMap.removeMany(
            current,
            [...xmlNames].map(name => typeCacheKey(orgId, name))
          )
        ),
        Ref.update(persistedInventoryCache, current =>
          HashMap.removeMany(
            current,
            [...xmlNames].map(name => typeCacheKey(orgId, name))
          )
        )
      ],
      { discard: true }
    ).pipe(Effect.uninterruptible, program => hydratePermit.withPermit(program));
  /** Acquire inventory permits before the caller's atomic org validation; no rejected commit may mutate state. */
  const withTypeInvalidation = <A, E, R>(
    orgId: OrgId,
    xmlNames: ReadonlySet<string>,
    commit: (invalidate: Effect.Effect<void>) => Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R> =>
    Effect.forEach([...xmlNames].toSorted(), name => getInventorySemaphore(typeCacheKey(orgId, name))).pipe(
      Effect.flatMap(semaphores =>
        hierarchyCommitPermit
          .withPermit(commit(invalidateTypesRaw(orgId, xmlNames)))
          .pipe(withInventorySemaphores(semaphores))
      ),
      operations.run,
      Effect.withSpan('OrgCatalogState.withTypeInvalidation')
    );
  const invalidateTypes = Effect.fn('OrgCatalogState.invalidateTypes')((orgId: OrgId, xmlNames: ReadonlySet<string>) =>
    withTypeInvalidation(orgId, xmlNames, program => program)
  );
  const removeSObjectDescriptions = Effect.fn('OrgCatalogState.removeSObjectDescriptions')(
    (orgId: OrgId, names?: ReadonlySet<string>) =>
      Ref.update(invalidatedSObjectDescriptions, current =>
        HashSet.union(
          current,
          HashSet.fromIterable(
            names ? [...names].map(name => sobjectDescriptionKey(orgId, name)) : [hierarchyGenerationKey(orgId)]
          )
        )
      ).pipe(
        Effect.andThen(
          Ref.update(sobjectDescriptionCache, current =>
            names
              ? HashMap.removeMany(
                  current,
                  [...names].map(name => sobjectDescriptionKey(orgId, name))
                )
              : HashMap.filter(current, (_value, key) => !key.startsWith(`${orgId}\0`))
          )
        )
      )
  );
  yield* Effect.addFinalizer(() => operations.close);
  const guardMethod =
    <Args extends readonly unknown[], A, E, R>(method: (...args: Args) => Effect.Effect<A, E, R>) =>
    (...args: Args): Effect.Effect<A, E, R> =>
      operations.run(method(...args));
  const withHierarchyCommit = <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    hierarchyCommitPermit
      .withPermit(program)
      .pipe(operations.run, Effect.withSpan('OrgCatalogState.withHierarchyCommit'));
  return {
    ensureHydrated: guardMethod(ensureHydrated),
    persistOrg: guardMethod(persistOrg),
    queuePersist: guardMethod(queuePersist),
    flushOrg: guardMethod(flushOrg),
    getInventorySemaphore: guardMethod(getInventorySemaphore),
    invalidateOrgInventories: guardMethod(invalidateOrgInventories),
    invalidateWorkspaceInventories: guardMethod(invalidateWorkspaceInventories),
    invalidateTypes: guardMethod(invalidateTypes),
    withTypeInvalidation,
    withOrgInvalidation,
    withHierarchyCommit,
    getInventorySnapshot: guardMethod(
      Effect.fn('OrgCatalogState.getInventorySnapshot')((orgId: OrgId, xmlName: string) =>
        hierarchyCommitPermit.withPermit(
          Effect.gen(function* () {
            return {
              generation: Option.getOrElse(
                HashMap.get(yield* Ref.get(hierarchyGenerations), hierarchyGenerationKey(orgId)),
                () => 0
              ),
              cached: Option.getOrUndefined(HashMap.get(yield* Ref.get(inventoryCache), typeCacheKey(orgId, xmlName))),
              restored: Option.getOrUndefined(
                HashMap.get(yield* Ref.get(persistedInventoryCache), typeCacheKey(orgId, xmlName))
              )
            };
          })
        )
      )
    ),
    getWorkspaceTypesSnapshot: guardMethod(
      Effect.fn('OrgCatalogState.getWorkspaceTypesSnapshot')((orgId: OrgId) =>
        hierarchyCommitPermit.withPermit(
          Effect.gen(function* () {
            return {
              generation: Option.getOrElse(
                HashMap.get(yield* Ref.get(hierarchyGenerations), hierarchyGenerationKey(orgId)),
                () => 0
              ),
              cached: Option.getOrUndefined(HashMap.get(yield* Ref.get(workspaceTypeCache), orgId))
            };
          })
        )
      )
    ),
    getHierarchyGeneration: guardMethod(
      Effect.fn('OrgCatalogState.getHierarchyGeneration')((orgId: OrgId, xmlName?: string) =>
        Ref.get(hierarchyGenerations).pipe(
          Effect.map(current => Option.getOrElse(HashMap.get(current, hierarchyGenerationKey(orgId, xmlName)), () => 0))
        )
      )
    ),
    getInventory: guardMethod(
      Effect.fn('OrgCatalogState.getInventory')((orgId: OrgId, xmlName: string) =>
        Ref.get(inventoryCache).pipe(
          Effect.map(current => Option.getOrUndefined(HashMap.get(current, typeCacheKey(orgId, xmlName))))
        )
      )
    ),
    getPersistedInventory: guardMethod(
      Effect.fn('OrgCatalogState.getPersistedInventory')((orgId: OrgId, xmlName: string) =>
        Ref.get(persistedInventoryCache).pipe(
          Effect.map(current => Option.getOrUndefined(HashMap.get(current, typeCacheKey(orgId, xmlName))))
        )
      )
    ),
    setInventory: guardMethod(
      Effect.fn('OrgCatalogState.setInventory')((orgId: OrgId, xmlName: string, inventory: TypeInventory) =>
        Ref.update(inventoryCache, current => HashMap.set(current, typeCacheKey(orgId, xmlName), inventory))
      )
    ),
    updateInventories: guardMethod((update: (current: InventoryCache) => InventoryCache) =>
      Ref.update(inventoryCache, update)
    ),
    getWorkspaceTypes: guardMethod(
      Effect.fn('OrgCatalogState.getWorkspaceTypes')((orgId: OrgId) =>
        Ref.get(workspaceTypeCache).pipe(Effect.map(current => Option.getOrUndefined(HashMap.get(current, orgId))))
      )
    ),
    setWorkspaceTypes: guardMethod(
      Effect.fn('OrgCatalogState.setWorkspaceTypes')((orgId: OrgId, types: WorkspaceTypeInventory) =>
        Ref.update(workspaceTypeCache, current => HashMap.set(current, orgId, types))
      )
    ),
    getSObjectList: guardMethod(
      Effect.fn('OrgCatalogState.getSObjectList')((orgId: OrgId) =>
        Ref.get(sobjectListCache).pipe(Effect.map(current => Option.getOrUndefined(HashMap.get(current, orgId))))
      )
    ),
    setSObjectList: guardMethod(
      Effect.fn('OrgCatalogState.setSObjectList')((orgId: OrgId, rows: readonly OrgSObjectSummary[]) =>
        Ref.modify(sobjectListCache, current => {
          const changed = JSON.stringify(Option.getOrUndefined(HashMap.get(current, orgId))) !== JSON.stringify(rows);
          return [changed, changed ? HashMap.set(current, orgId, rows) : current] as const;
        })
      )
    ),
    getSObjectDescription: guardMethod(
      Effect.fn('OrgCatalogState.getSObjectDescription')((orgId: OrgId, name: string) =>
        Ref.get(sobjectDescriptionCache).pipe(
          Effect.map(current => Option.getOrUndefined(HashMap.get(current, sobjectDescriptionKey(orgId, name))))
        )
      )
    ),
    setSObjectDescription: guardMethod(
      Effect.fn('OrgCatalogState.setSObjectDescription')((orgId: OrgId, row: OrgSObjectDescription) =>
        Ref.modify(sobjectDescriptionCache, current => {
          const key = sobjectDescriptionKey(orgId, row.name);
          const changed = JSON.stringify(Option.getOrUndefined(HashMap.get(current, key))) !== JSON.stringify(row);
          return [changed, changed ? HashMap.set(current, key, row) : current] as const;
        })
      )
    ),
    invalidateSObjects: guardMethod(
      Effect.fn('OrgCatalogState.invalidateSObjects')((orgId: OrgId, names?: ReadonlySet<string>) =>
        Ref.update(invalidatedSObjectLists, current => HashSet.add(current, orgId)).pipe(
          Effect.andThen(Ref.update(sobjectListCache, current => HashMap.remove(current, orgId))),
          Effect.andThen(removeSObjectDescriptions(orgId, names)),
          Effect.uninterruptible,
          program => hydratePermit.withPermit(program)
        )
      )
    ),
    getTracking: guardMethod(
      Effect.fn('OrgCatalogState.getTracking')((orgId: OrgId) =>
        Ref.get(remoteTrackingCache).pipe(
          Effect.map(current => Option.getOrElse(HashMap.get(current, orgId), emptyTracking))
        )
      )
    ),
    setTracking: guardMethod(
      Effect.fn('OrgCatalogState.setTracking')((orgId: OrgId, rows: RemoteTrackingObservations) =>
        Ref.update(remoteTrackingCache, current => HashMap.set(current, orgId, rows))
      )
    ),
    removeTracking: guardMethod(
      Effect.fn('OrgCatalogState.removeTracking')((orgId: OrgId, identities: ReadonlySet<string>) =>
        Ref.update(removedTracking, current =>
          HashSet.union(current, HashSet.fromIterable([...identities].map(identity => `${orgId}\0${identity}`)))
        ).pipe(
          Effect.andThen(
            Ref.update(remoteTrackingCache, current =>
              Option.match(HashMap.get(current, orgId), {
                onNone: () => current,
                onSome: rows =>
                  HashMap.set(current, orgId, {
                    byIdentity: HashMap.filter(rows.byIdentity, (_value, identity) => !identities.has(identity)),
                    identityOrder: rows.identityOrder.filter(identity => !identities.has(identity))
                  })
              })
            )
          ),
          Effect.uninterruptible,
          program => hydratePermit.withPermit(program)
        )
      )
    ),
    getMetadataTypes: guardMethod(
      Effect.fn('OrgCatalogState.getMetadataTypes')((orgId: OrgId) =>
        Ref.get(metadataTypeCache).pipe(Effect.map(current => Option.getOrUndefined(HashMap.get(current, orgId))))
      )
    ),
    setMetadataTypes: guardMethod(
      Effect.fn('OrgCatalogState.setMetadataTypes')((orgId: OrgId, rows: readonly MetadataTypeObservation[]) =>
        Ref.modify(metadataTypeCache, current => {
          const changed = JSON.stringify(Option.getOrUndefined(HashMap.get(current, orgId))) !== JSON.stringify(rows);
          return [changed, changed ? HashMap.set(current, orgId, rows) : current] as const;
        })
      )
    ),
    getMetadataListing: guardMethod(
      Effect.fn('OrgCatalogState.getMetadataListing')((orgId: OrgId, xmlName: string, folder?: string) =>
        Ref.get(metadataListingCache).pipe(
          Effect.map(current => Option.getOrUndefined(HashMap.get(current, metadataListingKey(orgId, xmlName, folder))))
        )
      )
    ),
    setMetadataListing: guardMethod(
      Effect.fn('OrgCatalogState.setMetadataListing')((orgId: OrgId, row: MetadataListingObservation) =>
        Ref.modify(metadataListingCache, current => {
          const key = metadataListingKey(orgId, row.xmlName, row.folder);
          const changed = JSON.stringify(Option.getOrUndefined(HashMap.get(current, key))) !== JSON.stringify(row);
          return [changed, changed ? HashMap.set(current, key, row) : current] as const;
        })
      )
    )
  } as const;
});
export class OrgCatalogState extends Context.Service<OrgCatalogState, Effect.Success<typeof makeOrgCatalogState>>()(
  '@salesforce/vscode-services-v4-implementation/OrgCatalogState'
) {}
export const OrgCatalogStateLayer = Layer.effect(OrgCatalogState, makeOrgCatalogState).pipe(
  Layer.provideMerge(ServiceOperationsLayer)
);
