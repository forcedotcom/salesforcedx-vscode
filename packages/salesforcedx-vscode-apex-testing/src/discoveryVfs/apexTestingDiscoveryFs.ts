/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI, Utils } from 'vscode-uri';

export const APEX_TESTING_SCHEME = 'apex-testing';
const ORGS_ROOT = 'orgs';
const CLASSES_ROOT = 'classes';
const INDEX_FILE = 'index.json';
const CLASS_FILE_EXT = '.cls';

const sanitizeOrgKey = (orgKey: string): string => encodeURIComponent(orgKey.trim().toLowerCase());
const sanitizePathPart = (part: string): string => encodeURIComponent(part.trim());

const getOrgsRootUri = (): URI => URI.from({ scheme: APEX_TESTING_SCHEME, path: `/${ORGS_ROOT}` });

export const getOrgDiscoveryUri = (orgKey: string): URI => Utils.joinPath(getOrgsRootUri(), sanitizeOrgKey(orgKey));

export const getOrgClassesDirUri = (orgKey: string): URI => Utils.joinPath(getOrgDiscoveryUri(orgKey), CLASSES_ROOT);

export const getOrgIndexUri = (orgKey: string): URI => Utils.joinPath(getOrgDiscoveryUri(orgKey), INDEX_FILE);

export const getApexTestingClassUri = (orgKey: string, fullClassName: string): URI => {
  const parts = fullClassName.split('.').map(sanitizePathPart);
  const classFile = `${parts.pop() ?? 'Unknown'}${CLASS_FILE_EXT}`;
  return Utils.joinPath(getOrgClassesDirUri(orgKey), ...parts, classFile);
};
