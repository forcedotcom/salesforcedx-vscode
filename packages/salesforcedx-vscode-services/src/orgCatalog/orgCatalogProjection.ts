/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ListedMetadataComponent, TypeInventory } from './orgCatalogInternalTypes';
import type { OrgMetadataCatalogEntry } from './orgMetadataCatalogTypes';
import { URI } from 'vscode-uri';
import { isOrgMetadataComponentReference } from './orgMetadataReference';

export const mergeInventory = ({
  entryUri,
  orgId,
  xmlName,
  orgComponents,
  workspaceUris,
  observedAt
}: {
  readonly entryUri: (orgId: string, xmlName: string, fullName: string) => URI;
  readonly orgId: string;
  readonly xmlName: string;
  readonly orgComponents: readonly ListedMetadataComponent[];
  readonly workspaceUris: ReadonlyMap<string, URI>;
  readonly observedAt: string;
}): ReadonlyMap<string, OrgMetadataCatalogEntry> => {
  const orgInventory = orgComponents.reduce(
    (entries, component) =>
      entries.set(component.fullName, {
        orgId,
        observedAt,
        provenance: 'metadata-api',
        reference: { xmlName, fullName: component.fullName },
        documentUri: entryUri(orgId, xmlName, component.fullName),
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
      }),
    new Map<string, OrgMetadataCatalogEntry>()
  );
  return [...workspaceUris].reduce((entries, [fullName, workspaceUri]) => {
    const existing = entries.get(fullName);
    return entries.set(fullName, {
      orgId,
      observedAt: existing?.observedAt ?? new Date().toISOString(),
      provenance: existing ? 'metadata-api+workspace' : 'workspace',
      reference: { xmlName, fullName },
      documentUri: existing?.documentUri ?? entryUri(orgId, xmlName, fullName),
      name: existing?.name ?? fullName.split('/').at(-1) ?? fullName,
      kind: 'component',
      namespacePrefix: existing?.namespacePrefix,
      manageableState: existing?.manageableState,
      fileName: existing?.fileName,
      lastModifiedByName: existing?.lastModifiedByName,
      lastModifiedDate: existing?.lastModifiedDate,
      remoteLastModifiedDate: existing?.remoteLastModifiedDate,
      inOrg: existing?.inOrg ?? false,
      inWorkspace: true,
      workspaceUri
    });
  }, orgInventory);
};

export const projectChildren = (
  entryUri: (orgId: string, xmlName: string, fullName: string) => URI,
  orgId: string,
  xmlName: string,
  parentFullName: string | undefined,
  inventory: TypeInventory
): OrgMetadataCatalogEntry[] => {
  const prefix = parentFullName ? `${parentFullName}/` : '';
  const childNames = new Set<string>();
  [...inventory.components.keys(), ...inventory.folders.keys()].forEach(fullName => {
    if (!fullName.startsWith(prefix)) return;
    const name = fullName.slice(prefix.length).split('/')[0];
    if (name) childNames.add(name);
  });
  return [...childNames]
    .map(name => {
      const fullName = `${prefix}${name}`;
      const component = inventory.components.get(fullName);
      const folder = inventory.folders.get(fullName);
      const hasDescendants = [...inventory.components.keys(), ...inventory.folders.keys()].some(candidate =>
        candidate.startsWith(`${fullName}/`)
      );
      if (!folder && !hasDescendants && component) return { ...component, name };
      const descendants = [...inventory.components.values()].filter(
        entry => isOrgMetadataComponentReference(entry.reference) && entry.reference.fullName.startsWith(`${fullName}/`)
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
        documentUri: entryUri(orgId, xmlName, fullName),
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
    })
    .toSorted((left, right) => left.name.localeCompare(right.name));
};
