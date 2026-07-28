/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isString } from 'effect/Predicate';
import * as S from 'effect/Schema';
import { minimatch } from 'minimatch';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { unknownToErrorCause } from '../core/shared';
import { OrgDataFsProvider } from '../orgVfs/orgDataFsProvider';
import { ORG_DATA_SCHEME, orgDataOwnerRoot, orgRoot, type OrgDataOwner } from '../orgVfs/orgDataUris';
import { FileSystemProviderRegistry } from '../virtualFsProvider/fileSystemProviderRegistry';
import { HashableUri } from './hashableUri';
import { uriToPath } from './paths';
import { toUri } from './uriUtils';

export class FsServiceError extends Data.TaggedError('FsServiceError')<{
  readonly cause: Error;
  readonly message: string;
  readonly function: string;
  readonly filePath: string;
}> {}

/**
 * Convert path string or URI to URI, handling both file:// and other schemes like memfs://
 * @param filePath - Either a URI object, URI string (e.g., "memfs:/dx-project/file.txt"), or a file path (e.g., "/path/to/file" or "C:\path\to\file")
 * @returns A properly parsed VS Code URI
 */
const encoder = new TextEncoder();

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

/**
 * Writes content to a file, creating the parent directory if it does not exist.
 * Use `writeFile` instead when the directory is guaranteed to exist (e.g. bulk writes
 * where directories are pre-created once) to avoid per-call `createDirectory` overhead.
 */
const safeWriteFile = Effect.fn('fsService.safeWriteFile')(function* (filePath: string | URI, content: string) {
  return yield* Effect.tryPromise({
    try: async () => {
      const uri = toUri(filePath);
      await vscode.workspace.fs.createDirectory(Utils.dirname(uri));
      await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
    },
    catch: e =>
      new FsServiceError({
        ...unknownToErrorCause(e),
        function: 'safeWriteFile',
        filePath: isString(filePath) ? filePath : filePath.toString()
      })
  });
});

/**
 * Writes content to a file. The parent directory must already exist.
 * Call `createDirectory` or `safeWriteFile` first if the directory may not exist.
 */
const writeFile = Effect.fn('fsService.writeFile')(function* (filePath: string | URI, content: string) {
  return yield* Effect.tryPromise({
    try: async () => {
      const uri = toUri(filePath);
      const uint8Array = encoder.encode(content);
      await vscode.workspace.fs.writeFile(uri, uint8Array);
    },
    catch: e =>
      new FsServiceError({
        ...unknownToErrorCause(e),
        function: 'writeFile',
        filePath: isString(filePath) ? filePath : filePath.toString()
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
        filePath: isString(filePath) ? filePath : filePath.toString()
      })
  }).pipe(Effect.catchAll(() => Effect.succeed(false)));
});

const showTextDocument = Effect.fn('fsService.showTextDocument')(function* (
  filePath: string | URI,
  options?: vscode.TextDocumentShowOptions
) {
  const uri = toUri(filePath);
  return yield* Effect.tryPromise({
    try: () => vscode.window.showTextDocument(uri, options),
    catch: e =>
      new FsServiceError({
        ...unknownToErrorCause(e),
        function: 'showTextDocument',
        filePath: isString(filePath) ? filePath : filePath.toString()
      })
  });
});

const fsError = (functionName: string, filePath: string, error: unknown) =>
  new FsServiceError({
    ...unknownToErrorCause(error),
    function: functionName,
    filePath
  });

const resolveFindFilesBase = (include: vscode.GlobPattern): URI | undefined =>
  (typeof include === 'object' && 'baseUri' in include ? include.baseUri : undefined) ??
  vscode.workspace.workspaceFolders?.[0]?.uri;

