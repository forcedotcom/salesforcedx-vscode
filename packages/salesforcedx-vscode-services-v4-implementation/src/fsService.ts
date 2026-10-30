/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FsService, FsServiceError, HashableUri } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { type URI, Utils } from 'vscode-uri';
import { unknownToErrorCause } from './errorCause.js';
import { toUri, uriOrString, uriToPath } from './uriUtils.js';
import { WebFileSystemProvider } from './webFileSystemProvider.js';

const encoder = new TextEncoder();
const failure = (cause: unknown, operation: string, filePath: string): FsServiceError =>
  new FsServiceError({ ...unknownToErrorCause(cause), function: operation, filePath });

const readFile = Effect.fn('fsService.readFile')((filePath: string | URI) =>
  Effect.tryPromise({
    try: async () => Buffer.from(await vscode.workspace.fs.readFile(toUri(filePath))).toString('utf8'),
    catch: cause => failure(cause, 'readFile', uriOrString(filePath))
  })
);
const safeWriteFile = Effect.fn('fsService.safeWriteFile')((filePath: string | URI, content: string) =>
  Effect.tryPromise({
    try: async () => {
      const uri = toUri(filePath);
      await vscode.workspace.fs.createDirectory(Utils.dirname(uri));
      await vscode.workspace.fs.writeFile(uri, encoder.encode(content));
    },
    catch: cause => failure(cause, 'safeWriteFile', uriOrString(filePath))
  })
);
const writeFile = Effect.fn('fsService.writeFile')((filePath: string | URI, content: string) =>
  Effect.tryPromise({
    try: () => Promise.resolve(vscode.workspace.fs.writeFile(toUri(filePath), encoder.encode(content))),
    catch: cause => failure(cause, 'writeFile', uriOrString(filePath))
  })
);

export const FsServiceLayer = Layer.effect(
  FsService,
  Effect.gen(function* () {
    const webProvider = yield* WebFileSystemProvider;
    const stat = (filePath: string | URI) =>
      Effect.tryPromise({
        try: () => Promise.resolve(vscode.workspace.fs.stat(toUri(filePath))),
        catch: cause => failure(cause, 'stat', uriOrString(filePath))
      });
    const fileOrFolderExists = Effect.fn('fsService.fileOrFolderExists')((filePath: string | URI) =>
      stat(filePath).pipe(
        Effect.as(true),
        Effect.catchTag('FsServiceError', () => Effect.succeed(false))
      )
    );
    const isType = (filePath: string | URI, type: vscode.FileType) =>
      stat(filePath).pipe(
        Effect.map(info => info.type === type),
        Effect.catchTag('FsServiceError', () => Effect.succeed(false))
      );
    return FsService.of({
      readFile,
      safeWriteFile,
      writeFile,
      HashableUri,
      toUri: filePath => Effect.succeed(toUri(filePath)),
      uriToPath: uri => Effect.succeed(uriToPath(uri)),
      findFiles: (include, exclude, maxResults, token) =>
        Effect.tryPromise({
          try: () =>
            Promise.resolve(
              process.env.ESBUILD_PLATFORM === 'web'
                ? (webProvider.get()?.findFiles(include, exclude ?? undefined, maxResults) ?? [])
                : vscode.workspace.findFiles(include, exclude ?? undefined, maxResults, token)
            ),
          catch: cause => failure(cause, 'findFiles', isString(include) ? include : include.pattern)
        }),
      fileOrFolderExists,
      showTextDocument: Effect.fn('fsService.showTextDocument')(
        (filePath: string | URI, options?: vscode.TextDocumentShowOptions) =>
          Effect.tryPromise({
            // eslint-disable-next-line local/no-vscode-show-text-document -- This is the V4 FsService host implementation, not a consumer.
            try: () => Promise.resolve(vscode.window.showTextDocument(toUri(filePath), options)),
            catch: cause => failure(cause, 'showTextDocument', uriOrString(filePath))
          })
      ),
      isDirectory: filePath => isType(filePath, vscode.FileType.Directory),
      isFile: filePath => isType(filePath, vscode.FileType.File),
      createDirectory: Effect.fn('fsService.createDirectory')(function* (dirPath: string | URI) {
        const path = uriOrString(dirPath);
        yield* Effect.annotateCurrentSpan({ filePath: path });
        return yield* Effect.tryPromise({
          try: () => Promise.resolve(vscode.workspace.fs.createDirectory(toUri(dirPath))),
          catch: cause => failure(cause, 'createDirectory', path)
        }).pipe(Effect.tapError(error => Effect.annotateCurrentSpan({ 'error.message': error.cause.message })));
      }),
      deleteFile: (filePath, options = {}) =>
        Effect.tryPromise({
          try: () => Promise.resolve(vscode.workspace.fs.delete(toUri(filePath), options)),
          catch: cause => failure(cause, 'deleteFile', filePath)
        }),
      readDirectory: Effect.fn('fsService.readDirectory')(function* (dirPath: string | URI) {
        const uri = toUri(dirPath);
        return yield* Effect.tryPromise({
          try: () => Promise.resolve(vscode.workspace.fs.readDirectory(uri)),
          catch: cause => failure(cause, 'readDirectory', isString(dirPath) ? dirPath : uriToPath(dirPath))
        }).pipe(Effect.map(entries => entries.map(([name]) => Utils.joinPath(uri, name))));
      }),
      readDirectoryWithTypes: Effect.fn('fsService.readDirectoryWithTypes')(function* (dirPath: string | URI) {
        const uri = toUri(dirPath);
        return yield* Effect.tryPromise({
          try: () => Promise.resolve(vscode.workspace.fs.readDirectory(uri)),
          catch: cause => failure(cause, 'readDirectoryWithTypes', isString(dirPath) ? dirPath : uriToPath(dirPath))
        }).pipe(Effect.map(entries => entries.map(([name, type]) => ({ uri: Utils.joinPath(uri, name), type }))));
      }),
      stat,
      safeDelete: (filePath, options = {}) =>
        Effect.tryPromise({
          try: () => Promise.resolve(vscode.workspace.fs.delete(toUri(filePath), options)),
          catch: cause => failure(cause, 'safeDelete', uriOrString(filePath))
        }).pipe(Effect.catchTag('FsServiceError', () => Effect.void)),
      rename: (oldPath, newPath, options) =>
        Effect.tryPromise({
          try: () => Promise.resolve(vscode.workspace.fs.rename(toUri(oldPath), toUri(newPath), options)),
          catch: cause => failure(cause, 'rename', oldPath)
        }),
      readJSON: <A>(filePath: string, schema: Schema.Codec<A>) =>
        readFile(filePath).pipe(
          Effect.flatMap(text =>
            Effect.try({
              try: (): unknown => JSON.parse(text),
              catch: cause => failure(cause, 'readJSON', filePath)
            })
          ),
          Effect.flatMap(Schema.decodeUnknownEffect(schema)),
          Effect.catchTag('SchemaError', cause => Effect.fail(failure(cause, 'readJSON', filePath)))
        )
    });
  })
);
