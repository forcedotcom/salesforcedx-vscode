/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { URI } from 'vscode-uri';
import { comparisonPath, isWindowsFileDrivePath } from './uriComparison';

const comparableUriPath = (uri: URI): string => comparisonPath(uri).replace(/\/$/u, '');

export const uriPathIncludesSegments = (uri: URI, segments: readonly string[]): boolean => {
  const segmentPath = segments.join('/');
  const needle = isWindowsFileDrivePath(uri) ? segmentPath.toLowerCase() : segmentPath;
  return comparableUriPath(uri).includes(`/${needle}/`);
};

/** URI containment. Windows file-drive paths compare case-insensitively; trailing slashes are ignored. */
export const isUriEqualOrWithin = (root: URI, candidate: URI): boolean => {
  if (root.scheme.toLowerCase() !== candidate.scheme.toLowerCase()) return false;
  if (root.authority.toLowerCase() !== candidate.authority.toLowerCase()) return false;
  const rootPath = comparableUriPath(root);
  const candidatePath = comparableUriPath(candidate);
  return candidatePath === rootPath || candidatePath.startsWith(`${rootPath}/`);
};
