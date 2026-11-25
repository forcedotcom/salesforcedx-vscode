/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  OrgMetadataCatalog,
  MetadataDescribeService,
  TransmogrifierService,
  type OrgMetadataCatalogComponentEntry,
  type OrgMetadataCatalogComponentReference,
  type OrgMetadataCatalogEntry,
  type OrgMetadataCatalogFindQuery,
  type OrgMetadataCatalogInternalEntry,
  type OrgMetadataCatalogReference,
  type OrgMetadataComponentReference,
  type OrgMetadataReference,
  type OrgMetadataConsistency,
  type OrgMetadataHierarchyConsistency,
  type OrgSObjectDescription,
  QueryService
} from '@salesforce/vscode-services/v2';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { MetadataDescribeInvalidation } from '../metadataDescribeService.js';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import {
  ApexSourceTypeSchema,
  apexSourceSoqlWhere,
  apexSourceToolingIdentity,
  type ApexSourceType
} from './apexSourceTooling.js';
import { OrgCatalogInventory } from './orgCatalogInventory.js';
import { findInventoryComponent } from './orgCatalogKeys.js';
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

const isApexSourceReference = (
  reference: OrgMetadataCatalogComponentReference
): reference is OrgMetadataCatalogComponentReference & { readonly type: ApexSourceType } =>
  Schema.is(ApexSourceTypeSchema)(reference.type);

const isMissingSObject = (error: { readonly notFound?: boolean }) => error.notFound === true;

