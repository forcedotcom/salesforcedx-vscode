/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isString } from 'effect/Predicate';
import { URI } from 'vscode-uri';

/** Preserve URI schemes, UNC paths and Windows drive normalization used by FsService. */
export const toUri = (filePath: string | URI): URI => {
  if (!isString(filePath)) return filePath;
  if (/^[a-z][\w+.-]*:/i.test(filePath) && !/^[a-z]:/i.test(filePath)) return URI.parse(filePath);
  if (filePath.startsWith('\\\\')) return URI.file(`/${filePath.slice(2).replaceAll('\\', '/')}`);
  if (process.env.ESBUILD_PLATFORM === 'web') return URI.parse(`memfs:${filePath}`);
  const uri = URI.file(filePath);
  return /^\/[A-Z]:[/\\]/.test(uri.path)
    ? uri.with({ path: uri.path.replace(/^\/[A-Z]:/, match => match.toLowerCase()) })
    : uri;
};
export const uriToPath = (uri: URI): string => (uri.scheme === 'file' ? uri.fsPath : uri.path);
export const uriOrString = (value: URI | string): string => (isString(value) ? value : value.toString());
