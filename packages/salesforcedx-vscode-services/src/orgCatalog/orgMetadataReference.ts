/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';

export const ORG_METADATA_SCHEME = 'sf-org-metadata';

export type OrgMetadataReference = {
  readonly xmlName?: string;
  readonly fullName?: string;
};

export type OrgMetadataComponentReference = {
  readonly xmlName: string;
  readonly fullName: string;
};

export type OrgMetadataDocumentLocation = OrgMetadataComponentReference & {
  readonly orgId: string;
};

const documentExtension = (xmlName: string): string => {
  switch (xmlName) {
    case 'ApexClass':
      return '.cls';
    case 'ApexTrigger':
      return '.trigger';
    default:
      return '.xml';
  }
};

const encodedSegments = (value: string): string[] => value.split('/').map(encodeURIComponent);

export const orgMetadataDocumentUri = ({ orgId, xmlName, fullName }: OrgMetadataDocumentLocation): URI => {
  const segments = encodedSegments(fullName);
  const finalSegment = segments.at(-1);
  if (finalSegment) {
    segments[segments.length - 1] = `${finalSegment}${documentExtension(xmlName)}`;
  }
  return URI.from({
    scheme: ORG_METADATA_SCHEME,
    path: `/orgs/${encodeURIComponent(orgId)}/${encodeURIComponent(xmlName)}/${segments.join('/')}`
  });
};

export const parseOrgMetadataDocumentUri = (uri: URI): OrgMetadataDocumentLocation | undefined => {
  if (uri.scheme !== ORG_METADATA_SCHEME) return undefined;
  const [, root, encodedOrgId, encodedXmlName, ...encodedFullName] = uri.path.split('/');
  if (root !== 'orgs' || !encodedOrgId || !encodedXmlName || encodedFullName.length === 0) return undefined;
  const xmlName = decodeURIComponent(encodedXmlName);
  const extension = documentExtension(xmlName);
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

export const isOrgMetadataComponentReference = (
  reference: OrgMetadataReference
): reference is OrgMetadataComponentReference =>
  typeof reference.xmlName === 'string' &&
  reference.xmlName.length > 0 &&
  typeof reference.fullName === 'string' &&
  reference.fullName.length > 0;