const walkFiles = async (
  baseUri: URI,
  include: vscode.GlobPattern,
  exclude: vscode.GlobPattern | null | undefined,
  maxResults: number | undefined,
  token: vscode.CancellationToken | undefined
): Promise<URI[]> => {
  const includePattern = isString(include) ? include : include.pattern;
  const excludePattern = isString(exclude) ? exclude : exclude?.pattern;
  const results: URI[] = [];
  const visit = async (directory: URI, relativeDirectory: string): Promise<void> => {
    if (token?.isCancellationRequested || results.length >= (maxResults ?? Number.POSITIVE_INFINITY)) return;
    const entries = await vscode.workspace.fs.readDirectory(directory);
    await entries.reduce<Promise<void>>(async (previous, [name, type]) => {
      await previous;
      if (token?.isCancellationRequested || results.length >= (maxResults ?? Number.POSITIVE_INFINITY)) return;
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      const uri = Utils.joinPath(directory, name);
      if (type === vscode.FileType.Directory) {
        await visit(uri, relativePath);
      } else if (
        minimatch(relativePath, includePattern) &&
        (!excludePattern || !minimatch(relativePath, excludePattern))
      ) {
        results.push(uri);
      }
    }, Promise.resolve());
  };
  await visit(baseUri, '');
  return results;
};

