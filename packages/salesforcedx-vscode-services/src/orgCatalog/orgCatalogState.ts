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
  RemoteTrackingObservation,
  TypeInventory
} from './orgCatalogInternalTypes';
import type { OrgSObjectDescription, OrgSObjectSummary } from './orgMetadataCatalogTypes';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
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
    const inventoryCache = yield* Ref.make<InventoryCache>(new Map());
    const persistedInventoryCache = yield* Ref.make<PersistedInventoryCache>(new Map());
    const inventorySemaphores = yield* Ref.make<ReadonlyMap<string, Effect.Semaphore>>(new Map());
    const remoteTrackingCache = yield* Ref.make<ReadonlyMap<string, ReadonlyMap<string, RemoteTrackingObservation>>>(
      new Map()
    );
    const metadataTypeCache = yield* Ref.make<ReadonlyMap<string, readonly MetadataTypeObservation[]>>(new Map());
    const metadataListingCache = yield* Ref.make<ReadonlyMap<string, MetadataListingObservation>>(new Map());
    const workspaceTypeCache = yield* Ref.make<ReadonlyMap<string, ReadonlySet<string>>>(new Map());
    const sobjectListCache = yield* Ref.make<ReadonlyMap<string, readonly OrgSObjectSummary[]>>(new Map());
    const sobjectDescriptionCache = yield* Ref.make<ReadonlyMap<string, OrgSObjectDescription>>(new Map());
    const hydratedOrgIds = yield* Ref.make<HashSet.HashSet<string>>(HashSet.empty());
    const persistedGenerations = yield* Ref.make<ReadonlyMap<string, number>>(new Map());
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
      const inventory = new Map<string, PersistedTypeInventory>();
      restoredInventory.forEach((value, key) => {
        if (key.startsWith(`${orgId}\0`)) inventory.set(value.xmlName, value);
      });
      loadedInventory.forEach((value, key) => {
        if (!key.startsWith(`${orgId}\0`)) return;
        const xmlName = key.slice(orgId.length + 1);
        const remoteComponents = [...value.components.values()].filter(component => component.inOrg);
        inventory.set(xmlName, {
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
          folders: [...value.folders.values()]
        });
      });
      const generation = yield* Ref.modify(persistedGenerations, generations => {
        const next = (generations.get(orgId) ?? 0) + 1;
        return [next, new Map(generations).set(orgId, next)];
      });
      const snapshot: OrgMetadataCatalogSnapshot = {
        version: 2,
        orgId,
        writtenAt: new Date().toISOString(),
        generation,
        inventory: [...inventory.values()].toSorted(byXmlName),
        sobjects: {
          list: sobjectLists.get(orgId),
          descriptions: [...sobjectDescriptions]
            .filter(([key]) => key.startsWith(`${orgId}\0`))
            .map(([, description]) => description)
            .toSorted(byName)
        },
        tracking: [...(trackingByOrg.get(orgId) ?? new Map()).values()]
          .map(observation => ({
            xmlName: observation.reference.xmlName,
            fullName: observation.reference.fullName,
            signature: observation.signature
          }))
          .toSorted(byMetadataIdentity),
        metadataTypes: [...(metadataTypesByOrg.get(orgId) ?? [])],
        metadataListings: [...metadataListings]
          .filter(([key]) => key.startsWith(`${orgId}\0`))
          .map(([, observation]) => observation)
          .toSorted(byMetadataListing)
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
      yield* hydrateSemaphore.withPermits(1)(
        Effect.gen(function* () {
          if (HashSet.has(yield* Ref.get(hydratedOrgIds), orgId)) return;
          const snapshot = yield* catalogStore
            .load(orgId)
            .pipe(
              Effect.catchAll(error =>
                Effect.logWarning('Failed to hydrate org metadata catalog', error).pipe(Effect.as(undefined))
              )
            );
          if (snapshot) {
            yield* Ref.update(persistedInventoryCache, current => {
              const next = new Map(current);
              snapshot.inventory.forEach(inventory => next.set(typeCacheKey(orgId, inventory.xmlName), inventory));
              return next;
            });
            if (snapshot.sobjects.list) {
              yield* Ref.update(sobjectListCache, current => new Map(current).set(orgId, snapshot.sobjects.list ?? []));
            }
            yield* Ref.update(sobjectDescriptionCache, current => {
              const next = new Map(current);
              snapshot.sobjects.descriptions.forEach(description =>
                next.set(sobjectDescriptionKey(orgId, description.name), description)
              );
              return next;
            });
            yield* Ref.update(remoteTrackingCache, current =>
              new Map(current).set(
                orgId,
                new Map(
                  snapshot.tracking.map(observation => [
                    componentIdentity({ xmlName: observation.xmlName, fullName: observation.fullName }),
                    {
                      reference: { xmlName: observation.xmlName, fullName: observation.fullName },
                      signature: observation.signature
                    }
                  ])
                )
              )
            );
            yield* Ref.update(metadataTypeCache, current => new Map(current).set(orgId, snapshot.metadataTypes));
            yield* Ref.update(metadataListingCache, current => {
              const next = new Map(current);
              snapshot.metadataListings.forEach(observation =>
                next.set(metadataListingKey(orgId, observation.xmlName, observation.folder), observation)
              );
              return next;
            });
            yield* Ref.update(persistedGenerations, current => new Map(current).set(orgId, snapshot.generation));
          }
          yield* Ref.update(hydratedOrgIds, current => HashSet.add(current, orgId));
        })
      );
    });

    const getInventorySemaphore = Effect.fn('OrgCatalogState.getInventorySemaphore')(function* (key: string) {
      const existing = (yield* Ref.get(inventorySemaphores)).get(key);
      if (existing) return existing;
      const candidate = yield* Effect.makeSemaphore(1);
      return yield* Ref.modify(inventorySemaphores, current => {
        const concurrent = current.get(key);
        return concurrent ? [concurrent, current] : [candidate, new Map(current).set(key, candidate)];
      });
    });

    const withInventorySemaphores =
      (semaphores: readonly Effect.Semaphore[]) =>
      <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        semaphores.reduceRight((guarded, semaphore) => guarded.pipe(semaphore.withPermits(1)), effect);

    const getInventory = Effect.fn('OrgCatalogState.getInventory')(function* (orgId: string, xmlName: string) {
      return (yield* Ref.get(inventoryCache)).get(typeCacheKey(orgId, xmlName));
    });
    const getPersistedInventory = Effect.fn('OrgCatalogState.getPersistedInventory')(function* (
      orgId: string,
      xmlName: string
    ) {
      return (yield* Ref.get(persistedInventoryCache)).get(typeCacheKey(orgId, xmlName));
    });
    const setInventory = Effect.fn('OrgCatalogState.setInventory')(function* (
      orgId: string,
      xmlName: string,
      inventory: TypeInventory
    ) {
      yield* Ref.update(inventoryCache, current => new Map(current).set(typeCacheKey(orgId, xmlName), inventory));
    });
    const updateInventories = (update: (current: InventoryCache) => InventoryCache) =>
      Ref.update(inventoryCache, update);

    const invalidateOrgInventories = Effect.fn('OrgCatalogState.invalidateOrgInventories')(function* (orgId: string) {
      const activeTypeSemaphores = [...(yield* Ref.get(inventorySemaphores))]
        .filter(([key]) => key.startsWith(`${orgId}\0`))
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([, semaphore]) => semaphore);
      yield* Effect.all(
        [
          Ref.update(inventoryCache, current => new Map([...current].filter(([key]) => !key.startsWith(`${orgId}\0`)))),
          Ref.update(
            persistedInventoryCache,
            current => new Map([...current].filter(([key]) => !key.startsWith(`${orgId}\0`)))
          ),
          Ref.update(workspaceTypeCache, current => {
            const next = new Map(current);
            next.delete(orgId);
            return next;
          })
        ],
        { discard: true }
      ).pipe(withInventorySemaphores(activeTypeSemaphores));
    });

    const invalidateTypes = Effect.fn('OrgCatalogState.invalidateTypes')(function* (
      orgId: string,
      xmlNames: ReadonlySet<string>
    ) {
      const semaphores = yield* Effect.all(
        [...xmlNames].toSorted().map(xmlName => getInventorySemaphore(typeCacheKey(orgId, xmlName)))
      );
      yield* Effect.all(
        [
          Ref.update(inventoryCache, current => {
            const next = new Map(current);
            xmlNames.forEach(xmlName => next.delete(typeCacheKey(orgId, xmlName)));
            return next;
          }),
          Ref.update(persistedInventoryCache, current => {
            const next = new Map(current);
            xmlNames.forEach(xmlName => next.delete(typeCacheKey(orgId, xmlName)));
            return next;
          })
        ],
        { discard: true }
      ).pipe(withInventorySemaphores(semaphores));
    });

    const getWorkspaceTypes = Effect.fn('OrgCatalogState.getWorkspaceTypes')(function* (orgId: string) {
      return (yield* Ref.get(workspaceTypeCache)).get(orgId);
    });
    const setWorkspaceTypes = Effect.fn('OrgCatalogState.setWorkspaceTypes')(function* (
      orgId: string,
      types: ReadonlySet<string>
    ) {
      yield* Ref.update(workspaceTypeCache, current => new Map(current).set(orgId, types));
    });
    const getSObjectList = Effect.fn('OrgCatalogState.getSObjectList')(function* (orgId: string) {
      return (yield* Ref.get(sobjectListCache)).get(orgId);
    });
    const setSObjectList = Effect.fn('OrgCatalogState.setSObjectList')(function* (
      orgId: string,
      observations: readonly OrgSObjectSummary[]
    ) {
      return yield* Ref.modify(sobjectListCache, current => {
        const previous = current.get(orgId);
        const changed = JSON.stringify(previous) !== JSON.stringify(observations);
        return [changed, changed ? new Map(current).set(orgId, observations) : current];
      });
    });
    const getSObjectDescription = Effect.fn('OrgCatalogState.getSObjectDescription')(function* (
      orgId: string,
      apiName: string
    ) {
      return (yield* Ref.get(sobjectDescriptionCache)).get(sobjectDescriptionKey(orgId, apiName));
    });
    const getSObjectDescriptions = Effect.fn('OrgCatalogState.getSObjectDescriptions')(function* (
      orgId: string,
      apiNames: readonly string[]
    ) {
      const descriptions = yield* Ref.get(sobjectDescriptionCache);
      return new Map(
        apiNames.flatMap(apiName => {
          const description = descriptions.get(sobjectDescriptionKey(orgId, apiName));
          return description ? [[apiName, description] as const] : [];
        })
      );
    });
    const setSObjectDescription = Effect.fn('OrgCatalogState.setSObjectDescription')(function* (
      orgId: string,
      description: OrgSObjectDescription
    ) {
      return yield* Ref.modify(sobjectDescriptionCache, current => {
        const key = sobjectDescriptionKey(orgId, description.name);
        const changed = JSON.stringify(current.get(key)) !== JSON.stringify(description);
        return [changed, changed ? new Map(current).set(key, description) : current];
      });
    });
    const removeSObjectDescriptions = Effect.fn('OrgCatalogState.removeSObjectDescriptions')(function* (
      orgId: string,
      apiNames?: ReadonlySet<string>
    ) {
      yield* Ref.update(sobjectDescriptionCache, current => {
        const next = new Map(current);
        if (apiNames) {
          apiNames.forEach(apiName => next.delete(sobjectDescriptionKey(orgId, apiName)));
        } else {
          [...next.keys()].filter(key => key.startsWith(`${orgId}\0`)).forEach(key => next.delete(key));
        }
        return next;
      });
    });
    const invalidateSObjects = Effect.fn('OrgCatalogState.invalidateSObjects')(function* (
      orgId: string,
      apiNames?: ReadonlySet<string>
    ) {
      yield* Ref.update(sobjectListCache, current => {
        const next = new Map(current);
        next.delete(orgId);
        return next;
      });
      yield* removeSObjectDescriptions(orgId, apiNames);
    });
    const getTracking = Effect.fn('OrgCatalogState.getTracking')(function* (orgId: string) {
      return (yield* Ref.get(remoteTrackingCache)).get(orgId) ?? new Map<string, RemoteTrackingObservation>();
    });
    const setTracking = Effect.fn('OrgCatalogState.setTracking')(function* (
      orgId: string,
      observations: ReadonlyMap<string, RemoteTrackingObservation>
    ) {
      yield* Ref.update(remoteTrackingCache, current => new Map(current).set(orgId, observations));
    });
    const getMetadataTypes = Effect.fn('OrgCatalogState.getMetadataTypes')(function* (orgId: string) {
      return (yield* Ref.get(metadataTypeCache)).get(orgId);
    });
    const setMetadataTypes = Effect.fn('OrgCatalogState.setMetadataTypes')(function* (
      orgId: string,
      observations: readonly MetadataTypeObservation[]
    ) {
      return yield* Ref.modify(metadataTypeCache, current => {
        const changed = JSON.stringify(current.get(orgId)) !== JSON.stringify(observations);
        return [changed, changed ? new Map(current).set(orgId, observations) : current];
      });
    });
    const getMetadataListing = Effect.fn('OrgCatalogState.getMetadataListing')(function* (
      orgId: string,
      xmlName: string,
      folder?: string
    ) {
      return (yield* Ref.get(metadataListingCache)).get(metadataListingKey(orgId, xmlName, folder));
    });
    const setMetadataListing = Effect.fn('OrgCatalogState.setMetadataListing')(function* (
      orgId: string,
      observation: MetadataListingObservation
    ) {
      return yield* Ref.modify(metadataListingCache, current => {
        const key = metadataListingKey(orgId, observation.xmlName, observation.folder);
        const changed = JSON.stringify(current.get(key)) !== JSON.stringify(observation);
        return [changed, changed ? new Map(current).set(key, observation) : current];
      });
    });
    const removeTracking = Effect.fn('OrgCatalogState.removeTracking')(function* (
      orgId: string,
      identities: ReadonlySet<string>
    ) {
      yield* Ref.update(remoteTrackingCache, cache => {
        const observations = cache.get(orgId);
        if (!observations) return cache;
        const remaining = new Map([...observations].filter(([identity]) => !identities.has(identity)));
        return new Map(cache).set(orgId, remaining);
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
      getSObjectDescriptions,
      getSObjectList,
      getTracking,
      getWorkspaceTypes,
      invalidateOrgInventories,
      invalidateSObjects,
      invalidateTypes,
      persistOrg,
      queuePersist,
      removeTracking,
      removeSObjectDescriptions,
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
