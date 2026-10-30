/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { TypeInventory } from './orgCatalogInternalTypes.js';
import {
  MetadataDescribeService,
  MetadataRegistryService,
  OrgMetadataCatalogError,
  TransmogrifierService,
  documentUri,
  isOrgMetadataComponentReference,
  type OrgMetadataCatalogInternalEntry,
  type OrgMetadataReference,
  type OrgSObjectDescription
} from '@salesforce/vscode-services-v2';
import * as Arr from 'effect/Array';
import * as Context from 'effect/Context';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';
import * as vscode from 'vscode';
import { MetadataDescribeInvalidation } from '../metadataDescribeService.js';
import { ServiceOperations, ServiceOperationsLayer } from '../serviceOperations.js';
import { OrgCatalogInventory } from './orgCatalogInventory.js';
import { findInventoryComponent } from './orgCatalogKeys.js';
import { makeOrgCatalogOrg, type CatalogOrg } from './orgCatalogOrg.js';
import { projectChildren } from './orgCatalogProjection.js';
import { OrgCatalogState } from './orgCatalogState.js';
import { OrgCatalogWorkspace } from './orgCatalogWorkspace.js';

const loadedKey = (org: CatalogOrg, reference: OrgMetadataReference) =>
  `${org.orgId}\0${org.orgGeneration}\0${reference.xmlName ?? ''}\0${reference.fullName ?? ''}`;
const emptyFields: TypeInventory = {
  observedAt: '1970-01-01T00:00:00.000Z',
  complete: false,
  components: HashMap.empty(),
  componentIdentityOrder: [],
  folders: HashMap.empty(),
  folderFullNameOrder: []
};
const timestamp = DateTime.now.pipe(Effect.map(DateTime.formatIso));
const refreshDescriptionErrorTags = [
  'MetadataDescribeError',
  'SchemaError',
  'FailedToCreateAuthInfoError',
  'FailedToCreateConnectionError',
  'NoTargetOrgConfiguredError',
  'AccessTokenExpiredError',
  'MissingSettingsError',
  'NoWorkspaceOpenError',
  'FailedToCreateConfigAggregatorError'
] as const;