export class FsService extends Effect.Service<FsService>()('FsService', {
  accessors: true,
  dependencies: [],
  effect: Effect.gen(function* () {
    const providerRegistry = Option.getOrUndefined(yield* Effect.serviceOption(FileSystemProviderRegistry));

    const getOrgDataProvider = Effect.fn('fsService.getOrgDataProvider')(function* (uri: URI, functionName: string) {
      const registration = providerRegistry?.get(uri.scheme);
      if (uri.scheme === ORG_DATA_SCHEME && registration?.provider instanceof OrgDataFsProvider) {
        return registration.provider;
      }
      return yield* fsError(
        functionName,
        uri.toString(),
        new Error(`No org-data provider registered for ${uri.scheme}`)
      );
    });

    // Resolve the org-data provider for `uri`, then run one of its synchronous mutating methods,
    // wrapping any throw as a tagged FsServiceError. Shared by the writeOrgData/createOrgDataDir/
    // deleteOrgData/clearOrgData accessors so they stay one-liners.
    const onOrgDataProvider = <A>(functionName: string, uri: URI, run: (provider: OrgDataFsProvider) => A) =>
      getOrgDataProvider(uri, functionName).pipe(
        Effect.flatMap(provider =>
          Effect.try({ try: () => run(provider), catch: e => fsError(functionName, uri.toString(), e) })
        )
      );

    const findFiles = Effect.fn('fsService.findFiles')(function* (
      include: vscode.GlobPattern,
      exclude?: vscode.GlobPattern | null,
      maxResults?: number,
      token?: vscode.CancellationToken
    ) {
      const baseUri = resolveFindFilesBase(include);
      const filePath = isString(include) ? include : include.pattern;
      if (!baseUri) {
        return yield* fsError(
          'findFiles',
          filePath,
          new Error('Cannot find files without a workspace folder or RelativePattern base URI')
        );
      }
      if (baseUri.scheme === 'file') {
        return yield* Effect.tryPromise({
          try: () => vscode.workspace.findFiles(include, exclude ?? undefined, maxResults, token),
          catch: e => fsError('findFiles', filePath, e)
        });
      }
      const registration = providerRegistry?.get(baseUri.scheme);
      if (baseUri.scheme === 'memfs' && registration?.findFiles) {
        return yield* Effect.tryPromise({
          try: () => registration.findFiles?.(include, exclude, maxResults) ?? Promise.resolve([]),
          catch: e => fsError('findFiles', filePath, e)
        });
      }
      if (baseUri.scheme === ORG_DATA_SCHEME && registration) {
        return yield* Effect.tryPromise({
          try: () => walkFiles(baseUri, include, exclude, maxResults, token),
          catch: e => fsError('findFiles', filePath, e)
        });
      }
      return yield* fsError('findFiles', filePath, new Error(`findFiles does not support scheme ${baseUri.scheme}`));
    });

    return {
      readFile,
      toUri: (filePath: string | URI) => Effect.succeed(toUri(filePath)),
      HashableUri,
      uriToPath: (uri: URI) => Effect.succeed(uriToPath(uri)),
      /** Find files by glob. baseUri optional via RelativePattern; defaults to workspace folders. */
      findFiles,
      /** Write file to filesystem, creating directories if they don't exist */
      safeWriteFile,
      writeFile,
      writeOrgData: (filePath: URI, content: string) =>
        onOrgDataProvider('writeOrgData', filePath, provider =>
          provider.writeFileInternal(filePath, encoder.encode(content), { create: true, overwrite: true })
        ),
      createOrgDataDir: (dirPath: URI) =>
        onOrgDataProvider('createOrgDataDir', dirPath, provider => provider.createDirectoryInternal(dirPath)),
      deleteOrgData: (filePath: URI, options: { recursive: boolean } = { recursive: false }) =>
        onOrgDataProvider('deleteOrgData', filePath, provider => provider.deleteInternal(filePath, options)),
      clearOrgData: ({ orgKey, owner }: { orgKey: string; owner?: OrgDataOwner }) => {
        const target = owner ? orgDataOwnerRoot({ orgKey, owner }) : orgRoot(orgKey);
        return onOrgDataProvider('clearOrgData', target, provider =>
          provider.deleteInternal(target, { recursive: true })
        ).pipe(
          Effect.catchAll(error =>
            error.cause instanceof vscode.FileSystemError &&
            (error.cause.code === 'FileNotFound' || error.cause.code === 'FileNotADirectory')
              ? Effect.void
              : Effect.fail(error)
          )
        );
      },
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
      createDirectory: Effect.fn('fsService.createDirectory')(function* (dirPath: string | URI) {
        const path = UriOrStringToString(dirPath);
        yield* Effect.annotateCurrentSpan({ filePath: path });
        return yield* Effect.tryPromise({
          try: async () => {
            await vscode.workspace.fs.createDirectory(toUri(dirPath));
          },
          catch: e =>
            new FsServiceError({
              ...unknownToErrorCause(e),
              function: 'createDirectory',
              filePath: path
            })
        }).pipe(Effect.tapError(err => Effect.annotateCurrentSpan({ 'error.message': err.cause.message })));
      }),
      deleteFile: (filePath: string, options = {}) =>
        Effect.tryPromise({
          try: async () => {
            await vscode.workspace.fs.delete(toUri(filePath), options);
          },
          catch: e => new FsServiceError({ ...unknownToErrorCause(e), function: 'deleteFile', filePath })
        }),
      readDirectory: Effect.fn('fsService.readDirectory')(function* (dirPath: string | URI) {
        const uri = toUri(dirPath);
        const entries = yield* Effect.tryPromise({
          try: async () => await vscode.workspace.fs.readDirectory(uri),
          catch: e =>
            new FsServiceError({
              ...unknownToErrorCause(e),
              function: 'readDirectory',
              filePath: isString(dirPath) ? dirPath : uriToPath(dirPath)
            })
        });
        return entries.map(([name]) => Utils.joinPath(uri, name));
      }),
      /** Like readDirectory but preserves FileType for each entry, enabling recursive traversal without extra stat calls. */
      readDirectoryWithTypes: Effect.fn('fsService.readDirectoryWithTypes')(function* (dirPath: string | URI) {
        const uri = toUri(dirPath);
        const entries = yield* Effect.tryPromise({
          try: async () => await vscode.workspace.fs.readDirectory(uri),
          catch: e =>
            new FsServiceError({
              ...unknownToErrorCause(e),
              function: 'readDirectoryWithTypes',
              filePath: isString(dirPath) ? dirPath : uriToPath(dirPath)
            })
        });
        return entries.map(([name, type]) => ({ uri: Utils.joinPath(uri, name), type }));
      }),
      stat: (filePath: string | URI) =>
        Effect.tryPromise({
          try: async () => await vscode.workspace.fs.stat(toUri(filePath)),
          catch: e =>
            new FsServiceError({ ...unknownToErrorCause(e), function: 'stat', filePath: UriOrStringToString(filePath) })
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
              filePath: isString(filePath) ? filePath : filePath.toString()
            })
        }).pipe(Effect.catchAll(() => Effect.void)),
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
const UriOrStringToString = (uri: URI | string) => (isString(uri) ? uri : uri.toString());
