/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI } from 'vscode-uri';
import { orgDataSegments, orgDataUri } from './orgDataUris';

const ORG_METADATA_OWNER = 'org-metadata';
const decodeSegment = (segment: string): string => decodeURIComponent(segment);

export type OrgMetadataLocation = {
  readonly orgKey: string;
  readonly xmlName?: string;
  readonly componentSegments: readonly string[];
};

export const getOrgMetadataLocation = (uri: URI): OrgMetadataLocation | undefined => {
  const segments = orgDataSegments(uri, ORG_METADATA_OWNER);
  if (!segments) return undefined;
  const [, , orgKey] = uri.path.split('/');
  return {
    orgKey,
    xmlName: segments[0] ? decodeSegment(segments[0]) : undefined,
    componentSegments: segments.slice(1).map(decodeSegment)
  };
};

export const orgMetadataUri = ({
  orgKey,
  xmlName,
  fullName
}: {
  readonly orgKey: string;
  readonly xmlName: string;
  readonly fullName: string;
}): URI =>
  orgDataUri({
    orgKey,
    owner: ORG_METADATA_OWNER,
    segments: [xmlName, ...fullName.split('/')]
  });
