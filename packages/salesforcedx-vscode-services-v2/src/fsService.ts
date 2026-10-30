/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FsServiceError } from './errors.js';
import type { HashableUri } from './hashableUri.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as Schema from 'effect/Schema';
import type * as vscode from 'vscode';
import type { URI } from 'vscode-uri';

export type FsProvider = vscode.FileSystemProvider & {
  readonly findFiles: (
    include: vscode.GlobPattern,
    exclude?: vscode.GlobPattern | null,
    maxResults?: number,
    token?: vscode.CancellationToken
  ) => Promise<URI[]>;
  readonly exists: (uri: URI) => boolean;
};

export class FsService extends Context.Service<
  FsService,
  {
    readonly readFile: (filePath: string | URI) => Effect.Effect<string, FsServiceError>;
    readonly toUri: (filePath: string | URI) => Effect.Effect<URI>;
    readonly HashableUri: typeof HashableUri;
    readonly uriToPath: (uri: URI) => Effect.Effect<string>;
    readonly findFiles: (
      include: vscode.GlobPattern,
      exclude?: vscode.GlobPattern | null,
      maxResults?: number,
      token?: vscode.CancellationToken
    ) => Effect.Effect<URI[], FsServiceError>;
    readonly safeWriteFile: (filePath: string | URI, content: string) => Effect.Effect<void, FsServiceError>;
    readonly writeFile: (filePath: string | URI, content: string) => Effect.Effect<void, FsServiceError>;
    readonly fileOrFolderExists: (filePath: string | URI) => Effect.Effect<boolean>;
    readonly showTextDocument: (
      filePath: string | URI,
      options?: vscode.TextDocumentShowOptions
    ) => Effect.Effect<vscode.TextEditor, FsServiceError>;
    readonly isDirectory: (filePath: string | URI) => Effect.Effect<boolean>;
    readonly isFile: (filePath: string | URI) => Effect.Effect<boolean>;
    readonly createDirectory: (dirPath: string | URI) => Effect.Effect<void, FsServiceError>;
    readonly deleteFile: (
      filePath: string,
      options?: { readonly recursive?: boolean; readonly useTrash?: boolean }
    ) => Effect.Effect<void, FsServiceError>;
    readonly readDirectory: (dirPath: string | URI) => Effect.Effect<URI[], FsServiceError>;
    readonly readDirectoryWithTypes: (
      dirPath: string | URI
    ) => Effect.Effect<{ readonly uri: URI; readonly type: vscode.FileType }[], FsServiceError>;
    readonly stat: (filePath: string | URI) => Effect.Effect<vscode.FileStat, FsServiceError>;
    readonly safeDelete: (
      filePath: string | URI,
      options?: { readonly recursive?: boolean; readonly useTrash?: boolean }
    ) => Effect.Effect<void>;
    readonly rename: (
      oldPath: string,
      newPath: string,
      options?: { readonly overwrite?: boolean }
    ) => Effect.Effect<void, FsServiceError>;
    readonly readJSON: <A>(filePath: string, schema: Schema.Codec<A>) => Effect.Effect<A, FsServiceError>;
  }
>()('@salesforce/vscode-services-v2/FsService') {}
