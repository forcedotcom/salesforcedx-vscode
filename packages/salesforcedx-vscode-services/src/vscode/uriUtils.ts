/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { URI, Utils } from 'vscode-uri';

/**
 * Convert path string or URI to URI, handling both file:// and other schemes like memfs://
 * @param filePath - Either a URI object, URI string (e.g., "memfs:/MyProject/file.txt"), or a file path (e.g., "/path/to/file" or "C:\path\to\file")
 * @returns A properly parsed VS Code URI
 */
export const toUri = (filePath: string | URI): URI => {
  if (typeof filePath !== 'string') return filePath;

  if (/^[a-z][\w+.-]*:/i.test(filePath) && !/^[a-z]:/i.test(filePath)) {
    return URI.parse(filePath);
  }

  if (filePath.startsWith('\\\\')) {
    const normalizedPath = filePath.slice(2).replaceAll('\\', '/');
    return URI.file(`/${normalizedPath}`);
  }

  if (process.env.ESBUILD_PLATFORM === 'web') {
    return URI.parse(`memfs:${filePath}`);
  }

  const uri = URI.file(filePath);
  // VS Code normalizes Windows drive letters to lowercase; URI.file() preserves input casing.
  // Normalize here so URIs from file-system paths compare equal to VSCode-provided URIs.
  return /^\/[A-Z]:[/\\]/.test(uri.path)
  ? uri.with({ path: uri.path.replace(/^\/[A-Z]:/, m => m.toLowerCase()) })
  : uri;
};

/** Join baseUri with a path string (e.g. glob result). Normalizes backslashes for cross-platform. */
export const joinPathWithBase = (baseUri: URI, pathString: string): URI =>
  Utils.joinPath(baseUri, ...pathString.replaceAll('\\', '/').split('/').filter(Boolean));
