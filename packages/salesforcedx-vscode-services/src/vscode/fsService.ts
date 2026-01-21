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
import { URI, Utils } from 'vscode-uri';
import { unknownToErrorCause } from '../core/shared';
import { ChannelService } from '../vscode/channelService';
import { uriToPath } from './paths';
// Capture vscode.workspace.fs at module level

class FsServiceError extends Data.TaggedError('FsServiceError')<{
  readonly cause: Error;
  readonly function: string;
  readonly filePath: string;
}> { }
/**
 * Convert path string or URI to URI, handling both file:// and other schemes like memfs://
 * @param filePath - Either a URI object, URI string (e.g., "memfs:/MyProject/file.txt"), or a file path (e.g., "/path/to/file" or "C:\path\to\file")
 * @returns A properly parsed VS Code URI
 */
export const toUri = (filePath: string | URI): URI => {
  // If it's already a URI object, return it
  if (typeof filePath !== 'string') {
    return filePath;
  }

  // Check if it's already a URI string (has scheme:/path format)
  // Must have colon followed by slash, but not be a Windows drive letter (single letter + colon)
  if (/^[a-z][\w+.-]*:/i.test(filePath) && !/^[a-z]:/i.test(filePath)) {
    return URI.parse(filePath);
  }

  // Handle Windows UNC paths (\\server\share\file.txt) by converting to proper file URI
  if (filePath.startsWith('\\\\')) {
    // Convert \\server\share\file.txt to /server/share/file.txt for URI.path
    const normalizedPath = filePath.slice(2).replaceAll('\\', '/'); // Remove leading \\, normalize separators
    return URI.file(`/${normalizedPath}`);
  }

  // In web environment, paths without a scheme should use memfs:
  if (process.env.ESBUILD_PLATFORM === 'web') {
    return URI.parse(`memfs:${filePath}`);
  }

  // Otherwise treat as file path (including Windows paths like C:\)
  const fileUri = URI.file(filePath);
  return fileUri;
};

// capture readFile for use in readJSON
const readFile = (filePath: string) =>
  Effect.flatMap(ChannelService, channelService =>
    channelService.appendToChannel(`[FsService] readFile: ${filePath}`).pipe(
      Effect.flatMap(() =>
        Effect.tryPromise({
          try: async () => Buffer.from(await vscode.workspace.fs.readFile(toUri(filePath))).toString('utf8'),
          catch: e => new FsServiceError({ ...unknownToErrorCause(e), function: 'readFile', filePath })
        })
      )
    )
  );

export class FsService extends Effect.Service<FsService>()('FsService', {
  dependencies: [ChannelService.Default],
  succeed: {
    readFile,
    toUri: (filePath: string | URI) => Effect.succeed(toUri(filePath)),
    uriToPath: (uri: URI) => Effect.succeed(uriToPath(uri)),
    /** Write file to filesystem, creating directories if they don't exist */
    writeFile: (filePath: string | URI, content: string) =>
      Effect.flatMap(ChannelService, channelService =>
        channelService
          .appendToChannel(
            `[FsService] writeFile: ${String(typeof filePath === 'string' ? filePath : filePath.toString())}`
          )
          .pipe(
            Effect.withSpan('writeFile', {
              attributes: { filePath }
            }),
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: async () => {
                  const uri = toUri(filePath);
                  await vscode.workspace.fs.createDirectory(Utils.dirname(uri));
                  const uint8Array = new TextEncoder().encode(content);
                  await vscode.workspace.fs.writeFile(uri, uint8Array);
                },
                catch: e => e
              }).pipe(
                Effect.catchAll(e =>
                  Effect.fail(
                    new FsServiceError({
                      ...unknownToErrorCause(e),
                      function: 'writeFile',
                      filePath: typeof filePath === 'string' ? filePath : filePath.toString()
                    })
                  )
                )
              )
            )
          )
      ),
    fileOrFolderExists: (filePath: string | URI) =>
      Effect.flatMap(ChannelService, channelService => {
        const uri = toUri(filePath);
        return Effect.tryPromise({
          try: async () => {
            await vscode.workspace.fs.stat(uri);
            return true;
          },
          catch: e => new Error(String(e))
        }).pipe(
          Effect.catchAll(() => Effect.succeed(false)),
          Effect.tap(result =>
            channelService.appendToChannel(`[FsService] fileOrFolderExists: ${uri.toString()} => ${result}`)
          )
        );
      }),
    isDirectory: (path: string | URI) =>
      Effect.tryPromise(
        async () => (await vscode.workspace.fs.stat(toUri(path))).type === vscode.FileType.Directory
      ).pipe(Effect.catchAll(() => Effect.succeed(false))),
    isFile: (path: string | URI) =>
      Effect.tryPromise(async () => (await vscode.workspace.fs.stat(toUri(path))).type === vscode.FileType.File).pipe(
        Effect.catchAll(() => Effect.succeed(false))
      ),
    createDirectory: (dirPath: string) =>
      Effect.tryPromise({
        try: async () => {
          await vscode.workspace.fs.createDirectory(toUri(dirPath));
        },
        catch: e => new FsServiceError({ ...unknownToErrorCause(e), function: 'createDirectory', filePath: dirPath })
      }),
    deleteFile: (filePath: string, options = {}) =>
      Effect.tryPromise({
        try: async () => {
          await vscode.workspace.fs.delete(toUri(filePath), options);
        },
        catch: e => new FsServiceError({ ...unknownToErrorCause(e), function: 'deleteFile', filePath })
      }),
    readDirectory: (dirPath: string | URI) =>
      Effect.tryPromise({
        try: async () => (await vscode.workspace.fs.readDirectory(toUri(dirPath))).map(([name]) => name),
        catch: e => new FsServiceError({ ...unknownToErrorCause(e), function: 'readDirectory', filePath: typeof dirPath === 'string' ? dirPath : uriToPath(dirPath) })
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
        catch: error => error
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
  } as const,
}) { }
