/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { ConnectionService } from '../core/connectionService';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { FOLDERED_METADATA_TYPES, MetadataDescribeService } from '../core/metadataDescribeService';
import { MetadataRegistryService } from '../core/metadataRegistryService';
import { MetadataRetrieveService } from '../core/metadataRetrieveService';
import { ProjectService } from '../core/projectService';
import { QueryService } from '../core/queryService';
import { orgIdFromConnection } from '../core/schemas/authFields';
import { TransmogrifierService } from '../core/transmogrifierService';
import { makeOrgCatalogInventory } from './orgCatalogInventory';
import { OrgCatalogState } from './orgCatalogState';
import { makeOrgCatalogTreeProjection } from './orgCatalogTreeProjection';
import { makeOrgCatalogWorkspace } from './orgCatalogWorkspace';
import { OrgMetadataCatalogRecorder } from './orgMetadataCatalogRecorder';
import {
  type OrgMetadataCatalogComponentReference,
  type OrgMetadataCatalogComponentEntry,
  type OrgMetadataCatalogEntry,
  type OrgMetadataCatalogFindQuery,
  type OrgMetadataCatalogFindResult,
  type OrgMetadataCatalogInternalEntry,
  type OrgMetadataCatalogReference,
  type OrgMetadataConsistency,
  type OrgMetadataHierarchyConsistency
} from './orgMetadataCatalogTypes';
import {
  documentUri as catalogDocumentUri,
  type OrgMetadataComponentReference,
  type OrgMetadataReference
} from './orgMetadataReference';

const toInternalReference = (reference: OrgMetadataCatalogReference): OrgMetadataReference => ({
  ...(reference.type ? { xmlName: reference.type } : {}),
  ...(reference.fullName ? { fullName: reference.fullName } : {})
});

const toInternalComponentReference = (
  reference: OrgMetadataCatalogComponentReference
): OrgMetadataComponentReference => ({ xmlName: reference.type, fullName: reference.fullName });

const toCatalogEntry = (entry: OrgMetadataCatalogInternalEntry): OrgMetadataCatalogEntry =>
  entry.kind === 'type'
    ? { ...entry, reference: { type: entry.reference.xmlName } }
    : { ...entry, reference: { type: entry.reference.xmlName, fullName: entry.reference.fullName } };

const escapeSoql = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

const apexClassQuery = (name: string, namespacePrefix: string | null): string =>
  `SELECT Id FROM ApexClass WHERE Name = '${escapeSoql(name)}' AND NamespacePrefix = ${
    namespacePrefix === null ? 'null' : `'${escapeSoql(namespacePrefix)}'`
  } LIMIT 1`;

const apexClassToolingIdentity = (
  fullName: string
): { readonly name: string; readonly namespacePrefix: string | null } => {
  const separatorIndex = fullName.indexOf('__');
  return separatorIndex === -1
    ? { name: fullName, namespacePrefix: null }
    : { name: fullName.slice(separatorIndex + '__'.length), namespacePrefix: fullName.slice(0, separatorIndex) };
};

/**
 * Canonical, services-owned inventory and content catalog for metadata in the
 * active org and workspace. Consumers query it; only services mutates its
 * caches in response to org, workspace, and retrieve lifecycle events.
 */
