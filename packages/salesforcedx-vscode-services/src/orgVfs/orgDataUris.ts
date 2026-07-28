/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';

export const ORG_DATA_SCHEME = 'sf-org-data';
const ORGS_ROOT = 'orgs';

export type OrgDataOwner = 'metadata-preview' | 'org-metadata';

const sanitizeOrgKey = (orgKey: string): string => encodeURIComponent(orgKey.trim().toLowerCase());
const sanitizePathPart = (part: string): string => encodeURIComponent(part.trim());

export const orgRoot = (orgKey: string): URI =>
  URI.from({ scheme: ORG_DATA_SCHEME, path: `/${ORGS_ROOT}/${sanitizeOrgKey(orgKey)}` });

export const orgDataOwnerRoot = ({ orgKey, owner }: { orgKey: string; owner: OrgDataOwner }): URI =>
  Utils.joinPath(orgRoot(orgKey), owner);

export const orgDataUri = ({
  orgKey,
  owner,
  segments
}: {
  orgKey: string;
  owner: OrgDataOwner;
  segments: readonly string[];
}): URI => Utils.joinPath(orgDataOwnerRoot({ orgKey, owner }), ...segments.map(sanitizePathPart));

export const orgDataSegments = (uri: URI, owner: OrgDataOwner): readonly string[] | undefined => {
  if (uri.scheme !== ORG_DATA_SCHEME) return undefined;
  const [, orgs, orgKey, actualOwner, ...segments] = uri.path.split('/');
  return orgs === ORGS_ROOT && orgKey && actualOwner === owner ? segments : undefined;
};

export const orgDataOwner = (uri: URI): OrgDataOwner | undefined => {
  if (uri.scheme !== ORG_DATA_SCHEME) return undefined;
  const [, orgs, orgKey, owner] = uri.path.split('/');
  return orgs === ORGS_ROOT && orgKey && (owner === 'metadata-preview' || owner === 'org-metadata') ? owner : undefined;
};

export const orgDataDocumentSelector = ({
  owner,
  language
}: {
  owner: OrgDataOwner;
  language: string;
}): vscode.DocumentFilter => ({
  scheme: ORG_DATA_SCHEME,
  language,
  pattern: `/${ORGS_ROOT}/*/${owner}/**`
});
