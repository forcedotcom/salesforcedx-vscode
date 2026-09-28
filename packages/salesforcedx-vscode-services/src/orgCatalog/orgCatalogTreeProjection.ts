/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TypeInventory } from './orgCatalogInternalTypes';
import type { OrgMetadataCatalogInternalEntry as OrgMetadataCatalogEntry } from './orgMetadataCatalogTypes';
import * as Arr from 'effect/Array';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as HashMap from 'effect/HashMap';
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { MetadataDescribeService } from '../core/metadataDescribeService';
import { TransmogrifierService } from '../core/transmogrifierService';
import { OrgCatalogInventory } from './orgCatalogInventory';
import { findInventoryComponent } from './orgCatalogKeys';
import { projectChildren } from './orgCatalogProjection';
import { OrgCatalogState } from './orgCatalogState';
import { OrgCatalogWorkspace } from './orgCatalogWorkspace';
import {
  isOrgMetadataComponentReference,
  OrgMetadataReferenceService,
  type OrgMetadataReference
} from './orgMetadataReference';

const emptyCustomFieldInventory: TypeInventory = {
  observedAt: '1970-01-01T00:00:00.000Z',
  complete: false,
  components: HashMap.empty(),
  componentIdentityOrder: [],
  folders: HashMap.empty(),
  folderFullNameOrder: []
};

