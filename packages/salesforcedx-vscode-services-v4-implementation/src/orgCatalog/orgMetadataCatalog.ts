/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  OrgMetadataCatalog,
  type OrgMetadataCatalogComponentReference,
  type OrgMetadataCatalogEntry,
  type OrgMetadataCatalogInternalEntry,
  type OrgMetadataCatalogReference,
  type OrgMetadataComponentReference,
  type OrgMetadataReference,
  type OrgMetadataConsistency,
  type OrgMetadataHierarchyConsistency
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { MetadataDescribeInvalidation } from '../metadataDescribeService.js';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { OrgCatalogInventory } from './orgCatalogInventory.js';
import { makeOrgCatalogOrg, type CatalogOrg } from './orgCatalogOrg.js';
import { OrgCatalogState } from './orgCatalogState.js';
import { OrgCatalogTreeProjection } from './orgCatalogTreeProjection.js';
import { OrgCatalogWorkspace } from './orgCatalogWorkspace.js';
import { OrgMetadataCatalogRecorder } from './orgMetadataCatalogRecorder.js';

const internal = (reference: OrgMetadataCatalogReference): OrgMetadataReference => ({
  ...(reference.type ? { xmlName: reference.type } : {}),
  ...(reference.fullName ? { fullName: reference.fullName } : {})
});
const component = (reference: OrgMetadataCatalogComponentReference): OrgMetadataComponentReference => ({
  xmlName: reference.type,
  fullName: reference.fullName
});
const catalogEntry = (entry: OrgMetadataCatalogInternalEntry): OrgMetadataCatalogEntry =>
  entry.kind === 'type'
    ? { ...entry, reference: { type: entry.reference.xmlName } }
    : { ...entry, reference: { type: entry.reference.xmlName, fullName: entry.reference.fullName } };

export const OrgMetadataCatalogLayer = Layer.effect(
  OrgMetadataCatalog,
  Effect.gen(function* () {
    const inventories = yield* OrgCatalogInventory;
    const state = yield* OrgCatalogState;
    const tree = yield* OrgCatalogTreeProjection;
    const workspace = yield* OrgCatalogWorkspace;
    const recorder = yield* OrgMetadataCatalogRecorder;
    const invalidation = yield* MetadataDescribeInvalidation;
    const orgs = yield* makeOrgCatalogOrg;
    const operations = yield* ServiceOperations;
    const refresh = Effect.fn('OrgMetadataCatalog.refresh')(function* (
      org: CatalogOrg,
      reference: OrgMetadataReference
    ) {
      yield* invalidation.invalidateHierarchy(org.orgId, org.orgGeneration, reference.xmlName);
      yield* tree.clearLoadedChildren(org, reference);
      yield* state.ensureHydrated(org.orgId);
      yield* reference.xmlName
        ? state.withTypeInvalidation(org.orgId, new Set([reference.xmlName]), invalidate =>
            orgs.commit(org, invalidate)
          )
        : state.withOrgInvalidation(org.orgId, 'org', invalidate => orgs.commit(org, invalidate));
      yield* state.persistOrg(org.orgId);
    });
    const getChildren = Effect.fn('OrgMetadataCatalog.getChildren')(function* (
      reference: OrgMetadataCatalogReference = {},
      options: { readonly consistency?: OrgMetadataHierarchyConsistency } = {}
    ) {
      const org = yield* orgs.capture();
      const target = internal(reference);
      if (options.consistency === 'cache-only') {
        const cached = target.xmlName ? yield* tree.getChildrenCached(org, target) : [];
        return yield* orgs.commit(org, Effect.succeed((cached ?? []).map(catalogEntry)));
      }
      if (options.consistency === 'refresh') yield* refresh(org, target);
      const children = yield* tree.getChildren(org, target);
      return yield* orgs.commit(org, Effect.succeed(children.map(catalogEntry)));
    }, operations.run);
    const getEntries = Effect.fn('OrgMetadataCatalog.getEntries')(function* (
      references: readonly OrgMetadataCatalogComponentReference[],
      options: { readonly consistency?: OrgMetadataConsistency } = {}
    ) {
      const org = yield* orgs.capture();
      const targets = references.map(component);
      if (options.consistency === 'refresh')
        yield* Effect.forEach(
          new Set(targets.map(reference => reference.xmlName)),
          xmlName => refresh(org, { xmlName }),
          { discard: true }
        );
      const entries = yield* Effect.forEach(targets, reference => inventories.getEntry(org, reference), {
        concurrency: 'unbounded'
      });
      return yield* orgs.commit(org, Effect.succeed(entries.map(entry => (entry ? catalogEntry(entry) : undefined))));
    }, operations.run);
    const hasTypeInventory = Effect.fn('OrgMetadataCatalog.hasTypeInventory')(function* (type: string) {
      const org = yield* orgs.capture();
      yield* state.ensureHydrated(org.orgId);
      const snapshot = yield* state.getInventorySnapshot(org.orgId, type);
      return yield* state.withHierarchyCommit(
        orgs.commit(
          org,
          state
            .getHierarchyGeneration(org.orgId)
            .pipe(
              Effect.map(
                generation =>
                  generation === snapshot.generation &&
                  Boolean(snapshot.cached?.complete ?? snapshot.restored?.complete)
              )
            )
        )
      );
    }, operations.run);
    const resolveComponents = Effect.fn('OrgMetadataCatalog.resolveComponents')(function* (
      references: readonly OrgMetadataCatalogComponentReference[]
    ) {
      const org = yield* orgs.capture();
      const resolutions = yield* workspace.resolveComponents(org, references.map(component), { prefer: 'workspace' });
      yield* recorder.recordRemoteComponents(
        org.orgId,
        org.orgGeneration,
        'tooling-api',
        resolutions.map(resolution => ({
          type: resolution.reference.xmlName,
          fullName: resolution.reference.fullName,
          documentUri: resolution.orgUri,
          ...(resolution.workspaceUri ? { workspaceUri: resolution.workspaceUri } : {})
        }))
      );
      return yield* orgs.commit(
        org,
        Effect.succeed(
          resolutions.map(resolution => ({
            ...resolution,
            orgUri: resolution.orgUri!,
            preferredUri: resolution.preferredUri!,
            reference: { type: resolution.reference.xmlName, fullName: resolution.reference.fullName }
          }))
        )
      );
    }, operations.run);
    yield* Effect.addFinalizer(() => operations.close);
    return OrgMetadataCatalog.of({ getChildren, getEntries, hasTypeInventory, resolveComponents });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
