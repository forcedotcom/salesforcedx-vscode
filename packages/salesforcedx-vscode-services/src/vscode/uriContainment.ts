/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { URI } from 'vscode-uri';

const WINDOWS_DRIVE_PATH = /^\/[a-z]:\//iu;

const comparableUriPath = (uri: URI): string => {
  const path = uri.path.replace(/\/$/u, '');
  return WINDOWS_DRIVE_PATH.test(path) ? path.toLowerCase() : path;
};

export const uriPathIncludesSegments = (uri: URI, segments: readonly string[]): boolean => {
  const windowsPath = WINDOWS_DRIVE_PATH.test(uri.path);
  const segmentPath = segments.join('/');
  return comparableUriPath(uri).includes(`/${windowsPath ? segmentPath.toLowerCase() : segmentPath}/`);
};

/** URI containment with Windows file-path casing semantics. */
export const isUriEqualOrWithin = (root: URI, candidate: URI): boolean => {
  if (root.scheme.toLowerCase() !== candidate.scheme.toLowerCase()) return false;
  if (root.authority.toLowerCase() !== candidate.authority.toLowerCase()) return false;
  const rootPath = comparableUriPath(root);
  const candidatePath = comparableUriPath(candidate);
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}/`);
};
