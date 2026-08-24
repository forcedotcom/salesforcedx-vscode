/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgMetadataCatalogInternalEntry, OrgMetadataPresence } from './orgMetadataCatalogTypes';
import {
  artifactIdentitiesEqual,
  artifactIdentityKey,
  type ArtifactNamespace,
  type MetadataComponentArtifactIdentity
} from '../core/artifactIdentity';
import { isOrgMetadataComponentReference, type OrgMetadataComponentReference } from './orgMetadataReference';

export const emptyPresence = (): OrgMetadataPresence => ({ inOrg: false, inWorkspace: false });

const metadataComponentArtifactIdentity = (
  reference: OrgMetadataComponentReference,
  namespace: ArtifactNamespace = null
): MetadataComponentArtifactIdentity => ({
  kind: 'metadata-component',
  metadataType: reference.xmlName,
  namespace,
  name: reference.fullName
});

/** Identity key for a metadata component reference, independent of the org it was observed in. */
export const componentIdentity = (
  reference: OrgMetadataComponentReference,
  namespace: ArtifactNamespace = null
): string => artifactIdentityKey(metadataComponentArtifactIdentity(reference, namespace));

/**
 * Exact namespace lookup for new callers, with a simple-name compatibility fallback only when namespace is omitted.
 * The fallback preserves existing catalog APIs until their request references carry required-null namespace identity.
 */
export const findInventoryComponent = (
  components: ReadonlyMap<string, OrgMetadataCatalogInternalEntry>,
  reference: OrgMetadataComponentReference,
  namespace?: ArtifactNamespace
): OrgMetadataCatalogInternalEntry | undefined => {
  if (namespace !== undefined) return components.get(componentIdentity(reference, namespace));
  const globalMatch = components.get(componentIdentity(reference));
  if (globalMatch) return globalMatch;
  return [...components.values()].find(
    entry =>
      isOrgMetadataComponentReference(entry.reference) &&
      artifactIdentitiesEqual(
        metadataComponentArtifactIdentity(entry.reference),
        metadataComponentArtifactIdentity(reference)
      )
  );
};

/**
 * Derives the set of SObject api names whose describe caches are affected by a
 * set of metadata references: a CustomObject affects itself, a CustomField
 * affects its parent object (the segment before the first `.`).
 */
export const referencesToAffectedSObjects = (
  references: readonly { readonly xmlName: string; readonly fullName: string }[]
): Set<string> =>
  new Set(
    references.flatMap(reference =>
      reference.xmlName === 'CustomObject'
        ? [reference.fullName]
        : reference.xmlName === 'CustomField'
          ? [reference.fullName.split('.')[0]]
          : []
    )
  );
export const typeCacheKey = (orgId: string, xmlName: string): string => `${orgId}\0${xmlName}`;
export const sobjectDescriptionKey = (orgId: string, apiName: string): string => `${orgId}\0${apiName}`;

export const metadataListingKey = (orgId: string, xmlName: string, folder?: string): string =>
  `${orgId}\0${xmlName}\0${folder ?? ''}`;
