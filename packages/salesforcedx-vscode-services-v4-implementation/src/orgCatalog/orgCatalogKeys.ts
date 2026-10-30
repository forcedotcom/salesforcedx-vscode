/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  artifactIdentitiesEqual,
  artifactIdentityKey,
  isOrgMetadataComponentReference,
  type ArtifactNamespace,
  type MetadataComponentArtifactIdentity,
  type OrgId,
  type OrgMetadataCatalogInternalEntry,
  type OrgMetadataComponentReference
} from '@salesforce/vscode-services-v2';
import * as HashMap from 'effect/HashMap';
import * as Option from 'effect/Option';

const metadataIdentity = (
  reference: OrgMetadataComponentReference,
  namespace: ArtifactNamespace = null
): MetadataComponentArtifactIdentity => ({
  kind: 'metadata-component',
  metadataType: reference.xmlName,
  namespace,
  name: reference.fullName
});
/** Provider-neutral component identity; org partitioning is a separate key dimension. */
export const componentIdentity = (reference: OrgMetadataComponentReference, namespace: ArtifactNamespace = null) =>
  artifactIdentityKey(metadataIdentity(reference, namespace));
/** Exact namespace lookup; preserve simple-name compatibility only when namespace is omitted. */
export const findInventoryComponent = (
  components: HashMap.HashMap<string, OrgMetadataCatalogInternalEntry>,
  reference: OrgMetadataComponentReference,
  namespace?: ArtifactNamespace
) => {
  if (namespace !== undefined)
    return Option.getOrUndefined(HashMap.get(components, componentIdentity(reference, namespace)));
  const global = HashMap.get(components, componentIdentity(reference));
  if (Option.isSome(global)) return global.value;
  return [...HashMap.values(components)].find(
    entry =>
      isOrgMetadataComponentReference(entry.reference) &&
      artifactIdentitiesEqual(metadataIdentity(entry.reference), metadataIdentity(reference))
  );
};
export const referencesToAffectedSObjects = (
  references: readonly { readonly xmlName: string; readonly fullName: string }[]
): Set<string> =>
  new Set(
    references.flatMap(reference =>
      reference.xmlName === 'CustomObject'
        ? [reference.fullName]
        : reference.xmlName === 'CustomField'
          ? [reference.fullName.split('.')[0]!]
          : []
    )
  );
export const typeCacheKey = (orgId: OrgId, xmlName: string): string => `${orgId}\0${xmlName}`;
export const sobjectDescriptionKey = (orgId: OrgId, apiName: string): string => `${orgId}\0${apiName}`;
export const metadataListingKey = (orgId: OrgId, xmlName: string, folder?: string): string =>
  `${orgId}\0${xmlName}\0${folder ?? ''}`;
