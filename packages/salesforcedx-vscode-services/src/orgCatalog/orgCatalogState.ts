/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  InventoryCache,
  PersistedInventoryCache,
  RemoteTrackingObservation,
  TypeInventory
} from './orgCatalogInternalTypes';
import type {
  OrgMetadataCatalogSnapshot,
  OrgMetadataCatalogStore,
  PersistedTypeInventory
} from './orgMetadataCatalogStore';
import type { OrgSObjectDescription, OrgSObjectSummary } from './orgMetadataCatalogTypes';
import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import { sobjectDescriptionKey, typeCacheKey } from './orgCatalogKeys';
import { isOrgMetadataComponentReference } from './orgMetadataReference';

type CatalogStore = InstanceType<typeof OrgMetadataCatalogStore>;

export const makeOrgCatalogState = Effect.fn('OrgCatalogState.make')(function* (catalogStore: CatalogStore) {
  const inventoryCache = yield* Ref.make<InventoryCache>(new Map());
  const persistedInventoryCache = yield* Ref.make<PersistedInventoryCache>(new Map());
  const inventorySemaphores = yield* Ref.make<ReadonlyMap<string, Effect.Semaphore>>(new Map());
  const remoteTrackingCache = yield* Ref.make<ReadonlyMap<string, ReadonlyMap<string, RemoteTrackingObservation>>>(
    new Map()
  );
  const workspaceTypeCache = yield* Ref.make<ReadonlyMap<string, ReadonlySet<string>>>(new Map());
  const sobjectListCache = yield* Ref.make<ReadonlyMap<string, readonly OrgSObjectSummary[]>>(new Map());
  const sobjectDescriptionCache = yield* Ref.make<ReadonlyMap<string, OrgSObjectDescription>>(new Map());
  const hydratedOrgIds = yield* Ref.make<ReadonlySet<string>>(new Set());
  const persistedGenerations = yield* Ref.make<ReadonlyMap<string, number>>(new Map());
  const hydrateSemaphore = yield* Effect.makeSemaphore(1);

  const persistOrg = Effect.fn('OrgMetadataCatalog.persistOrg')(function* (orgId: string) {
    const [loadedInventory, restoredInventory, sobjectLists, sobjectDescriptions, trackingByOrg] = yield* Effect.all([
      Ref.get(inventoryCache),
      Ref.get(persistedInventoryCache),
      Ref.get(sobjectListCache),
      Ref.get(sobjectDescriptionCache),
      Ref.get(remoteTrackingCache)
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
      version: 1,
      orgId,
      writtenAt: new Date().toISOString(),
      generation,
      inventory: [...inventory.values()].toSorted((left, right) => left.xmlName.localeCompare(right.xmlName)),
      sobjects: {
        list: sobjectLists.get(orgId),
        descriptions: [...sobjectDescriptions]
          .filter(([key]) => key.startsWith(`${orgId}\0`))
          .map(([, description]) => description)
          .toSorted((left, right) => left.name.localeCompare(right.name))
      },
      tracking: [...(trackingByOrg.get(orgId) ?? new Map()).values()]
        .map(observation => ({
          xmlName: observation.reference.xmlName,
          fullName: observation.reference.fullName,
          signature: observation.signature
        }))
        .toSorted((left, right) => {
          const typeComparison = left.xmlName.localeCompare(right.xmlName);
          return typeComparison === 0 ? left.fullName.localeCompare(right.fullName) : typeComparison;
        })
    };
    yield* catalogStore
      .save(snapshot)
      .pipe(Effect.catchAll(error => Effect.logWarning('Failed to persist org metadata catalog', error)));
  });

  const ensureHydrated = Effect.fn('OrgMetadataCatalog.ensureHydrated')(function* (orgId: string) {
    if ((yield* Ref.get(hydratedOrgIds)).has(orgId)) return;
    yield* hydrateSemaphore.withPermits(1)(
      Effect.gen(function* () {
        if ((yield* Ref.get(hydratedOrgIds)).has(orgId)) return;
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
                  `${observation.xmlName}\0${observation.fullName}`,
                  {
                    reference: { xmlName: observation.xmlName, fullName: observation.fullName },
                    signature: observation.signature
                  }
                ])
              )
            )
          );
          yield* Ref.update(persistedGenerations, current => new Map(current).set(orgId, snapshot.generation));
        }
        yield* Ref.update(hydratedOrgIds, current => new Set(current).add(orgId));
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

  const withInventorySemaphores = <A, E, R>(semaphores: readonly Effect.Semaphore[], effect: Effect.Effect<A, E, R>) =>
    semaphores.reduceRight((guarded, semaphore) => semaphore.withPermits(1)(guarded), effect);

  const withTypeLock = <A, E, R>(key: string, effect: Effect.Effect<A, E, R>) =>
    getInventorySemaphore(key).pipe(Effect.flatMap(semaphore => semaphore.withPermits(1)(effect)));

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
  const updateInventories = (update: (current: InventoryCache) => InventoryCache) => Ref.update(inventoryCache, update);

  const invalidateOrgInventories = Effect.fn('OrgCatalogState.invalidateOrgInventories')(function* (orgId: string) {
    const activeTypeSemaphores = [...(yield* Ref.get(inventorySemaphores))]
      .filter(([key]) => key.startsWith(`${orgId}\0`))
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([, semaphore]) => semaphore);
    yield* withInventorySemaphores(
      activeTypeSemaphores,
      Effect.all(
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
      )
    );
  });

  const invalidateTypes = Effect.fn('OrgCatalogState.invalidateTypes')(function* (
    orgId: string,
    xmlNames: ReadonlySet<string>
  ) {
    const semaphores = yield* Effect.all(
      [...xmlNames].toSorted().map(xmlName => getInventorySemaphore(typeCacheKey(orgId, xmlName)))
    );
    yield* withInventorySemaphores(
      semaphores,
      Effect.all(
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
      )
    );
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
    yield* Ref.update(sobjectListCache, current => new Map(current).set(orgId, observations));
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
    yield* Ref.update(sobjectDescriptionCache, current =>
      new Map(current).set(sobjectDescriptionKey(orgId, description.name), description)
    );
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
    getInventory,
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
    removeTracking,
    removeSObjectDescriptions,
    setInventory,
    setSObjectDescription,
    setSObjectList,
    setTracking,
    setWorkspaceTypes,
    updateInventories,
    withTypeLock
  } as const;
});
