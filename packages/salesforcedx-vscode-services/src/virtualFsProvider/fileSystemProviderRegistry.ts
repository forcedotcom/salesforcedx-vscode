/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import type * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

export type RegisteredFileSystemProvider = {
  readonly provider: vscode.FileSystemProvider;
  readonly findFiles?: (
    include: vscode.GlobPattern,
    exclude?: vscode.GlobPattern | null,
    maxResults?: number
  ) => Promise<URI[]>;
};

export class FileSystemProviderRegistry extends Context.Tag('FileSystemProviderRegistry')<
  FileSystemProviderRegistry,
  {
    readonly register: (scheme: string, registration: RegisteredFileSystemProvider) => void;
    readonly get: (scheme: string) => RegisteredFileSystemProvider | undefined;
  }
>() {}

export const makeFileSystemProviderRegistry = (): Context.Tag.Service<FileSystemProviderRegistry> => {
  const registrations = new Map<string, RegisteredFileSystemProvider>();
  return {
    register: (scheme, registration) => registrations.set(scheme, registration),
    get: scheme => registrations.get(scheme)
  };
};
