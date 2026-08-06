/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { MetadataDescribeService } from '../core/metadataDescribeService';
import { TransmogrifierService } from '../core/transmogrifierService';
import { OrgCatalogState } from './orgCatalogState';

export class OrgCatalogSObjects extends Effect.Service<OrgCatalogSObjects>()('OrgCatalogSObjects', {
  accessors: true,
  dependencies: [OrgCatalogState.Default, MetadataDescribeService.Default, TransmogrifierService.Default],
  effect: Effect.gen(function* () {
    const [state, metadataDescribeService, transmogrifierService] = yield* Effect.all([
      OrgCatalogState,
      MetadataDescribeService,
      TransmogrifierService
    ]);
    const listSObjects = Effect.fn('OrgCatalogSObjects.listSObjects')(function* (orgId: string) {
      yield* state.ensureHydrated(orgId);
      const cached = yield* state.getSObjectList(orgId);
      if (cached) return cached;
      const observedAt = new Date().toISOString();
      const observations = (yield* metadataDescribeService.listSObjects(orgId)).map(sobject => ({
        ...sobject,
        orgId,
        observedAt,
        provenance: 'rest-api' as const
      }));
      yield* state.setSObjectList(orgId, observations);
      yield* state.persistOrg(orgId);
      return observations;
    });

    const describeSObject = Effect.fn('OrgCatalogSObjects.describeSObject')(function* (orgId: string, apiName: string) {
      yield* state.ensureHydrated(orgId);
      const cached = yield* state.getSObjectDescription(orgId, apiName);
      if (cached) return cached;
      const description = yield* metadataDescribeService.describeCustomObject(apiName, orgId).pipe(
        Effect.flatMap(transmogrifierService.toMinimalSObject),
        Effect.map(sobject => ({
          ...sobject,
          orgId,
          observedAt: new Date().toISOString(),
          provenance: 'rest-api' as const
        }))
      );
      yield* state.setSObjectDescription(orgId, description);
      yield* state.persistOrg(orgId);
      return description;
    });

    const reacquireSObjectDescription = Effect.fn('OrgCatalogSObjects.reacquireSObjectDescription')(function* (
      orgId: string,
      apiName: string
    ) {
      yield* metadataDescribeService.invalidateSObjectDescribe(apiName, orgId);
      yield* state.removeSObjectDescriptions(orgId, new Set([apiName]));
      return yield* describeSObject(orgId, apiName);
    });

    const describeSObjects = Effect.fn('OrgCatalogSObjects.describeSObjects')(function* (
      orgId: string,
      apiNames: readonly string[]
    ) {
      yield* state.ensureHydrated(orgId);
      const cachedDescriptions = yield* state.getSObjectDescriptions(orgId, apiNames);
      const cached = apiNames.flatMap(apiName => {
        const description = cachedDescriptions.get(apiName);
        return description ? [description] : [];
      });
      const missing = apiNames.filter(apiName => !cachedDescriptions.has(apiName));
      if (missing.length === 0) return Stream.fromIterable(cached);
      const descriptions = yield* metadataDescribeService.describeCustomObjects([...missing], orgId);
      const acquired = descriptions.pipe(
        Stream.mapEffect(transmogrifierService.toMinimalSObject),
        Stream.map(sobject => ({
          ...sobject,
          orgId,
          observedAt: new Date().toISOString(),
          provenance: 'rest-api' as const
        })),
        Stream.tap(description => state.setSObjectDescription(orgId, description)),
        Stream.ensuring(state.persistOrg(orgId))
      );
      return Stream.fromIterable(cached).pipe(Stream.concat(acquired));
    });

    const refreshSObjects = Effect.fn('OrgCatalogSObjects.refreshSObjects')(function* (
      orgId: string,
      apiNames?: readonly string[]
    ) {
      yield* state.ensureHydrated(orgId);
      yield* Effect.all(
        [
          metadataDescribeService.invalidateListSObjects(orgId),
          metadataDescribeService.invalidateSObjectDescribes(apiNames, orgId)
        ],
        { discard: true }
      );
      yield* state.invalidateSObjects(orgId, apiNames ? new Set(apiNames) : undefined);
      yield* state.persistOrg(orgId);
      return yield* listSObjects(orgId);
    });

    const refreshSObject = Effect.fn('OrgCatalogSObjects.refreshSObject')(function* (orgId: string, apiName: string) {
      yield* state.ensureHydrated(orgId);
      return yield* reacquireSObjectDescription(orgId, apiName);
    });

    return {
      describeSObject,
      describeSObjects,
      listSObjects,
      reacquireSObjectDescription,
      refreshSObject,
      refreshSObjects
    } as const;
  })
}) {}
