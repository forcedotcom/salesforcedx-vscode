/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { URI } from 'vscode-uri';

const WINDOWS_DRIVE_PATH = /^\/[a-z]:/i;

/** File URI whose path is a Windows drive (`/C:` or `/C:/...`). */
export const isWindowsFileDrivePath = (uri: Pick<URI, 'scheme' | 'path'>): boolean =>
  uri.scheme === 'file' && WINDOWS_DRIVE_PATH.test(uri.path);

/** Lowercases the whole path only for Windows file-drive URIs. */
export const comparisonPath = (uri: Pick<URI, 'scheme' | 'path'>): string =>
  isWindowsFileDrivePath(uri) ? uri.path.toLowerCase() : uri.path;

/** Suffix of `child` under `root`, compared with `comparisonPath`. Keeps `child` segment casing. */
export const pathSuffixWithin = (
  root: Pick<URI, 'scheme' | 'path'>,
  child: Pick<URI, 'scheme' | 'path'>
): string | undefined => {
  const rootPath = comparisonPath(root);
  const prefix = rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
  return comparisonPath(child).startsWith(prefix) ? child.path.slice(prefix.length) : undefined;
};
