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
  TypeInventory
} from './orgCatalogInternalTypes';
import type { OrgSObjectDescription, OrgSObjectSummary } from './orgMetadataCatalogTypes';
import * as Arr from 'effect/Array';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as HashMap from 'effect/HashMap';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import * as Order from 'effect/Order';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import { componentIdentity, metadataListingKey, sobjectDescriptionKey, typeCacheKey } from './orgCatalogKeys';
import {
  OrgMetadataCatalogStore,
  type OrgMetadataCatalogSnapshot,
  type PersistedTypeInventory
} from './orgMetadataCatalogStore';
import { isOrgMetadataComponentReference } from './orgMetadataReference';

type PersistedTrackingObservation = OrgMetadataCatalogSnapshot['tracking'][number];
type PersistedMetadataListingObservation = OrgMetadataCatalogSnapshot['metadataListings'][number];

const byXmlName = Order.mapInput(Order.string, (value: PersistedTypeInventory) => value.xmlName);
const byName = Order.mapInput(Order.string, (value: OrgSObjectDescription) => value.name);
const byMetadataIdentity = Order.combine(
  Order.mapInput(Order.string, (value: PersistedTrackingObservation) => value.xmlName),
  Order.mapInput(Order.string, (value: PersistedTrackingObservation) => value.fullName)
);
const byMetadataListing = Order.combine(
  Order.mapInput(Order.string, (value: PersistedMetadataListingObservation) => value.xmlName),
  Order.mapInput(Order.string, (value: PersistedMetadataListingObservation) => value.folder ?? '')
);