export class OrgCatalogTreeProjection extends Effect.Service<OrgCatalogTreeProjection>()('OrgCatalogTreeProjection', {
  accessors: true,
  dependencies: [
    OrgCatalogInventory.Default,
    OrgCatalogState.Default,
    OrgCatalogWorkspace.Default,
    OrgMetadataReferenceService.Default,
    MetadataDescribeService.Default,
    TransmogrifierService.Default
  ],
  effect: Effect.gen(function* () {
    const [inventories, state, workspace, references, metadataDescribeService, transmogrifier] = yield* Effect.all([
      OrgCatalogInventory,
      OrgCatalogState,
      OrgCatalogWorkspace,
      OrgMetadataReferenceService,
      MetadataDescribeService,
      TransmogrifierService
    ]);
    const getCustomFieldChildren = Effect.fn('OrgCatalogTreeProjection.getCustomFieldChildren')(function* (
      orgId: string,
      objectEntry: OrgMetadataCatalogEntry
    ) {
      if (!isOrgMetadataComponentReference(objectEntry.reference)) return [];
      const objectApiName = objectEntry.namespacePrefix
        ? `${objectEntry.namespacePrefix}__${objectEntry.reference.fullName}`
        : objectEntry.reference.fullName;
      const fieldInventory = yield* inventories
        .loadType(orgId, 'CustomField')
        .pipe(
          Effect.catchTag('ListMetadataError', error =>
            Effect.logWarning('Failed to list CustomField inventory', error).pipe(Effect.as(emptyCustomFieldInventory))
          )
        );
      yield* state.ensureHydrated(orgId);
      const acquireDescription = metadataDescribeService.describeCustomObject(objectApiName, orgId).pipe(
        Effect.flatMap(transmogrifier.toMinimalSObject),
        Effect.map(sobject => ({
          ...sobject,
          orgId,
          observedAt: new Date().toISOString(),
          provenance: 'rest-api' as const
        }))
      );
      const cachedDescription = yield* state
        .getSObjectDescription(orgId, objectApiName)
        .pipe(Effect.flatMap(description => (description ? Effect.succeed(description) : acquireDescription)));
      const describedObject =
        fieldInventory.complete && Date.parse(fieldInventory.observedAt) > Date.parse(cachedDescription.observedAt)
          ? yield* metadataDescribeService.invalidateSObjectDescribe(objectApiName, orgId).pipe(
              Effect.andThen(metadataDescribeService.describeCustomObject(objectApiName, orgId)),
              Effect.flatMap(transmogrifier.toMinimalSObject),
              Effect.map(sobject => ({
                ...sobject,
                orgId,
                observedAt: new Date().toISOString(),
                provenance: 'rest-api' as const
              })),
              Effect.catchAll(error =>
                Effect.logWarning('Failed to refresh stale SObject description', error).pipe(
                  Effect.as(cachedDescription)
                )
              )
            )
          : cachedDescription;
      const parentNames = new Set([objectEntry.reference.fullName, objectApiName]);
      const inventoryFields = HashMap.toValues(fieldInventory.components).filter(entry => {
        if (!isOrgMetadataComponentReference(entry.reference)) return false;
        const separator = entry.reference.fullName.lastIndexOf('.');
        return separator > 0 && parentNames.has(entry.reference.fullName.slice(0, separator));
      });
      const describedFields = describedObject.fields.filter(field => field.custom);
      const describedByName = describedFields.reduce(
        (byName, field) =>
          objectEntry.namespacePrefix
            ? pipe(
                byName,
                HashMap.set(field.name, field),
                HashMap.set(field.name.replace(`${objectEntry.namespacePrefix}__`, ''), field)
              )
            : HashMap.set(byName, field.name, field),
        HashMap.empty<string, (typeof describedFields)[number]>()
      );
      const toFieldDetails = (field: (typeof describedFields)[number], name: string) => ({
        name,
        type: field.type,
        length: field.length,
        relationshipName: field.relationshipName,
        scale: field.scale,
        precision: field.precision
      });
      const inventoryEntries = inventoryFields.map(entry => {
        const fullName = entry.reference.fullName!;
        const fieldName = fullName.slice(fullName.lastIndexOf('.') + 1);
        const unqualifiedName = objectEntry.namespacePrefix
          ? fieldName.replace(`${objectEntry.namespacePrefix}__`, '')
          : fieldName;
        const described = HashMap.get(describedByName, fieldName).pipe(
          Option.orElse(() => HashMap.get(describedByName, unqualifiedName)),
          Option.getOrUndefined
        );
        return {
          ...entry,
          name: unqualifiedName,
          namespacePrefix: objectEntry.namespacePrefix,
          ...(described ? { field: toFieldDetails(described, unqualifiedName) } : {})
        } satisfies OrgMetadataCatalogEntry;
      });
      const inventoriedFullNames = new Set(inventoryFields.map(entry => entry.reference.fullName));
      const describedOnlyEntries = yield* Effect.forEach(
        describedFields,
        field =>
          Effect.gen(function* () {
            const unqualifiedName = objectEntry.namespacePrefix
              ? field.name.replace(`${objectEntry.namespacePrefix}__`, '')
              : field.name;
            const candidates = [
              `${objectEntry.reference.fullName}.${field.name}`,
              `${objectEntry.reference.fullName}.${unqualifiedName}`
            ];
            const fullName =
              candidates.find(candidate =>
                findInventoryComponent(fieldInventory.components, { xmlName: 'CustomField', fullName: candidate })
              ) ?? candidates[0];
            if (inventoriedFullNames.has(fullName)) return [];
            const existing = findInventoryComponent(fieldInventory.components, { xmlName: 'CustomField', fullName });
            return [
              {
                ...(existing ?? {
                  orgId,
                  observedAt: new Date().toISOString(),
                  provenance: 'rest-api' as const,
                  reference: { xmlName: 'CustomField', fullName },
                  documentUri: yield* references.documentUri({
                    orgId,
                    xmlName: 'CustomField',
                    fullName
                  }),
                  kind: 'component' as const,
                  inOrg: true,
                  inWorkspace: false
                }),
                name: unqualifiedName,
                namespacePrefix: objectEntry.namespacePrefix,
                field: toFieldDetails(field, unqualifiedName)
              } satisfies OrgMetadataCatalogEntry
            ];
          }),
        { concurrency: 'unbounded' }
      ).pipe(Effect.map(entries => entries.flat()));
      return [...inventoryEntries, ...describedOnlyEntries].toSorted((left, right) =>
        left.name.localeCompare(right.name)
      );
    });

    const getChildren = Effect.fn('OrgCatalogTreeProjection.getChildren')(function* (
      orgId: string,
      reference: OrgMetadataReference = {}
    ) {
      if (!reference.xmlName) {
        const [metadataTypes, workspaceTypes] = yield* Effect.all(
          [metadataDescribeService.describe(orgId), workspace.getWorkspaceMetadataTypes(orgId)],
          { concurrency: 'unbounded' }
        );
        const orgTypes = new Set(metadataTypes.map(type => type.xmlName));
        return yield* Effect.forEach(
          Arr.dedupe([...orgTypes, ...workspaceTypes]),
          xmlName =>
            references.documentUri({ orgId, xmlName, fullName: '__type__' }).pipe(
              Effect.map(documentUri => ({
                orgId,
                observedAt: new Date().toISOString(),
                provenance:
                  orgTypes.has(xmlName) && workspaceTypes.has(xmlName)
                    ? ('metadata-api+workspace' as const)
                    : orgTypes.has(xmlName)
                      ? ('metadata-api' as const)
                      : ('workspace' as const),
                reference: { xmlName },
                documentUri,
                name: xmlName,
                kind: 'type' as const,
                inOrg: orgTypes.has(xmlName),
                inWorkspace: workspaceTypes.has(xmlName)
              }))
            ),
          { concurrency: 'unbounded' }
        ).pipe(Effect.map(entries => entries.toSorted((left, right) => left.name.localeCompare(right.name))));
      }
      const inventory = yield* inventories.loadType(orgId, reference.xmlName);
      const component = reference.fullName
        ? findInventoryComponent(inventory.components, { xmlName: reference.xmlName, fullName: reference.fullName })
        : undefined;
      if (component && reference.xmlName === 'CustomObject') {
        return yield* getCustomFieldChildren(orgId, component);
      }
      const children = yield* projectChildren(orgId, reference.xmlName, reference.fullName, inventory).pipe(
        Effect.provideService(OrgMetadataReferenceService, references)
      );
      return yield* Effect.succeed(children).pipe(
        Effect.filterOrFail(
          projectedChildren =>
            projectedChildren.length > 0 || !reference.fullName || HashMap.has(inventory.folders, reference.fullName),
          () => vscode.FileSystemError.FileNotADirectory(`${reference.xmlName}/${reference.fullName}`)
        )
      );
    });

    const getChildrenCached = Effect.fn('OrgCatalogTreeProjection.getChildrenCached')(function* (
      orgId: string,
      reference: OrgMetadataReference
    ) {
      if (!reference.xmlName) return undefined;
      const inventory = yield* inventories.getCachedInventory(orgId, reference.xmlName);
      return inventory
        ? yield* projectChildren(orgId, reference.xmlName, reference.fullName, inventory).pipe(
            Effect.provideService(OrgMetadataReferenceService, references)
          )
        : undefined;
    });

    return { getChildren, getChildrenCached } as const;
  })
}) {}
