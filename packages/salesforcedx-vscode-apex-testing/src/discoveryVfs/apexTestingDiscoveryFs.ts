/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * URIs for the in-memory `apex-testing:` provider. This tree models discovered Apex class `.cls` paths per org;
 * metadata XML (e.g. `-meta.xml` in a source-formatted project) is not necessarily represented here.
 */

import { URI, Utils } from 'vscode-uri';

export const APEX_TESTING_SCHEME = 'apex-testing';
const ORGS_ROOT = 'orgs';
const CLASSES_ROOT = 'classes';
const CLASS_FILE_EXT = '.cls';

const sanitizeOrgKey = (orgKey: string): string => encodeURIComponent(orgKey.trim().toLowerCase());
const sanitizePathPart = (part: string): string => encodeURIComponent(part.trim());

export const getOrgsRootUri = (): URI => URI.from({ scheme: APEX_TESTING_SCHEME, path: `/${ORGS_ROOT}` });

export const getOrgDiscoveryUri = (orgKey: string): URI => Utils.joinPath(getOrgsRootUri(), sanitizeOrgKey(orgKey));

export const getOrgClassesDirUri = (orgKey: string): URI => Utils.joinPath(getOrgDiscoveryUri(orgKey), CLASSES_ROOT);

export const getApexTestingClassUri = (orgKey: string, fullClassName: string): URI => {
  const parts = fullClassName.split('.').map(sanitizePathPart);
  const classFile = `${parts.pop() ?? 'Unknown'}${CLASS_FILE_EXT}`;
  return Utils.joinPath(getOrgClassesDirUri(orgKey), ...parts, classFile);
};

/**
 * Given the org-root directory entry names (each is a sanitized orgKey) and the current orgKey,
 * the `classes/` dir URIs for every OTHER org. Used to prune stale per-org discovered classes when
 * the default org changes, without touching the current org or anything outside `classes/`.
 */
export const getForeignOrgClassesDirUris = (currentOrgKey: string, orgDirNames: readonly string[]): URI[] => {
  const currentDirName = sanitizeOrgKey(currentOrgKey);
  return orgDirNames
    .filter(name => name !== currentDirName)
    .map(name => Utils.joinPath(getOrgsRootUri(), name, CLASSES_ROOT));
};

/**
 * True when `uri` is an `apex-testing:` class URI that belongs to an org OTHER than `currentOrgKey`.
 * On a default-org change, the consumer passes the new orgId so the previous org's stale tabs match.
 * On logout there is no current org (`undefined`), so every `apex-testing:` org tab is foreign.
 */
export const isForeignOrgClassUri = (uri: URI, currentOrgKey: string | undefined): boolean => {
  if (uri.scheme !== APEX_TESTING_SCHEME) {
    return false;
  }
  const [root, orgDirName] = uri.path.split('/').filter(Boolean);
  if (root !== ORGS_ROOT || orgDirName === undefined) {
    return false;
  }
  return currentOrgKey === undefined || orgDirName !== sanitizeOrgKey(currentOrgKey);
};