export class OrgCatalogState extends Effect.Service<OrgCatalogState>()('OrgCatalogState', {
  accessors: true,
  dependencies: [OrgMetadataCatalogStore.Default],
  scoped: Effect.gen(function* () {
    const catalogStore = yield* OrgMetadataCatalogStore;
    const inventoryCache = yield* Ref.make<InventoryCache>(HashMap.empty());
    const persistedInventoryCache = yield* Ref.make<PersistedInventoryCache>(HashMap.empty());
    const inventorySemaphores = yield* Ref.make<HashMap.HashMap<string, Effect.Semaphore>>(HashMap.empty());
    const remoteTrackingCache = yield* Ref.make<HashMap.HashMap<string, RemoteTrackingObservations>>(HashMap.empty());
    const metadataTypeCache = yield* Ref.make<HashMap.HashMap<string, readonly MetadataTypeObservation[]>>(
      HashMap.empty()
    );
    const metadataListingCache = yield* Ref.make<HashMap.HashMap<string, MetadataListingObservation>>(HashMap.empty());
    const workspaceTypeCache = yield* Ref.make<HashMap.HashMap<string, ReadonlySet<string>>>(HashMap.empty());
    const sobjectListCache = yield* Ref.make<HashMap.HashMap<string, readonly OrgSObjectSummary[]>>(HashMap.empty());
    const sobjectDescriptionCache = yield* Ref.make<HashMap.HashMap<string, OrgSObjectDescription>>(HashMap.empty());
    const hydratedOrgIds = yield* Ref.make<HashSet.HashSet<string>>(HashSet.empty());
    const persistedGenerations = yield* Ref.make<HashMap.HashMap<string, number>>(HashMap.empty());
    const hydrateSemaphore = yield* Effect.makeSemaphore(1);
    const persistenceRequests = yield* Queue.unbounded<void>();
    const dirtyOrgIds = yield* Ref.make<HashSet.HashSet<string>>(HashSet.empty());

    const persistOrg = Effect.fn('OrgCatalogState.persistOrg')(function* (orgId: string) {
      const [
        loadedInventory,
        restoredInventory,
        sobjectLists,
        sobjectDescriptions,
        trackingByOrg,
        metadataTypesByOrg,
        metadataListings
      ] = yield* Effect.all([
        Ref.get(inventoryCache),
        Ref.get(persistedInventoryCache),
        Ref.get(sobjectListCache),
        Ref.get(sobjectDescriptionCache),
        Ref.get(remoteTrackingCache),
        Ref.get(metadataTypeCache),
        Ref.get(metadataListingCache)
      ]);
      const inventory = HashMap.reduce(
        loadedInventory,
        HashMap.reduce(
          restoredInventory,
          HashMap.empty<string, PersistedTypeInventory>(),
          (restoredCache, value, key) =>
            key.startsWith(`${orgId}\0`) ? HashMap.set(restoredCache, value.xmlName, value) : restoredCache
        ),
        (current, value, key) => {
          if (!key.startsWith(`${orgId}\0`)) return current;
          const xmlName = key.slice(orgId.length + 1);
          const remoteComponents = value.componentIdentityOrder.flatMap(identity =>
            Option.match(HashMap.get(value.components, identity), {
              onNone: () => [],
              onSome: component => (component.inOrg ? [component] : [])
            })
          );
          return HashMap.set(current, xmlName, {
            xmlName,
            observedAt: value.observedAt,
            complete: value.complete,
            components: remoteComponents.map(component => ({
              fullName: isOrgMetadataComponentReference(component.reference)
                ? component.reference.fullName
                : component.name,
              namespacePrefix: component.namespacePrefix,
              manageableState: component.manageableState,
              fileName: component.fileName,
              lastModifiedByName: component.lastModifiedByName,
              lastModifiedDate: component.lastModifiedDate
            })),
            folders: value.folderFullNameOrder.flatMap(fullName =>
              Option.match(HashMap.get(value.folders, fullName), {
                onNone: () => [],
                onSome: folder => [folder]
              })
            )
          });
        }
      );
      const generation = yield* Ref.modify(persistedGenerations, generations => {
        const next = Option.getOrElse(HashMap.get(generations, orgId), () => 0) + 1;
        return [next, HashMap.set(generations, orgId, next)];
      });
      const snapshot: OrgMetadataCatalogSnapshot = {
        version: 2,
        orgId,
        writtenAt: new Date().toISOString(),
        generation,
        inventory: pipe(inventory, HashMap.toValues, Arr.sort(byXmlName)),
        sobjects: {
          list: Option.getOrUndefined(HashMap.get(sobjectLists, orgId)),
          descriptions: pipe(
            sobjectDescriptions,
            HashMap.toEntries,
            Arr.filter(([key]) => key.startsWith(`${orgId}\0`)),
            Arr.map(([, description]) => description),
            Arr.sort(byName)
          )
        },
        tracking: pipe(
          Option.getOrElse(HashMap.get(trackingByOrg, orgId), () => ({
            byIdentity: HashMap.empty(),
            identityOrder: []
          })).byIdentity,
          HashMap.toValues,
          Arr.map(observation => ({
            xmlName: observation.reference.xmlName,
            fullName: observation.reference.fullName,
            signature: observation.signature
          })),
          Arr.sort(byMetadataIdentity)
        ),
        metadataTypes: [...Option.getOrElse(HashMap.get(metadataTypesByOrg, orgId), () => [])],
        metadataListings: pipe(
          metadataListings,
          HashMap.toEntries,
          Arr.filter(([key]) => key.startsWith(`${orgId}\0`)),
          Arr.map(([, observation]) => observation),
          Arr.sort(byMetadataListing)
        )
      };
      yield* catalogStore
        .save(snapshot)
        .pipe(Effect.catchAll(error => Effect.logWarning('Failed to persist org metadata catalog', error)));
    });

    const queuePersist = Effect.fn('OrgCatalogState.queuePersist')(function* (orgId: string) {
      yield* Ref.update(dirtyOrgIds, current => HashSet.add(current, orgId));
      yield* Queue.offer(persistenceRequests, undefined);
    });

    /** Atomically claims and persists an org only when it has pending catalog changes. */
    const flushOrg = Effect.fn('OrgCatalogState.flushOrg')(function* (orgId: string) {
      const dirty = yield* Ref.modify(dirtyOrgIds, current =>
        HashSet.has(current, orgId) ? [true, HashSet.remove(current, orgId)] : [false, current]
      );
      if (dirty) yield* persistOrg(orgId);
      yield* Effect.annotateCurrentSpan({ orgId, dirty, persisted: dirty });
      return dirty;
    });

    yield* Effect.forever(
      Effect.gen(function* () {
        yield* Queue.take(persistenceRequests);
        yield* Effect.sleep(Duration.millis(250));
        yield* Queue.takeAll(persistenceRequests);
        const pendingOrgIds = yield* Ref.getAndSet(dirtyOrgIds, HashSet.empty<string>());
        yield* Effect.forEach(pendingOrgIds, persistOrg, { concurrency: 1, discard: true });
      })
    ).pipe(Effect.forkScoped);

    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        const pendingOrgIds = yield* Ref.getAndSet(dirtyOrgIds, HashSet.empty<string>());
        yield* Effect.forEach(pendingOrgIds, persistOrg, { concurrency: 1, discard: true });
        yield* Queue.shutdown(persistenceRequests);
      })
    );

    const ensureHydrated = Effect.fn('OrgCatalogState.ensureHydrated')(function* (orgId: string) {
      if (HashSet.has(yield* Ref.get(hydratedOrgIds), orgId)) return;
      yield* Effect.gen(function* () {
        if (HashSet.has(yield* Ref.get(hydratedOrgIds), orgId)) return;
        const snapshot = yield* catalogStore
          .load(orgId)
          .pipe(
            Effect.catchAll(error =>
              Effect.logWarning('Failed to hydrate org metadata catalog', error).pipe(Effect.as(undefined))
            )
          );
        if (snapshot) {
          yield* Ref.update(persistedInventoryCache, current =>
            HashMap.union(
              current,
              HashMap.fromIterable(
                snapshot.inventory.map(inventory => [typeCacheKey(orgId, inventory.xmlName), inventory] as const)
              )
            )
          );
          if (snapshot.sobjects.list) {
            yield* Ref.update(sobjectListCache, current => HashMap.set(current, orgId, snapshot.sobjects.list ?? []));
          }
          yield* Ref.update(sobjectDescriptionCache, current =>
            HashMap.union(
              current,
              HashMap.fromIterable(
                snapshot.sobjects.descriptions.map(
                  description => [sobjectDescriptionKey(orgId, description.name), description] as const
                )
              )
            )
          );
          yield* Ref.update(remoteTrackingCache, current =>
            HashMap.set(current, orgId, {
              byIdentity: HashMap.fromIterable(
                snapshot.tracking.map(observation => [
                  componentIdentity({ xmlName: observation.xmlName, fullName: observation.fullName }),
                  {
                    reference: { xmlName: observation.xmlName, fullName: observation.fullName },
                    signature: observation.signature
                  }
                ])
              ),
              identityOrder: snapshot.tracking.map(observation =>
                componentIdentity({ xmlName: observation.xmlName, fullName: observation.fullName })
              )
            })
          );
          yield* Ref.update(metadataTypeCache, current => HashMap.set(current, orgId, snapshot.metadataTypes));
          yield* Ref.update(metadataListingCache, current =>
            HashMap.union(
              current,
              HashMap.fromIterable(
                snapshot.metadataListings.map(
                  observation =>
                    [metadataListingKey(orgId, observation.xmlName, observation.folder), observation] as const
                )
              )
            )
          );
          yield* Ref.update(persistedGenerations, current => HashMap.set(current, orgId, snapshot.generation));
        }
        yield* Ref.update(hydratedOrgIds, current => HashSet.add(current, orgId));
      }).pipe(hydrateSemaphore.withPermits(1));
    });

    const getInventorySemaphore = Effect.fn('OrgCatalogState.getInventorySemaphore')(function* (key: string) {
      const existing = HashMap.get(yield* Ref.get(inventorySemaphores), key);
      if (Option.isSome(existing)) return existing.value;
      const candidate = yield* Effect.makeSemaphore(1);
      return yield* Ref.modify(inventorySemaphores, current => {
        const concurrent = HashMap.get(current, key);
        return Option.isSome(concurrent)
          ? [concurrent.value, current]
          : [candidate, HashMap.set(current, key, candidate)];
      });
    });

    const withInventorySemaphores =
      (semaphores: readonly Effect.Semaphore[]) =>
      <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        semaphores.reduceRight((guarded, semaphore) => guarded.pipe(semaphore.withPermits(1)), effect);

    const getInventory = Effect.fn('OrgCatalogState.getInventory')((orgId: string, xmlName: string) =>
      Ref.get(inventoryCache).pipe(
        Effect.map(HashMap.get(typeCacheKey(orgId, xmlName))),
        Effect.map(Option.getOrUndefined)
      )
    );
    const getPersistedInventory = Effect.fn('OrgCatalogState.getPersistedInventory')((orgId: string, xmlName: string) =>
      Ref.get(persistedInventoryCache).pipe(
        Effect.map(HashMap.get(typeCacheKey(orgId, xmlName))),
        Effect.map(Option.getOrUndefined)
      )
    );
    const setInventory = Effect.fn('OrgCatalogState.setInventory')(
      (orgId: string, xmlName: string, inventory: TypeInventory) =>
        Ref.update(inventoryCache, current => HashMap.set(current, typeCacheKey(orgId, xmlName), inventory))
    );
    const updateInventories = (update: (current: InventoryCache) => InventoryCache) =>
      Ref.update(inventoryCache, update);

    const invalidateOrgInventories = Effect.fn('OrgCatalogState.invalidateOrgInventories')((orgId: string) =>
      Ref.get(inventorySemaphores).pipe(
        Effect.map(HashMap.toEntries),
        Effect.map(entries =>
          entries
            .filter(([key]) => key.startsWith(`${orgId}\0`))
            .toSorted(([left], [right]) => left.localeCompare(right))
            .map(([, semaphore]) => semaphore)
        ),
        Effect.flatMap(activeTypeSemaphores =>
          Effect.all(
            [
              Ref.update(inventoryCache, current =>
                HashMap.filter(current, (_value, key) => !key.startsWith(`${orgId}\0`))
              ),
              Ref.update(persistedInventoryCache, current =>
                HashMap.filter(current, (_value, key) => !key.startsWith(`${orgId}\0`))
              ),
              Ref.update(workspaceTypeCache, current => HashMap.remove(current, orgId))
            ],
            { discard: true }
          ).pipe(withInventorySemaphores(activeTypeSemaphores))
        )
      )
    );

    const invalidateTypes = Effect.fn('OrgCatalogState.invalidateTypes')(function* (
      orgId: string,
      xmlNames: ReadonlySet<string>
    ) {
      const semaphores = yield* Effect.all(
        [...xmlNames].toSorted().map(xmlName => getInventorySemaphore(typeCacheKey(orgId, xmlName)))
      );
      yield* Effect.all(
        [
          Ref.update(inventoryCache, current =>
            HashMap.removeMany(
              current,
              [...xmlNames].map(xmlName => typeCacheKey(orgId, xmlName))
            )
          ),
          Ref.update(persistedInventoryCache, current =>
            HashMap.removeMany(
              current,
              [...xmlNames].map(xmlName => typeCacheKey(orgId, xmlName))
            )
          )
        ],
        { discard: true }
      ).pipe(withInventorySemaphores(semaphores));
    });

    const getWorkspaceTypes = Effect.fn('OrgCatalogState.getWorkspaceTypes')((orgId: string) =>
      Ref.get(workspaceTypeCache).pipe(Effect.map(HashMap.get(orgId)), Effect.map(Option.getOrUndefined))
    );
    const setWorkspaceTypes = Effect.fn('OrgCatalogState.setWorkspaceTypes')(
      (orgId: string, types: ReadonlySet<string>) =>
        Ref.update(workspaceTypeCache, current => HashMap.set(current, orgId, types))
    );
    const getSObjectList = Effect.fn('OrgCatalogState.getSObjectList')((orgId: string) =>
      Ref.get(sobjectListCache).pipe(Effect.map(HashMap.get(orgId)), Effect.map(Option.getOrUndefined))
    );
    const setSObjectList = Effect.fn('OrgCatalogState.setSObjectList')(function* (
      orgId: string,
      observations: readonly OrgSObjectSummary[]
    ) {
      return yield* Ref.modify(sobjectListCache, current => {
        const previous = Option.getOrUndefined(HashMap.get(current, orgId));
        const changed = JSON.stringify(previous) !== JSON.stringify(observations);
        return [changed, changed ? HashMap.set(current, orgId, observations) : current];
      });
    });
    const getSObjectDescription = Effect.fn('OrgCatalogState.getSObjectDescription')((orgId: string, apiName: string) =>
      Ref.get(sobjectDescriptionCache).pipe(
        Effect.map(HashMap.get(sobjectDescriptionKey(orgId, apiName))),
        Effect.map(Option.getOrUndefined)
      )
    );
    const setSObjectDescription = Effect.fn('OrgCatalogState.setSObjectDescription')(function* (
      orgId: string,
      description: OrgSObjectDescription
    ) {
      return yield* Ref.modify(sobjectDescriptionCache, current => {
        const key = sobjectDescriptionKey(orgId, description.name);
        const changed =
          JSON.stringify(Option.getOrUndefined(HashMap.get(current, key))) !== JSON.stringify(description);
        return [changed, changed ? HashMap.set(current, key, description) : current];
      });
    });
    const removeSObjectDescriptions = Effect.fn('OrgCatalogState.removeSObjectDescriptions')(function* (
      orgId: string,
      apiNames?: ReadonlySet<string>
    ) {
      yield* Ref.update(sobjectDescriptionCache, current =>
        apiNames
          ? HashMap.removeMany(
              current,
              [...apiNames].map(apiName => sobjectDescriptionKey(orgId, apiName))
            )
          : HashMap.filter(current, (_value, key) => !key.startsWith(`${orgId}\0`))
      );
    });
    const invalidateSObjects = Effect.fn('OrgCatalogState.invalidateSObjects')(function* (
      orgId: string,
      apiNames?: ReadonlySet<string>
    ) {
      yield* Ref.update(sobjectListCache, current => HashMap.remove(current, orgId));
      yield* removeSObjectDescriptions(orgId, apiNames);
    });
    const getTracking = Effect.fn('OrgCatalogState.getTracking')((orgId: string) =>
      Ref.get(remoteTrackingCache).pipe(
        Effect.map(HashMap.get(orgId)),
        Effect.map(
          Option.getOrElse(() => ({
            byIdentity: HashMap.empty(),
            identityOrder: []
          }))
        )
      )
    );
    const setTracking = Effect.fn('OrgCatalogState.setTracking')(
      (orgId: string, observations: RemoteTrackingObservations) =>
        Ref.update(remoteTrackingCache, current => HashMap.set(current, orgId, observations))
    );
    const getMetadataTypes = Effect.fn('OrgCatalogState.getMetadataTypes')((orgId: string) =>
      Ref.get(metadataTypeCache).pipe(Effect.map(HashMap.get(orgId)), Effect.map(Option.getOrUndefined))
    );
    const setMetadataTypes = Effect.fn('OrgCatalogState.setMetadataTypes')(function* (
      orgId: string,
      observations: readonly MetadataTypeObservation[]
    ) {
      return yield* Ref.modify(metadataTypeCache, current => {
        const changed =
          JSON.stringify(Option.getOrUndefined(HashMap.get(current, orgId))) !== JSON.stringify(observations);
        return [changed, changed ? HashMap.set(current, orgId, observations) : current];
      });
    });
    const getMetadataListing = Effect.fn('OrgCatalogState.getMetadataListing')(
      (orgId: string, xmlName: string, folder?: string) =>
        Ref.get(metadataListingCache).pipe(
          Effect.map(HashMap.get(metadataListingKey(orgId, xmlName, folder))),
          Effect.map(Option.getOrUndefined)
        )
    );
    const setMetadataListing = Effect.fn('OrgCatalogState.setMetadataListing')(function* (
      orgId: string,
      observation: MetadataListingObservation
    ) {
      return yield* Ref.modify(metadataListingCache, current => {
        const key = metadataListingKey(orgId, observation.xmlName, observation.folder);
        const changed =
          JSON.stringify(Option.getOrUndefined(HashMap.get(current, key))) !== JSON.stringify(observation);
        return [changed, changed ? HashMap.set(current, key, observation) : current];
      });
    });
    const removeTracking = Effect.fn('OrgCatalogState.removeTracking')(function* (
      orgId: string,
      identities: ReadonlySet<string>
    ) {
      yield* Ref.update(remoteTrackingCache, cache => {
        const observations = HashMap.get(cache, orgId);
        return Option.isSome(observations)
          ? HashMap.set(cache, orgId, {
              byIdentity: HashMap.filter(
                observations.value.byIdentity,
                (_value, identity) => !identities.has(identity)
              ),
              identityOrder: observations.value.identityOrder.filter(identity => !identities.has(identity))
            })
          : cache;
      });
    });

    return {
      ensureHydrated,
      flushOrg,
      getInventory,
      getInventorySemaphore,
      getMetadataListing,
      getMetadataTypes,
      getPersistedInventory,
      getSObjectDescription,
      getSObjectList,
      getTracking,
      getWorkspaceTypes,
      invalidateOrgInventories,
      invalidateSObjects,
      invalidateTypes,
      persistOrg,
      queuePersist,
      removeTracking,
      setInventory,
      setMetadataListing,
      setMetadataTypes,
      setSObjectDescription,
      setSObjectList,
      setTracking,
      setWorkspaceTypes,
      updateInventories
    } as const;
  })
}) {}
