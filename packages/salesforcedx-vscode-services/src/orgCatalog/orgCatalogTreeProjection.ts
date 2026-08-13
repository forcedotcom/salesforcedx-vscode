/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataCatalogInternalEntry as OrgMetadataCatalogEntry } from './orgMetadataCatalogTypes';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { MetadataDescribeService } from '../core/metadataDescribeService';
import { TransmogrifierService } from '../core/transmogrifierService';
import { OrgCatalogInventory } from './orgCatalogInventory';
import { projectChildren } from './orgCatalogProjection';
import { OrgCatalogState } from './orgCatalogState';
import { OrgCatalogWorkspace } from './orgCatalogWorkspace';
import {
  isOrgMetadataComponentReference,
  OrgMetadataReferenceService,
  type OrgMetadataReference
} from './orgMetadataReference';

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
    const entryUri = (orgId: string, xmlName: string, fullName: string) =>
      references.documentUri({ orgId, xmlName, fullName: fullName || '__type__' });
    const getCustomFieldChildren = Effect.fn('OrgCatalogTreeProjection.getCustomFieldChildren')(function* (
      orgId: string,
      objectEntry: OrgMetadataCatalogEntry
    ) {
      if (!isOrgMetadataComponentReference(objectEntry.reference)) return [];
      const objectApiName = objectEntry.namespacePrefix
        ? `${objectEntry.namespacePrefix}__${objectEntry.reference.fullName}`
        : objectEntry.reference.fullName;
      const fieldInventory = yield* inventories.loadType(orgId, 'CustomField');
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
        Date.parse(fieldInventory.observedAt) > Date.parse(cachedDescription.observedAt)
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
      const inventoryFields = [...fieldInventory.components.values()].filter(entry => {
        if (!isOrgMetadataComponentReference(entry.reference)) return false;
        const separator = entry.reference.fullName.lastIndexOf('.');
        return separator > 0 && parentNames.has(entry.reference.fullName.slice(0, separator));
      });
      const describedFields = describedObject.fields.filter(field => field.custom);
      const describedByName = new Map<string, (typeof describedFields)[number]>();
      describedFields.forEach(field => {
        describedByName.set(field.name, field);
        if (objectEntry.namespacePrefix) {
          describedByName.set(field.name.replace(`${objectEntry.namespacePrefix}__`, ''), field);
        }
      });
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
        const described = describedByName.get(fieldName) ?? describedByName.get(unqualifiedName);
        return {
          ...entry,
          name: unqualifiedName,
          namespacePrefix: objectEntry.namespacePrefix,
          ...(described ? { field: toFieldDetails(described, unqualifiedName) } : {})
        } satisfies OrgMetadataCatalogEntry;
      });
      const inventoriedFullNames = new Set(inventoryFields.map(entry => entry.reference.fullName));
      const describedOnlyEntries = describedFields.flatMap(field => {
        const unqualifiedName = objectEntry.namespacePrefix
          ? field.name.replace(`${objectEntry.namespacePrefix}__`, '')
          : field.name;
        const candidates = [
          `${objectEntry.reference.fullName}.${field.name}`,
          `${objectEntry.reference.fullName}.${unqualifiedName}`
        ];
        const fullName = candidates.find(candidate => fieldInventory.components.has(candidate)) ?? candidates[0];
        if (inventoriedFullNames.has(fullName)) return [];
        const existing = fieldInventory.components.get(fullName);
        return [
          {
            ...(existing ?? {
              orgId,
              observedAt: new Date().toISOString(),
              provenance: 'rest-api' as const,
              reference: { xmlName: 'CustomField', fullName },
              documentUri: entryUri(orgId, 'CustomField', fullName),
              kind: 'component' as const,
              inOrg: true,
              inWorkspace: false
            }),
            name: unqualifiedName,
            namespacePrefix: objectEntry.namespacePrefix,
            field: toFieldDetails(field, unqualifiedName)
          } satisfies OrgMetadataCatalogEntry
        ];
      });
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
        return [...new Set([...orgTypes, ...workspaceTypes])]
          .map(xmlName => ({
            orgId,
            observedAt: new Date().toISOString(),
            provenance:
              orgTypes.has(xmlName) && workspaceTypes.has(xmlName)
                ? ('metadata-api+workspace' as const)
                : orgTypes.has(xmlName)
                  ? ('metadata-api' as const)
                  : ('workspace' as const),
            reference: { xmlName },
            documentUri: entryUri(orgId, xmlName, ''),
            name: xmlName,
            kind: 'type' as const,
            inOrg: orgTypes.has(xmlName),
            inWorkspace: workspaceTypes.has(xmlName)
          }))
          .toSorted((left, right) => left.name.localeCompare(right.name));
      }
      const inventory = yield* inventories.loadType(orgId, reference.xmlName);
      const component = reference.fullName ? inventory.components.get(reference.fullName) : undefined;
      if (component && reference.xmlName === 'CustomObject') {
        return yield* getCustomFieldChildren(orgId, component);
      }
      const children = projectChildren(entryUri, orgId, reference.xmlName, reference.fullName, inventory);
      if (children.length === 0 && reference.fullName && !inventory.folders.has(reference.fullName)) {
        return yield* Effect.fail(
          vscode.FileSystemError.FileNotADirectory(`${reference.xmlName}/${reference.fullName}`)
        );
      }
      return children;
    });

    const getChildrenCached = Effect.fn('OrgCatalogTreeProjection.getChildrenCached')(function* (
      orgId: string,
      reference: OrgMetadataReference
    ) {
      if (!reference.xmlName) return undefined;
      const inventory = yield* inventories.getCachedInventory(orgId, reference.xmlName);
      return inventory ? projectChildren(entryUri, orgId, reference.xmlName, reference.fullName, inventory) : undefined;
    });

    return { getChildren, getChildrenCached, getCustomFieldChildren } as const;
  })
}) {}