export const OrgMetadataCatalogLayer = Layer.effect(
  OrgMetadataCatalog,
  Effect.gen(function* () {
    const inventories = yield* OrgCatalogInventory;
    const state = yield* OrgCatalogState;
    const tree = yield* OrgCatalogTreeProjection;
    const workspace = yield* OrgCatalogWorkspace;
    const recorder = yield* OrgMetadataCatalogRecorder;
    const invalidation = yield* MetadataDescribeInvalidation;
    const descriptions = yield* MetadataDescribeService;
    const transmogrifier = yield* TransmogrifierService;
    const queryService = yield* QueryService;
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
    const findApexSource = Effect.fn('OrgMetadataCatalog.findApexSource')(function* (
      org: CatalogOrg,
      reference: OrgMetadataCatalogComponentReference & { readonly type: ApexSourceType }
    ) {
      const identity = apexSourceToolingIdentity(reference.fullName);
      const internalReference = component(reference);
      yield* state.ensureHydrated(org.orgId);
      const [loaded, persisted] = yield* Effect.all([
        state.getInventory(org.orgId, reference.type),
        state.getPersistedInventory(org.orgId, reference.type)
      ]);
      const recorded =
        findInventoryComponent(loaded?.components ?? HashMap.empty(), internalReference, identity.namespacePrefix)
          ?.inOrg === true ||
        persisted?.components.some(
          candidate =>
            candidate.fullName === reference.fullName &&
            (candidate.namespacePrefix ?? null) === identity.namespacePrefix
        ) === true;
      if (recorded) return true;

      const query = yield* queryService.query(
        {
          soql: `SELECT Id FROM ${reference.type} WHERE ${apexSourceSoqlWhere(identity)} LIMIT 1`,
          tooling: true,
          orgId: org.orgId
        },
        input =>
          Schema.decodeUnknownEffect(
            Schema.Struct({ totalSize: Schema.Number, records: Schema.Array(Schema.Struct({ Id: Schema.String })) })
          )(input)
      );
      const found = query.totalSize > 0;
      if (found) {
        yield* recorder.recordRemoteComponents(org.orgId, org.orgGeneration, 'tooling-api', [
          {
            type: reference.type,
            fullName: reference.fullName,
            ...(identity.namespacePrefix !== null ? { namespacePrefix: identity.namespacePrefix } : {})
          }
        ]);
      }
      return found;
    });
    const componentFindResult = Effect.fn('OrgMetadataCatalog.componentFindResult')(function* (
      org: CatalogOrg,
      reference: OrgMetadataCatalogComponentReference,
      observedAt: string
    ) {
      const workspaceInventory = yield* workspace.scanWorkspaceInventory(reference.type);
      const workspaceUri = Option.getOrUndefined(HashMap.get(workspaceInventory.components, reference.fullName));
      const inOrg = isApexSourceReference(reference) ? yield* findApexSource(org, reference) : false;
      if (workspaceUri || inOrg) {
        const orgUri =
          workspaceUri ??
          (yield* workspace
            .resolveComponents(org, [component(reference)], { prefer: 'org' })
            .pipe(Effect.map(resolutions => resolutions[0]?.orgUri)));
        if (orgUri === undefined && workspaceUri === undefined) {
          return [{ _tag: 'not-found' as const, reference, resultKind: 'component' as const }];
        }
        const documentUri = workspaceUri ?? orgUri;
        if (documentUri === undefined)
          return [{ _tag: 'not-found' as const, reference, resultKind: 'component' as const }];
        const componentEntry = {
          kind: 'component',
          reference,
          orgId: org.orgId,
          observedAt,
          provenance: inOrg && workspaceUri ? 'metadata-api+workspace' : inOrg ? 'tooling-api' : 'workspace',
          name: reference.fullName,
          documentUri,
          inOrg,
          inWorkspace: workspaceUri !== undefined,
          workspacePresenceAvailable: workspaceInventory.workspacePresenceAvailable,
          ...(workspaceUri ? { workspaceUri } : {})
        } satisfies OrgMetadataCatalogComponentEntry;
        return [{ _tag: 'component' as const, reference, entry: componentEntry }];
      }
      if (isApexSourceReference(reference))
        return [{ _tag: 'not-found' as const, reference, resultKind: 'component' as const }];
      const inventoryEntry = yield* inventories.getEntry(org, component(reference));
      const entry = inventoryEntry === undefined ? undefined : catalogEntry(inventoryEntry);
      return entry?.kind === 'component'
        ? [{ _tag: 'component' as const, reference, entry }]
        : [{ _tag: 'not-found' as const, reference, resultKind: 'component' as const }];
    });
    const findSObjectDescription = Effect.fn('OrgMetadataCatalog.findSObjectDescription')(function* (
      org: CatalogOrg,
      objectName: string,
      observedAt: string
    ) {
      yield* state.ensureHydrated(org.orgId);
      const cached = yield* state.getSObjectDescription(org.orgId, objectName);
      if (cached !== undefined) return cached;
      const raw = yield* descriptions
        .describeCustomObject(objectName, org.orgId)
        .pipe(
          Effect.catchTag('MetadataDescribeError', error =>
            isMissingSObject(error) ? Effect.void : Effect.fail(error)
          )
        );
      if (raw === undefined) return undefined;
      const transformed = yield* transmogrifier.toMinimalSObject(raw);
      const description: OrgSObjectDescription = {
        ...transformed,
        orgId: org.orgId,
        observedAt,
        provenance: 'rest-api'
      };
      yield* state.setSObjectDescription(org.orgId, description);
      yield* state.queuePersist(org.orgId);
      return description;
    });
    const find = Effect.fn('OrgMetadataCatalog.find')(function* (query: OrgMetadataCatalogFindQuery) {
      const org = yield* orgs.capture();
      const results = yield* Effect.forEach(
        query.evidence,
        reference =>
          Effect.gen(function* () {
            const observedAt = DateTime.formatIso(yield* DateTime.now);
            const componentResults = query.resultKinds.includes('component')
              ? yield* componentFindResult(org, reference, observedAt)
              : [];
            if (reference.type !== 'CustomObject' || !query.resultKinds.includes('sobject')) return componentResults;
            const description = yield* findSObjectDescription(org, reference.fullName, observedAt);
            return description === undefined
              ? [...componentResults, { _tag: 'not-found' as const, reference, resultKind: 'sobject' as const }]
              : [...componentResults, { _tag: 'sobject' as const, reference, description }];
          }),
        { concurrency: 'unbounded' }
      );
      return yield* orgs.commit(org, Effect.succeed(results.flat()));
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
    return OrgMetadataCatalog.of({ getChildren, getEntries, hasTypeInventory, resolveComponents, find });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
