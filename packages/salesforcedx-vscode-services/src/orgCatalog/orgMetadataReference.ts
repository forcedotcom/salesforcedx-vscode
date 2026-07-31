/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { URI } from 'vscode-uri';

export const ORG_METADATA_SCHEME = 'sf-org-metadata';

const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

export const OrgMetadataReference = Schema.Struct({
  xmlName: Schema.optional(Schema.String),
  fullName: Schema.optional(Schema.String)
});
export type OrgMetadataReference = typeof OrgMetadataReference.Type;

export const OrgMetadataComponentReference = Schema.Struct({
  xmlName: NonEmptyString,
  fullName: NonEmptyString
});
export type OrgMetadataComponentReference = typeof OrgMetadataComponentReference.Type;

export const OrgMetadataDocumentLocation = Schema.Struct({
  ...OrgMetadataComponentReference.fields,
  orgId: NonEmptyString
});
export type OrgMetadataDocumentLocation = typeof OrgMetadataDocumentLocation.Type;

const documentExtension = (registryAccess: RegistryAccess, xmlName: string): string => {
  // Metadata API describe can return types that are not present in the
  // installed SDR registry. They must remain navigable in catalog inventory.
  const metadataType = Option.getOrUndefined(Option.liftThrowable(() => registryAccess.getTypeByName(xmlName))());
  return `.${metadataType?.suffix ?? 'xml'}`;
};

const encodedSegments = (value: string): string[] => value.split('/').map(encodeURIComponent);

export const orgMetadataDocumentUri = (
  registryAccess: RegistryAccess,
  { orgId, xmlName, fullName }: OrgMetadataDocumentLocation
): URI => {
  const segments = encodedSegments(fullName);
  const finalSegment = segments.at(-1);
  if (finalSegment) {
    segments[segments.length - 1] = `${finalSegment}${documentExtension(registryAccess, xmlName)}`;
  }
  return URI.from({
    scheme: ORG_METADATA_SCHEME,
    path: `/orgs/${encodeURIComponent(orgId)}/${encodeURIComponent(xmlName)}/${segments.join('/')}`
  });
};

export const parseOrgMetadataDocumentUri = (
  registryAccess: RegistryAccess,
  uri: URI
): OrgMetadataDocumentLocation | undefined => {
  if (uri.scheme !== ORG_METADATA_SCHEME) return undefined;
  const [, root, encodedOrgId, encodedXmlName, ...encodedFullName] = uri.path.split('/');
  if (root !== 'orgs' || !encodedOrgId || !encodedXmlName || encodedFullName.length === 0) return undefined;
  const xmlName = decodeURIComponent(encodedXmlName);
  const extension = documentExtension(registryAccess, xmlName);
  const finalSegment = encodedFullName.at(-1);
  if (!finalSegment?.endsWith(extension)) return undefined;
  const fullNameSegments = [...encodedFullName];
  fullNameSegments[fullNameSegments.length - 1] = finalSegment.slice(0, -extension.length);
  return {
    orgId: decodeURIComponent(encodedOrgId),
    xmlName,
    fullName: fullNameSegments.map(decodeURIComponent).join('/')
  };
};

export const isOrgMetadataComponentReference = Schema.is(OrgMetadataComponentReference);
