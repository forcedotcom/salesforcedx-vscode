/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ListedMetadataComponent, TypeInventory } from './orgCatalogInternalTypes.js';
import {
  documentUri,
  isOrgMetadataComponentReference,
  type ArtifactNamespace,
  type OrgId,
  type OrgMetadataCatalogInternalEntry
} from '@salesforce/vscode-services-v2';
import * as Arr from 'effect/Array';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as HashMap from 'effect/HashMap';
import * as Option from 'effect/Option';
import type { URI } from 'vscode-uri';
import { componentIdentity, findInventoryComponent } from './orgCatalogKeys.js';

export const mergeInventory = Effect.fn('OrgCatalogProjection.mergeInventory')(function* (input: {
  readonly orgId: OrgId;
  readonly xmlName: string;
  readonly orgComponents: readonly ListedMetadataComponent[];
  readonly workspaceUris: HashMap.HashMap<string, URI>;
  readonly workspacePresenceAvailable?: boolean;
  readonly workspaceNamespace?: ArtifactNamespace;
  readonly observedAt: string;
}) {
  const {
    orgId,
    xmlName,
    orgComponents,
    workspaceUris,
    workspacePresenceAvailable = true,
    workspaceNamespace = null,
    observedAt
  } = input;
  const uri = (fullName: string) => documentUri({ orgId, xmlName, fullName: fullName || '__type__' });
  const orgInventory = yield* Effect.forEach(orgComponents, component =>
    uri(component.fullName).pipe(
      Effect.map(
        document =>
          [
            componentIdentity({ xmlName, fullName: component.fullName }, component.namespacePrefix ?? null),
            {
              orgId,
              observedAt,
              provenance: 'metadata-api',
              reference: { xmlName, fullName: component.fullName },
              documentUri: document,
              name: component.fullName.split('/').at(-1) ?? component.fullName,
              kind: 'component',
              namespacePrefix: component.namespacePrefix,
              manageableState: component.manageableState,
              fileName: component.fileName,
              lastModifiedByName: component.lastModifiedByName,
              lastModifiedDate: component.lastModifiedDate,
              remoteLastModifiedDate: component.lastModifiedDate,
              inOrg: true,
              inWorkspace: false,
              ...(workspacePresenceAvailable ? {} : { workspacePresenceAvailable: false })
            } satisfies OrgMetadataCatalogInternalEntry
          ] as const
      )
    )
  ).pipe(Effect.map(HashMap.fromIterable));
  const workspaceObservedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  return yield* Effect.forEach(HashMap.toEntries(workspaceUris), ([fullName, workspaceUri]) => {
    const reference = { xmlName, fullName };
    const key = componentIdentity(reference, workspaceNamespace);
    const existing = Option.getOrUndefined(HashMap.get(orgInventory, key));
    return (existing ? Effect.succeed(existing.documentUri) : uri(fullName)).pipe(
      Effect.map(
        document =>
          [
            key,
            {
              orgId,
              observedAt: existing?.observedAt ?? workspaceObservedAt,
              provenance: existing ? 'metadata-api+workspace' : 'workspace',
              reference:
                existing && isOrgMetadataComponentReference(existing.reference) ? existing.reference : reference,
              documentUri: document,
              name: existing?.name ?? fullName.split('/').at(-1) ?? fullName,
              kind: 'component',
              namespacePrefix: existing?.namespacePrefix ?? workspaceNamespace ?? undefined,
              manageableState: existing?.manageableState,
              fileName: existing?.fileName,
              lastModifiedByName: existing?.lastModifiedByName,
              lastModifiedDate: existing?.lastModifiedDate,
              remoteLastModifiedDate: existing?.remoteLastModifiedDate,
              inOrg: existing?.inOrg ?? false,
              inWorkspace: true,
              workspaceUri
            } satisfies OrgMetadataCatalogInternalEntry
          ] as const
      )
    );
  }).pipe(
    Effect.map(HashMap.fromIterable),
    Effect.map(workspace => HashMap.union(orgInventory, workspace))
  );
});

export const projectChildren = Effect.fn('OrgCatalogProjection.projectChildren')(function* (
  orgId: OrgId,
  xmlName: string,
  parentFullName: string | undefined,
  inventory: TypeInventory
) {
  const prefix = parentFullName ? `${parentFullName}/` : '';
  const fullNames = [
    ...HashMap.toValues(inventory.components).flatMap(component =>
      isOrgMetadataComponentReference(component.reference) ? [component.reference.fullName] : []
    ),
    ...HashMap.keys(inventory.folders)
  ];
  const names = Arr.dedupe(
    fullNames.flatMap(fullName => {
      const name = fullName.startsWith(prefix) ? fullName.slice(prefix.length).split('/')[0] : undefined;
      return name ? [name] : [];
    })
  );
  return yield* Effect.forEach(
    names,
    name =>
      Effect.gen(function* () {
        const fullName = `${prefix}${name}`;
        const component = findInventoryComponent(inventory.components, { xmlName, fullName });
        const folder = Option.getOrUndefined(HashMap.get(inventory.folders, fullName));
        if (!folder && !fullNames.some(candidate => candidate.startsWith(`${fullName}/`)) && component)
          return { ...component, name };
        const descendants = HashMap.toValues(inventory.components).filter(
          entry =>
            isOrgMetadataComponentReference(entry.reference) && entry.reference.fullName.startsWith(`${fullName}/`)
        );
        const inOrg = folder !== undefined || descendants.some(entry => entry.inOrg);
        const inWorkspace = descendants.some(entry => entry.inWorkspace);
        return {
          orgId,
          observedAt: inventory.observedAt,
          provenance: inOrg ? (inWorkspace ? 'metadata-api+workspace' : 'metadata-api') : 'workspace',
          reference: { xmlName, fullName },
          documentUri: yield* documentUri({ orgId, xmlName, fullName: fullName || '__type__' }),
          name,
          kind: 'folder',
          namespacePrefix: folder?.namespacePrefix,
          manageableState: folder?.manageableState,
          lastModifiedByName: folder?.lastModifiedByName,
          lastModifiedDate: folder?.lastModifiedDate,
          remoteLastModifiedDate: folder?.lastModifiedDate,
          inOrg,
          inWorkspace,
          ...(inventory.workspacePresenceAvailable === false ? { workspacePresenceAvailable: false } : {})
        } satisfies OrgMetadataCatalogInternalEntry;
      }),
    { concurrency: 'unbounded' }
  ).pipe(Effect.map(children => children.toSorted((left, right) => left.name.localeCompare(right.name))));
});
