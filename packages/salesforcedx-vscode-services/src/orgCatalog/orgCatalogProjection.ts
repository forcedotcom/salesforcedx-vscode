/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ListedMetadataComponent, TypeInventory } from './orgCatalogInternalTypes';
import type { OrgMetadataCatalogInternalEntry as OrgMetadataCatalogEntry } from './orgMetadataCatalogTypes';
import type { ArtifactNamespace } from '../core/artifactIdentity';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { componentIdentity, findInventoryComponent } from './orgCatalogKeys';
import { isOrgMetadataComponentReference, OrgMetadataReferenceService } from './orgMetadataReference';

export const mergeInventory = Effect.fn('mergeInventory')(function* ({
  orgId,
  xmlName,
  orgComponents,
  workspaceUris,
  workspaceNamespace = null,
  observedAt
}: {
  readonly orgId: string;
  readonly xmlName: string;
  readonly orgComponents: readonly ListedMetadataComponent[];
  readonly workspaceUris: ReadonlyMap<string, URI>;
  readonly workspaceNamespace?: ArtifactNamespace;
  readonly observedAt: string;
}) {
  const references = yield* OrgMetadataReferenceService;
  const documentUri = (fullName: string) =>
    references.documentUri({ orgId, xmlName, fullName: fullName || '__type__' });
  const orgEntries = yield* Effect.forEach(orgComponents, component =>
    documentUri(component.fullName).pipe(
      Effect.map(
        uri =>
          [
            componentIdentity({ xmlName, fullName: component.fullName }, component.namespacePrefix ?? null),
            {
              orgId,
              observedAt,
              provenance: 'metadata-api' as const,
              reference: { xmlName, fullName: component.fullName },
              documentUri: uri,
              name: component.fullName.split('/').at(-1) ?? component.fullName,
              kind: 'component',
              namespacePrefix: component.namespacePrefix,
              manageableState: component.manageableState,
              fileName: component.fileName,
              lastModifiedByName: component.lastModifiedByName,
              lastModifiedDate: component.lastModifiedDate,
              remoteLastModifiedDate: component.lastModifiedDate,
              inOrg: true,
              inWorkspace: false
            } satisfies OrgMetadataCatalogEntry
          ] as const
      )
    )
  );
  const orgInventory = new Map<string, OrgMetadataCatalogEntry>(orgEntries);
  const workspaceEntries = yield* Effect.forEach([...workspaceUris], ([fullName, workspaceUri]) => {
    const reference = { xmlName, fullName };
    const key = componentIdentity(reference, workspaceNamespace);
    const existing = orgInventory.get(key);
    const canonicalReference =
      existing && isOrgMetadataComponentReference(existing.reference) ? existing.reference : reference;
    return (existing ? Effect.succeed(existing.documentUri) : documentUri(fullName)).pipe(
      Effect.map(
        uri =>
          [
            key,
            {
              orgId,
              observedAt: existing?.observedAt ?? new Date().toISOString(),
              provenance: existing ? ('metadata-api+workspace' as const) : ('workspace' as const),
              reference: canonicalReference,
              documentUri: uri,
              name: existing?.name ?? fullName.split('/').at(-1) ?? fullName,
              kind: 'component' as const,
              namespacePrefix: existing?.namespacePrefix ?? workspaceNamespace ?? undefined,
              manageableState: existing?.manageableState,
              fileName: existing?.fileName,
              lastModifiedByName: existing?.lastModifiedByName,
              lastModifiedDate: existing?.lastModifiedDate,
              remoteLastModifiedDate: existing?.remoteLastModifiedDate,
              inOrg: existing?.inOrg ?? false,
              inWorkspace: true,
              workspaceUri
            } satisfies OrgMetadataCatalogEntry
          ] as const
      )
    );
  });
  return new Map<string, OrgMetadataCatalogEntry>([...orgInventory, ...workspaceEntries]);
});

export const projectChildren = Effect.fn('projectChildren')(function* (
  orgId: string,
  xmlName: string,
  parentFullName: string | undefined,
  inventory: TypeInventory
) {
  const references = yield* OrgMetadataReferenceService;
  const prefix = parentFullName ? `${parentFullName}/` : '';
  const childNames = new Set<string>();
  const componentFullNames = [...inventory.components.values()].flatMap(component =>
    isOrgMetadataComponentReference(component.reference) ? [component.reference.fullName] : []
  );
  [...componentFullNames, ...inventory.folders.keys()].forEach(fullName => {
    if (!fullName.startsWith(prefix)) return;
    const name = fullName.slice(prefix.length).split('/')[0];
    if (name) childNames.add(name);
  });
  return yield* Effect.forEach(
    [...childNames],
    name =>
      Effect.gen(function* () {
        const fullName = `${prefix}${name}`;
        const component = findInventoryComponent(inventory.components, { xmlName, fullName });
        const folder = inventory.folders.get(fullName);
        const hasDescendants = [...componentFullNames, ...inventory.folders.keys()].some(candidate =>
          candidate.startsWith(`${fullName}/`)
        );
        if (!folder && !hasDescendants && component) return { ...component, name };
        const descendants = [...inventory.components.values()].filter(
          entry =>
            isOrgMetadataComponentReference(entry.reference) && entry.reference.fullName.startsWith(`${fullName}/`)
        );
        return {
          orgId,
          observedAt: inventory.observedAt,
          provenance:
            folder !== undefined || descendants.some(entry => entry.inOrg)
              ? descendants.some(entry => entry.inWorkspace)
                ? ('metadata-api+workspace' as const)
                : ('metadata-api' as const)
              : ('workspace' as const),
          reference: { xmlName, fullName },
          documentUri: yield* references.documentUri({ orgId, xmlName, fullName: fullName || '__type__' }),
          name,
          kind: 'folder' as const,
          namespacePrefix: folder?.namespacePrefix,
          manageableState: folder?.manageableState,
          lastModifiedByName: folder?.lastModifiedByName,
          lastModifiedDate: folder?.lastModifiedDate,
          remoteLastModifiedDate: folder?.lastModifiedDate,
          inOrg: folder !== undefined || descendants.some(entry => entry.inOrg),
          inWorkspace: descendants.some(entry => entry.inWorkspace)
        };
      }),
    { concurrency: 'unbounded' }
  ).pipe(Effect.map(children => children.toSorted((left, right) => left.name.localeCompare(right.name))));
});