export class OrgMetadataCatalog extends Effect.Service<OrgMetadataCatalog>()('OrgMetadataCatalog', {
  accessors: true,
  dependencies: [
    ConnectionService.Default,
    MetadataDescribeService.Default,
    MetadataRegistryService.Default,
    MetadataRetrieveService.Default,
    ProjectService.Default,
    QueryService.Default,
    OrgCatalogState.Default,
    OrgMetadataCatalogRecorder.Default,
    TransmogrifierService.Default
  ],
  effect: Effect.gen(function* () {
    const [
      connectionService,
      metadataDescribeService,
      transmogrifier,
      inventories,
      state,
      treeProjection,
      workspace,
      recorder,
      registry,
      queryService
    ] = yield* Effect.all([
      ConnectionService,
      MetadataDescribeService,
      TransmogrifierService,
      makeOrgCatalogInventory,
      OrgCatalogState,
      makeOrgCatalogTreeProjection,
      makeOrgCatalogWorkspace,
      OrgMetadataCatalogRecorder,
      MetadataRegistryService,
      QueryService
    ]);
    const getActiveOrgId = Effect.fn('OrgMetadataCatalog.getActiveOrgId')(function* () {
      const { orgId } = yield* SubscriptionRef.get(yield* getDefaultOrgRef());
      if (orgId) return orgId;

      // Startup race: ref may lack orgId; re-acquire connection for AuthFields org id.
      return yield* connectionService.getConnection().pipe(
        Effect.map(orgIdFromConnection),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(vscode.FileSystemError.Unavailable('No default org is configured')),
            onSome: Effect.succeed
          })
        )
      );
    });

    const findApexClass = Effect.fn('OrgMetadataCatalog.findApexClass')(function* (
      orgId: string,
      reference: OrgMetadataCatalogComponentReference
    ) {
      const { name, namespacePrefix } = apexClassToolingIdentity(reference.fullName);
      const { totalSize } = yield* queryService.query(
        { soql: apexClassQuery(name, namespacePrefix), tooling: true, orgId },
        Schema.Struct({ Id: Schema.String })
      );
      const found = totalSize > 0;
      yield* Effect.annotateCurrentSpan({ found, namespaceQualified: namespacePrefix !== null });
      return found;
    });

    const resolveComponents = Effect.fn('OrgMetadataCatalog.resolveComponents')(function* (
      references: readonly OrgMetadataCatalogComponentReference[]
    ) {
      const orgId = yield* getActiveOrgId();
      const resolutions = yield* workspace.resolveComponents(orgId, references.map(toInternalComponentReference), {
        prefer: 'workspace'
      });
      yield* recorder.recordRemoteComponents(
        orgId,
        'tooling-api',
        resolutions.map(resolution => ({
          type: resolution.reference.xmlName,
          fullName: resolution.reference.fullName,
          documentUri: resolution.orgUri,
          ...(resolution.workspaceUri ? { workspaceUri: resolution.workspaceUri } : {})
        }))
      );
      return resolutions.map(resolution => ({
        ...resolution,
        reference: { type: resolution.reference.xmlName, fullName: resolution.reference.fullName }
      }));
    });

    const invalidateHierarchy = Effect.fn('OrgMetadataCatalog.invalidateHierarchy')(function* (
      orgId: string,
      reference: OrgMetadataReference
    ) {
      if (!reference.xmlName) {
        yield* metadataDescribeService.invalidateDescribe(orgId);
      } else if (FOLDERED_METADATA_TYPES.has(reference.xmlName)) {
        yield* metadataDescribeService.invalidateAllListMetadata(orgId);
      } else {
        yield* metadataDescribeService.invalidateListMetadata(reference.xmlName, undefined, orgId);
      }
      yield* treeProjection.clearLoadedChildren(orgId, reference);
      yield* state.ensureHydrated(orgId);
      yield* reference.xmlName
        ? state.invalidateTypes(orgId, new Set([reference.xmlName]))
        : state.invalidateOrgInventories(orgId);
      yield* state.persistOrg(orgId);
    });

    const getChildren = Effect.fn('OrgMetadataCatalog.getChildren')(function* (
      reference: OrgMetadataCatalogReference = {},
      options: { readonly consistency?: OrgMetadataHierarchyConsistency } = {}
    ) {
      const orgId = yield* getActiveOrgId();
      const internalReference = toInternalReference(reference);
      if (options.consistency === 'cache-only') {
        return internalReference.xmlName
          ? yield* treeProjection.getChildrenCached(orgId, internalReference).pipe(
              Effect.map(children => children ?? []),
              Effect.map(Arr.map(toCatalogEntry))
            )
          : [];
      }
      if (options.consistency === 'refresh') yield* invalidateHierarchy(orgId, internalReference);
      return yield* treeProjection.getChildren(orgId, internalReference).pipe(Effect.map(Arr.map(toCatalogEntry)));
    });

    /** Whether the direct component inventory for a type is already available without an API call. */
    const hasTypeInventory = Effect.fn('OrgMetadataCatalog.hasTypeInventory')(function* (type: string) {
      const orgId = yield* getActiveOrgId();
      yield* state.ensureHydrated(orgId);
      const [loaded, persisted] = yield* Effect.all([
        state.getInventory(orgId, type),
        state.getPersistedInventory(orgId, type)
      ]);
      return Boolean(loaded?.complete ?? persisted?.complete);
    });

    const getEntries = Effect.fn('OrgMetadataCatalog.getEntries')(function* (
      references: readonly OrgMetadataCatalogComponentReference[],
      options: { readonly consistency?: OrgMetadataConsistency } = {}
    ) {
      const orgId = yield* getActiveOrgId();
      const internalReferences = references.map(toInternalComponentReference);
      if (options.consistency === 'refresh') {
        const xmlNames = new Set(internalReferences.map(reference => reference.xmlName));
        yield* Effect.forEach(
          xmlNames,
          xmlName =>
            FOLDERED_METADATA_TYPES.has(xmlName)
              ? metadataDescribeService.invalidateAllListMetadata(orgId)
              : metadataDescribeService.invalidateListMetadata(xmlName, undefined, orgId),
          { concurrency: 1, discard: true }
        );
        yield* state.ensureHydrated(orgId);
        yield* state.invalidateTypes(orgId, xmlNames);
        yield* state.persistOrg(orgId);
      }
      return yield* Effect.forEach(internalReferences, reference => inventories.getEntry(orgId, reference), {
        concurrency: 'unbounded'
      }).pipe(Effect.map(entries => entries.map(entry => (entry ? toCatalogEntry(entry) : entry))));
    });

    const find = Effect.fn('OrgMetadataCatalog.find')(function* (query: OrgMetadataCatalogFindQuery) {
      const orgId = yield* getActiveOrgId();
      yield* Effect.annotateCurrentSpan({
        evidenceCount: query.evidence.length,
        metadataTypeCount: new Set(query.evidence.map(reference => reference.type)).size,
        componentRequested: query.resultKinds.includes('component'),
        sobjectRequested: query.resultKinds.includes('sobject')
      });
      const results = yield* Effect.forEach(
        query.evidence,
        reference =>
          Effect.gen(function* () {
            if (reference.type === 'ApexClass' && query.resultKinds.includes('component')) {
              const [workspaceResolution] = yield* workspace.findWorkspaceComponents([
                toInternalComponentReference(reference)
              ]);
              const inOrg = yield* findApexClass(orgId, reference);
              if (!workspaceResolution?.workspaceUri && !inOrg) {
                return [{ kind: 'not-found' as const, reference, resultKind: 'component' as const }];
              }
              const resolvedDocumentUri =
                workspaceResolution?.workspaceUri ??
                (yield* catalogDocumentUri({ orgId, ...toInternalComponentReference(reference) }).pipe(
                  Effect.provideService(MetadataRegistryService, registry)
                ));
              return [
                {
                  kind: 'component' as const,
                  reference,
                  entry: {
                    kind: 'component',
                    reference,
                    orgId,
                    observedAt: new Date().toISOString(),
                    provenance:
                      inOrg && workspaceResolution?.workspaceUri
                        ? 'metadata-api+workspace'
                        : inOrg
                          ? 'tooling-api'
                          : 'workspace',
                    name: reference.fullName,
                    documentUri: resolvedDocumentUri,
                    inOrg,
                    inWorkspace: Boolean(workspaceResolution?.workspaceUri),
                    ...(workspaceResolution?.workspaceUri ? { workspaceUri: workspaceResolution.workspaceUri } : {})
                  } satisfies OrgMetadataCatalogComponentEntry
                }
              ];
            }
            const component = query.resultKinds.includes('component')
              ? yield* workspace.findWorkspaceComponents([toInternalComponentReference(reference)]).pipe(
                  Effect.flatMap(([workspaceResolution]) => {
                    if (workspaceResolution?.workspaceUri) {
                      return Effect.succeed<readonly OrgMetadataCatalogFindResult[]>([
                        {
                          kind: 'component' as const,
                          reference,
                          entry: {
                            kind: 'component',
                            reference,
                            orgId,
                            observedAt: new Date().toISOString(),
                            provenance: 'workspace',
                            name: reference.fullName,
                            documentUri: workspaceResolution.workspaceUri,
                            inOrg: false,
                            inWorkspace: true,
                            workspaceUri: workspaceResolution.workspaceUri
                          } satisfies OrgMetadataCatalogComponentEntry
                        }
                      ]);
                    }
                    return inventories.getEntry(orgId, toInternalComponentReference(reference)).pipe(
                      Effect.map((entry): readonly OrgMetadataCatalogFindResult[] =>
                        entry?.kind === 'component'
                          ? [
                              {
                                kind: 'component' as const,
                                reference,
                                entry: {
                                  ...entry,
                                  kind: 'component' as const,
                                  reference: { type: entry.reference.xmlName, fullName: entry.reference.fullName }
                                }
                              }
                            ]
                          : [{ kind: 'not-found' as const, reference, resultKind: 'component' as const }]
                      )
                    );
                  })
                )
              : [];
            if (reference.type !== 'CustomObject' || !query.resultKinds.includes('sobject')) return component;

            yield* state.ensureHydrated(orgId);
            const cached = yield* state.getSObjectDescription(orgId, reference.fullName);
            if (cached) {
              return [...component, { kind: 'sobject' as const, reference, description: cached }];
            }
            const rawSObject = yield* metadataDescribeService
              .describeCustomObject(reference.fullName, orgId)
              .pipe(
                Effect.catchTag('MetadataDescribeError', error => (error.notFound ? Effect.void : Effect.fail(error)))
              );
            if (rawSObject === undefined) {
              return [...component, { kind: 'not-found' as const, reference, resultKind: 'sobject' as const }];
            }
            const transformed = yield* transmogrifier.toMinimalSObject(rawSObject);
            const sobjectDescription = {
              ...transformed,
              orgId,
              observedAt: new Date().toISOString(),
              provenance: 'rest-api' as const
            };
            const description = yield* state
              .getSObjectDescription(orgId, sobjectDescription.name)
              .pipe(
                Effect.flatMap(recorded =>
                  recorded
                    ? Effect.succeed(recorded)
                    : state
                        .setSObjectDescription(orgId, sobjectDescription)
                        .pipe(Effect.andThen(state.queuePersist(orgId)), Effect.as(sobjectDescription))
                )
              );
            return [
              ...component,
              {
                kind: 'sobject' as const,
                reference,
                description
              }
            ];
          }),
        { concurrency: 'unbounded' }
      );
      const flattened = results.flat();
      yield* Effect.annotateCurrentSpan({
        componentResultCount: flattened.filter(result => result.kind === 'component').length,
        notFoundResultCount: flattened.filter(result => result.kind === 'not-found').length,
        sobjectResultCount: flattened.filter(result => result.kind === 'sobject').length
      });
      return flattened;
    });

    return {
      find,
      getChildren,
      getEntries,
      hasTypeInventory,
      resolveComponents
    };
  })
}) {}
