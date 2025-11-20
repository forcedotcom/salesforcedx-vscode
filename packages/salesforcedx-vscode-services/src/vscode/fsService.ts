/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as S from 'effect/Schema';
import { dirname } from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ChannelService } from '../vscode/channelService';

// Capture vscode.workspace.fs at module level

/**
 * Convert path string or URI to URI, handling both file:// and other schemes like memfs://
 * @param filePath - Either a URI object, URI string (e.g., "memfs:/MyProject/file.txt"), or a file path (e.g., "/path/to/file" or "C:\path\to\file")
 * @returns A properly parsed VS Code URI
 */
export const toUri = (filePath: string | vscode.Uri): vscode.Uri => {
  // If it's already a URI object, return it
  if (typeof filePath !== 'string') {
    console.log('[toUri] input is URI object:', filePath.toString());
    return filePath;
  }

  console.log('[toUri] input string:', filePath);

  // Check if it's already a URI string (has scheme:/path format)
  // Must have colon followed by slash, but not be a Windows drive letter (single letter + colon)
  if (/^[a-z][\w+.-]*:/i.test(filePath) && !/^[a-z]:/i.test(filePath)) {
    const parsed = URI.parse(filePath);
    console.log('[toUri] parsed as URI scheme:', parsed.scheme, 'path:', parsed.path, 'toString:', parsed.toString());
    return parsed;
  }

  // Otherwise treat as file path (including Windows paths like C:\)
  const fileUri = URI.file(filePath);
  console.log('[toUri] converted to file URI:', fileUri.toString());
  return fileUri;
};

// capture readFile for use in readJSON
const readFile = (filePath: string): Effect.Effect<string, Error, ChannelService> =>
  Effect.flatMap(ChannelService, channelService =>
    channelService.appendToChannel(`[FsService] readFile: ${filePath}`).pipe(
      Effect.flatMap(() =>
        Effect.tryPromise({
          try: async () => Buffer.from(await vscode.workspace.fs.readFile(toUri(filePath))).toString('utf8'),
          catch: e => new Error(`Failed to read file ${filePath}: ${String(e)}`)
        })
      )
    )
  );

export class FsService extends Effect.Service<FsService>()('FsService', {
  succeed: {
    readFile,
    toUri,
    writeFile: (filePath: string | vscode.Uri, content: string): Effect.Effect<void, Error, ChannelService> =>
      Effect.flatMap(ChannelService, channelService =>
        channelService
          .appendToChannel(
            `[FsService] writeFile: ${String(typeof filePath === 'string' ? filePath : filePath.toString())}`
          )
          .pipe(
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: async () => {
                  const uri = toUri(filePath);
                  const dirUri = uri.with({ path: dirname(uri.path) });
                  await vscode.workspace.fs.createDirectory(dirUri);
                  const encoder = new TextEncoder();
                  const uint8Array = encoder.encode(content);
                  await vscode.workspace.fs.writeFile(uri, uint8Array);
                },
                catch: e => new Error(`Failed to write file ${filePath}: ${String(e)}`)
              })
            )
          )
      ),
    fileOrFolderExists: (filePath: string | vscode.Uri): Effect.Effect<boolean, Error, ChannelService> =>
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
    isDirectory: (path: string | vscode.Uri): Effect.Effect<boolean, Error, never> =>
      Effect.tryPromise({
        try: async () => (await vscode.workspace.fs.stat(toUri(path))).type === vscode.FileType.Directory,
        catch: e => new Error(String(e))
      }).pipe(Effect.catchAll(() => Effect.succeed(false))),
    isFile: (path: string | vscode.Uri): Effect.Effect<boolean, Error, never> =>
      Effect.tryPromise({
        try: async () => (await vscode.workspace.fs.stat(toUri(path))).type === vscode.FileType.File,
        catch: e => new Error(String(e))
      }).pipe(Effect.catchAll(() => Effect.succeed(false))),
    createDirectory: (dirPath: string): Effect.Effect<void, Error, never> =>
      Effect.tryPromise({
        try: async () => {
          await vscode.workspace.fs.createDirectory(toUri(dirPath));
        },
        catch: e => new Error(`Failed to create directory ${dirPath}: ${String(e)}`)
      }),
    deleteFile: (filePath: string, options = {}): Effect.Effect<void, Error, never> =>
      Effect.tryPromise({
        try: async () => {
          await vscode.workspace.fs.delete(toUri(filePath), options);
        },
        catch: e => new Error(`Failed to delete file ${filePath}: ${String(e)}`)
      }),
    readDirectory: (dirPath: string): Effect.Effect<string[], Error, never> =>
      Effect.tryPromise({
        try: async () => (await vscode.workspace.fs.readDirectory(toUri(dirPath))).map(([name]) => name),
        catch: e => new Error(`Failed to read directory ${dirPath}: ${String(e)}`)
      }),
    stat: (filePath: string): Effect.Effect<vscode.FileStat, Error, never> =>
      Effect.tryPromise({
        try: async () => await vscode.workspace.fs.stat(toUri(filePath)),
        catch: e => new Error(`Failed to get file stats for ${filePath}: ${String(e)}`)
      }),
    safeDelete: (filePath: string, options = {}): Effect.Effect<void, Error, never> =>
      Effect.tryPromise({
        try: async () => {
          const uri = toUri(filePath);
          await vscode.workspace.fs.stat(uri);
          return uri;
        },
        catch: () => undefined
      }).pipe(
        Effect.flatMap(uri =>
          uri
            ? Effect.tryPromise({
                try: async () => {
                  await vscode.workspace.fs.delete(uri, options);
                },
                catch: e => new Error(String(e))
              })
            : Effect.succeed(undefined)
        ),
        Effect.catchAll(() => Effect.succeed(undefined))
      ),
    rename: (oldPath: string, newPath: string): Effect.Effect<void, Error, never> =>
      Effect.tryPromise({
        try: async () => {
          await vscode.workspace.fs.rename(toUri(oldPath), toUri(newPath));
        },
        catch: e => new Error(`Failed to rename ${oldPath} to ${newPath}: ${String(e)}`)
      }),
    readJSON: <A>(filePath: string, schema: S.Schema<A>): Effect.Effect<A, Error, ChannelService> =>
      readFile(filePath).pipe(
        Effect.flatMap(text =>
          Effect.try({
            try: () => JSON.parse(text),
            catch: (e: unknown) => new Error(`Failed to parse JSON in ${filePath}: ${String(e)}`)
          })
        ),
        Effect.flatMap((obj: unknown) =>
          S.decodeUnknown(schema)(obj).pipe(
            Effect.mapError((e: unknown) => new Error(`Failed to decode JSON in ${filePath}: ${String(e)}`))
          )
        )
      )
  } as const,
  dependencies: [ChannelService.Default]
}) {}