const makeOrgCatalogTreeProjection = Effect.gen(function* () {
  const inventories = yield* OrgCatalogInventory;
  const state = yield* OrgCatalogState;
  const workspace = yield* OrgCatalogWorkspace;
  const registry = yield* MetadataRegistryService;
  const descriptions = yield* MetadataDescribeService;
  const invalidation = yield* MetadataDescribeInvalidation;
  const transmogrifier = yield* TransmogrifierService;
  const orgs = yield* makeOrgCatalogOrg;
  const operations = yield* ServiceOperations;
  const loaded = yield* Ref.make(
    HashMap.empty<
      string,
      { readonly generation: number; readonly children: readonly OrgMetadataCatalogInternalEntry[] }
    >()
  );
  const getCustomFieldChildren = Effect.fn('OrgCatalogTreeProjection.getCustomFieldChildren')(function* (
    org: CatalogOrg,
    object: OrgMetadataCatalogInternalEntry,
    cacheOnly = false
  ) {
    if (!isOrgMetadataComponentReference(object.reference)) return [];
    const orgId = org.orgId;
    const objectName = object.namespacePrefix
      ? `${object.namespacePrefix}__${object.reference.fullName}`
      : object.reference.fullName;
    yield* state.ensureHydrated(orgId);
    const existingDescription = yield* state.getSObjectDescription(orgId, objectName);
    const fields = yield* cacheOnly
      ? inventories.loadCachedType(org, 'CustomField')
      : inventories
          .loadType(org, 'CustomField')
          .pipe(
            Effect.catchTag('ListMetadataError', error =>
              Effect.logWarning('Failed to list CustomField inventory', error).pipe(Effect.as(emptyFields))
            )
          );
    if (!fields) return [];
    const acquireDescription = descriptions.describeCustomObject(objectName, orgId).pipe(
      Effect.flatMap(transmogrifier.toMinimalSObject),
      Effect.flatMap(sobject =>
        timestamp.pipe(
          Effect.map(descriptionObservedAt => ({
            ...sobject,
            orgId,
            observedAt: descriptionObservedAt,
            provenance: 'rest-api' as const
          }))
        )
      )
    );
    const cachedDescription = existingDescription ?? (cacheOnly ? undefined : yield* acquireDescription);
    const description: OrgSObjectDescription | undefined =
      cachedDescription &&
      !cacheOnly &&
      fields.complete &&
      Date.parse(fields.observedAt) > Date.parse(cachedDescription.observedAt)
        ? yield* invalidation
            .invalidateForTracking(orgId, org.orgGeneration, [{ xmlName: 'CustomObject', fullName: objectName }], true)
            .pipe(
              Effect.andThen(acquireDescription),
              Effect.catchTag(refreshDescriptionErrorTags, error =>
                Effect.logWarning('Failed to refresh stale SObject description', error).pipe(
                  Effect.as(cachedDescription)
                )
              )
            )
        : cachedDescription;
    const parentNames = new Set([object.reference.fullName, objectName]);
    const inventoryFields = HashMap.toValues(fields.components).filter(entry => {
      if (!isOrgMetadataComponentReference(entry.reference)) return false;
      const separator = entry.reference.fullName.lastIndexOf('.');
      return separator > 0 && parentNames.has(entry.reference.fullName.slice(0, separator));
    });
    const described = description?.fields.filter(field => field.custom) ?? [];
    const unqualified = (name: string) =>
      object.namespacePrefix ? name.replace(`${object.namespacePrefix}__`, '') : name;
    const byName = HashMap.fromIterable(
      described.flatMap(field => [[field.name, field] as const, [unqualified(field.name), field] as const])
    );
    const details = (field: (typeof described)[number], name: string) => ({
      name,
      type: field.type,
      length: field.length,
      relationshipName: field.relationshipName,
      scale: field.scale,
      precision: field.precision
    });
    const entries = inventoryFields.map(entry => {
      const fullName = entry.reference.fullName!;
      const fieldName = fullName.slice(fullName.lastIndexOf('.') + 1);
      const describedField = Option.getOrUndefined(
        Option.orElse(HashMap.get(byName, fieldName), () => HashMap.get(byName, unqualified(fieldName)))
      );
      return {
        ...entry,
        name: unqualified(fieldName),
        namespacePrefix: object.namespacePrefix,
        ...(describedField ? { field: details(describedField, unqualified(fieldName)) } : {})
      } satisfies OrgMetadataCatalogInternalEntry;
    });
    const inventoried = new Set(inventoryFields.map(entry => entry.reference.fullName));
    const observedAt = yield* timestamp;
    const describedOnly = yield* Effect.forEach(
      described,
      field =>
        Effect.gen(function* () {
          const name = unqualified(field.name);
          const candidates = [`${object.reference.fullName}.${field.name}`, `${object.reference.fullName}.${name}`];
          const fullName =
            candidates.find(candidate =>
              findInventoryComponent(fields.components, { xmlName: 'CustomField', fullName: candidate })
            ) ?? candidates[0]!;
          if (inventoried.has(fullName)) return [];
          const existing = findInventoryComponent(fields.components, { xmlName: 'CustomField', fullName });
          return [
            {
              ...(existing ?? {
                orgId,
                observedAt,
                provenance: 'rest-api',
                reference: { xmlName: 'CustomField', fullName },
                documentUri: yield* documentUri({ orgId, xmlName: 'CustomField', fullName }).pipe(
                  Effect.provideService(MetadataRegistryService, registry)
                ),
                kind: 'component',
                inOrg: true,
                inWorkspace: false,
                ...(fields.workspacePresenceAvailable === false ? { workspacePresenceAvailable: false } : {})
              }),
              name,
              namespacePrefix: object.namespacePrefix,
              field: details(field, name)
            } satisfies OrgMetadataCatalogInternalEntry
          ];
        }),
      { concurrency: 'unbounded' }
    ).pipe(Effect.map(rows => rows.flat()));
    return [...entries, ...describedOnly].toSorted((left, right) => left.name.localeCompare(right.name));
  });
  const loadRootTypes = Effect.fn('OrgCatalogTreeProjection.loadRootTypes')(function* (org: CatalogOrg) {
    const [metadataTypes, local] = yield* Effect.all(
      [descriptions.describe(org.orgId), workspace.getWorkspaceMetadataTypes(org)],
      { concurrency: 'unbounded' }
    );
    const orgTypes = new Set(metadataTypes.map(type => type.xmlName));
    const observedAt = yield* timestamp;
    return yield* Effect.forEach(
      Arr.dedupe([...orgTypes, ...local.types]),
      xmlName =>
        documentUri({ orgId: org.orgId, xmlName, fullName: '__type__' }).pipe(
          Effect.provideService(MetadataRegistryService, registry),
          Effect.map(
            uri =>
              ({
                orgId: org.orgId,
                observedAt,
                provenance: orgTypes.has(xmlName)
                  ? local.types.has(xmlName)
                    ? 'metadata-api+workspace'
                    : 'metadata-api'
                  : 'workspace',
                reference: { xmlName },
                documentUri: uri,
                name: xmlName,
                kind: 'type',
                inOrg: orgTypes.has(xmlName),
                inWorkspace: local.types.has(xmlName),
                ...(local.workspacePresenceAvailable ? {} : { workspacePresenceAvailable: false })
              }) satisfies OrgMetadataCatalogInternalEntry
          )
        ),
      { concurrency: 'unbounded' }
    ).pipe(Effect.map(rows => rows.toSorted((left, right) => left.name.localeCompare(right.name))));
  });
  const loadTypeChildren = Effect.fn('OrgCatalogTreeProjection.loadTypeChildren')(function* (
    org: CatalogOrg,
    reference: OrgMetadataReference
  ) {
    const xmlName = reference.xmlName!;
    const inventory = yield* inventories.loadType(org, xmlName);
    const component = reference.fullName
      ? findInventoryComponent(inventory.components, { xmlName, fullName: reference.fullName })
      : undefined;
    if (component && xmlName === 'CustomObject') return yield* getCustomFieldChildren(org, component);
    return yield* projectChildren(org.orgId, xmlName, reference.fullName, inventory).pipe(
      Effect.provideService(MetadataRegistryService, registry),
      Effect.filterOrFail(
        children => children.length > 0 || !reference.fullName || HashMap.has(inventory.folders, reference.fullName),
        () => vscode.FileSystemError.FileNotADirectory(`${reference.xmlName}/${reference.fullName}`)
      )
    );
  });
  const getChildren = Effect.fn('OrgCatalogTreeProjection.getChildren')(function* (
    org: CatalogOrg,
    reference: OrgMetadataReference = {}
  ) {
    yield* orgs.validate(org);
    const generation = yield* state.getHierarchyGeneration(org.orgId);
    const children = yield* reference.xmlName ? loadTypeChildren(org, reference) : loadRootTypes(org);
    yield* validateProjection(
      org,
      reference,
      generation,
      Ref.update(loaded, values => HashMap.set(values, loadedKey(org, reference), { children, generation }))
    );
    return children;
  }, operations.run);
  const validateProjection = <A, E>(
    org: CatalogOrg,
    reference: OrgMetadataReference,
    generation: number,
    program: Effect.Effect<A, E>
  ) =>
    state.withHierarchyCommit(
      orgs.commit(
        org,
        state.getHierarchyGeneration(org.orgId).pipe(
          Effect.flatMap(
            (current): Effect.Effect<A, E | OrgMetadataCatalogError> =>
              current === generation
                ? program
                : Effect.fail(
                    new OrgMetadataCatalogError({
                      message: 'Metadata changed while its hierarchy was being read',
                      cause: 'Catalog hierarchy invalidated',
                      reference
                    })
                  )
          )
        )
      )
    );
  const getChildrenCached = Effect.fn('OrgCatalogTreeProjection.getChildrenCached')(function* (
    org: CatalogOrg,
    reference: OrgMetadataReference
  ) {
    yield* orgs.validate(org);
    const generation = yield* state.getHierarchyGeneration(org.orgId);
    const projection = Option.getOrUndefined(
      Option.filter(
        HashMap.get(yield* Ref.get(loaded), loadedKey(org, reference)),
        value => value.generation === generation
      )
    );
    if (projection || !reference.xmlName)
      return yield* validateProjection(org, reference, generation, Effect.succeed(projection?.children));
    const inventory = yield* inventories.loadCachedType(org, reference.xmlName);
    if (!inventory) return yield* validateProjection(org, reference, generation, Effect.void);
    const component = reference.fullName
      ? findInventoryComponent(inventory.components, { xmlName: reference.xmlName, fullName: reference.fullName })
      : undefined;
    const children = yield* component && reference.xmlName === 'CustomObject'
      ? getCustomFieldChildren(org, component, true)
      : projectChildren(org.orgId, reference.xmlName, reference.fullName, inventory).pipe(
          Effect.provideService(MetadataRegistryService, registry)
        );
    return yield* validateProjection(org, reference, generation, Effect.succeed(children));
  }, operations.run);
  const clearLoadedChildren = Effect.fn('OrgCatalogTreeProjection.clearLoadedChildren')(
    (org: CatalogOrg, reference: OrgMetadataReference) =>
      orgs.commit(
        org,
        Ref.update(loaded, values =>
          HashMap.filter(
            values,
            (_value, key) =>
              !key.startsWith(
                reference.xmlName ? `${org.orgId}\0${org.orgGeneration}\0${reference.xmlName}\0` : `${org.orgId}\0`
              )
          )
        )
      ),
    operations.run
  );
  yield* Effect.addFinalizer(() => operations.close);
  return { getChildren, getChildrenCached, clearLoadedChildren };
});
export class OrgCatalogTreeProjection extends Context.Service<
  OrgCatalogTreeProjection,
  Effect.Success<typeof makeOrgCatalogTreeProjection>
>()('@salesforce/vscode-services-v4-implementation/OrgCatalogTreeProjection') {}
export const OrgCatalogTreeProjectionLayer = Layer.effect(OrgCatalogTreeProjection, makeOrgCatalogTreeProjection).pipe(
  Layer.provideMerge(ServiceOperationsLayer)
);
