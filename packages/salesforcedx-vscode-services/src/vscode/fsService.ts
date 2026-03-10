/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as S from 'effect/Schema';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { unknownToErrorCause } from '../core/shared';
import { fsProviderRef } from '../virtualFsProvider/fsProviderRef';
import { HashableUri } from './hashableUri';
import { uriToPath } from './paths';
import { toUri } from './uriUtils';

export { toUri } from './uriUtils';

export class FsServiceError extends Data.TaggedError('FsServiceError')<{
  readonly cause: Error;
  readonly function: string;
  readonly filePath: string;
}> {}

// capture readFile for use in readJSON
const readFile = Effect.fn('fsService.readFile')(function* (filePath: string | URI) {
  return yield* Effect.tryPromise({
    try: async () => Buffer.from(await vscode.workspace.fs.readFile(toUri(filePath))).toString('utf8'),
    catch: e =>
      new FsServiceError({
        ...unknownToErrorCause(e),
        function: 'readFile',
        filePath: UriOrStringToString(filePath)
      })
  });
});

const writeFile = Effect.fn('fsService.writeFile')(function* (filePath: string | URI, content: string) {
  return yield* Effect.tryPromise({
    try: async () => {
      const uri = toUri(filePath);
      await vscode.workspace.fs.createDirectory(Utils.dirname(uri));
      const uint8Array = new TextEncoder().encode(content);
      await vscode.workspace.fs.writeFile(uri, uint8Array);
    },
    catch: e =>
      new FsServiceError({
        ...unknownToErrorCause(e),
        function: 'writeFile',
        filePath: typeof filePath === 'string' ? filePath : filePath.toString()
      })
  });
});

const fileOrFolderExists = Effect.fn('fsService.fileOrFolderExists')(function* (filePath: string | URI) {
  const uri = toUri(filePath);

  return yield* Effect.tryPromise({
    try: async () => {
      await vscode.workspace.fs.stat(uri);
      return true;
    },
    catch: e =>
      new FsServiceError({
        ...unknownToErrorCause(e),
        function: 'fileOrFolderExists',
        filePath: typeof filePath === 'string' ? filePath : filePath.toString()
      })
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));
});

const showTextDocument = Effect.fn('fsService.showTextDocument')(function* (
  filePath: string | URI,
  options?: vscode.TextDocumentShowOptions
) {
  const uri = toUri(filePath);
  return yield* Effect.tryPromise({
    try: () => vscode.window.showTextDocument(vscode.Uri.parse(uri.toString()), options),
    catch: e =>
      new FsServiceError({
        ...unknownToErrorCause(e),
        function: 'showTextDocument',
        filePath: typeof filePath === 'string' ? filePath : filePath.toString()
      })
  });
});

export class FsService extends Effect.Service<FsService>()('FsService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    return {
      readFile,
      toUri: (filePath: string | URI) => Effect.succeed(toUri(filePath)),
      HashableUri,
      uriToPath: (uri: URI) => Effect.succeed(uriToPath(uri)),
      /** Find files by glob. baseUri optional via RelativePattern; defaults to workspace folders. */
      findFiles: (
        include: vscode.GlobPattern,
        exclude?: vscode.GlobPattern | null,
        maxResults?: number,
        token?: vscode.CancellationToken
      ) =>
        Effect.tryPromise({
          try: () =>
            process.env.ESBUILD_PLATFORM === 'web'
              ? (fsProviderRef.current?.findFiles(include, exclude ?? undefined, maxResults) ?? Promise.resolve([]))
              : vscode.workspace.findFiles(include, exclude ?? undefined, maxResults, token),
          catch: e =>
            new FsServiceError({
              ...unknownToErrorCause(e),
              function: 'findFiles',
              filePath: typeof include === 'string' ? include : include.pattern
            })
        }),
      /** Write file to filesystem, creating directories if they don't exist */
      writeFile,
      fileOrFolderExists,
      /** Open the file at the given path in an editor tab. Options passed to vscode.window.showTextDocument (e.g. preview, viewColumn). */
      showTextDocument,
      isDirectory: (path: string | URI) =>
        Effect.tryPromise(
          async () => (await vscode.workspace.fs.stat(toUri(path))).type === vscode.FileType.Directory
        ).pipe(Effect.catchAll(() => Effect.succeed(false))),
      isFile: (path: string | URI) =>
        Effect.tryPromise(async () => (await vscode.workspace.fs.stat(toUri(path))).type === vscode.FileType.File).pipe(
          Effect.catchAll(() => Effect.succeed(false))
        ),
      /** create a directory.  Creates any parent directories necessary.  Safe if directory already exists. */
      createDirectory: (dirPath: string | URI) =>
        Effect.tryPromise({
          try: async () => {
            await vscode.workspace.fs.createDirectory(toUri(dirPath));
          },
          catch: e =>
            new FsServiceError({
              ...unknownToErrorCause(e),
              function: 'createDirectory',
              filePath: UriOrStringToString(dirPath)
            })
        }),
      deleteFile: (filePath: string, options = {}) =>
        Effect.tryPromise({
          try: async () => {
            await vscode.workspace.fs.delete(toUri(filePath), options);
          },
          catch: e => new FsServiceError({ ...unknownToErrorCause(e), function: 'deleteFile', filePath })
        }),
      readDirectory: (dirPath: string | URI) =>
        Effect.gen(function* () {
          const uri = toUri(dirPath);
          const entries = yield* Effect.tryPromise({
            try: async () => await vscode.workspace.fs.readDirectory(uri),
            catch: e =>
              new FsServiceError({
                ...unknownToErrorCause(e),
                function: 'readDirectory',
                filePath: typeof dirPath === 'string' ? dirPath : uriToPath(dirPath)
              })
          });
          return entries.map(([name]) => Utils.joinPath(uri, name));
        }),
      stat: (filePath: string) =>
        Effect.tryPromise({
          try: async () => await vscode.workspace.fs.stat(toUri(filePath)),
          catch: e => new FsServiceError({ ...unknownToErrorCause(e), function: 'stat', filePath })
        }),
      safeDelete: (filePath: string | URI, options = {}) =>
        Effect.tryPromise({
          try: async () => {
            await vscode.workspace.fs.delete(toUri(filePath), options);
          },
          catch: e =>
            new FsServiceError({
              ...unknownToErrorCause(e),
              function: 'safeDelete',
              filePath: typeof filePath === 'string' ? filePath : filePath.toString()
            })
        }).pipe(Effect.catchAll(() => Effect.succeed(undefined))),
      rename: (oldPath: string, newPath: string) =>
        Effect.tryPromise({
          try: async () => {
            await vscode.workspace.fs.rename(toUri(oldPath), toUri(newPath));
          },
          catch: e => new FsServiceError({ ...unknownToErrorCause(e), function: 'rename', filePath: oldPath })
        }),
      readJSON: <A>(filePath: string, schema: S.Schema<A>) =>
        readFile(filePath).pipe(
          Effect.flatMap(text =>
            Effect.try({
              try: () => JSON.parse(text),
              catch: (e: unknown) => new FsServiceError({ ...unknownToErrorCause(e), function: 'readJSON', filePath })
            })
          ),
          Effect.flatMap((obj: unknown) =>
            S.decodeUnknown(schema)(obj).pipe(
              Effect.mapError(
                (e: unknown) => new FsServiceError({ ...unknownToErrorCause(e), function: 'readJSON', filePath })
              )
            )
          )
        )
    };
  })
}) {}
const UriOrStringToString = (uri: URI | string) => (typeof uri === 'string' ? uri : uri.toString());
