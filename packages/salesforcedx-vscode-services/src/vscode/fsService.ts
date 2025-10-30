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
const fs = vscode.workspace.fs;

// capture readFile for use in readJSON
const readFile = (filePath: string): Effect.Effect<string, Error, ChannelService> =>
  Effect.flatMap(ChannelService, channelService =>
    channelService.appendToChannel(`[FsService] readFile: ${filePath}`).pipe(
      Effect.flatMap(() =>
        Effect.tryPromise({
          try: async () => Buffer.from(await fs.readFile(URI.file(filePath))).toString('utf8'),
          catch: e => new Error(`Failed to read file ${filePath}: ${String(e)}`)
        })
      )
    )
  );

export class FsService extends Effect.Service<FsService>()('FsService', {
  succeed: {
    readFile,
    writeFile: (filePath: string, content: string): Effect.Effect<void, Error, ChannelService> =>
      Effect.flatMap(ChannelService, channelService =>
        channelService.appendToChannel(`[FsService] writeFile: ${filePath}`).pipe(
          Effect.flatMap(() =>
            Effect.tryPromise({
              try: async () => {
                await fs.createDirectory(URI.file(dirname(filePath)));
                const encoder = new TextEncoder();
                const uint8Array = encoder.encode(content);
                await fs.writeFile(URI.file(filePath), uint8Array);
              },
              catch: e => new Error(`Failed to write file ${filePath}: ${String(e)}`)
            })
          )
        )
      ),
    fileOrFolderExists: (filePath: string): Effect.Effect<boolean, Error, ChannelService> =>
      Effect.flatMap(ChannelService, channelService => {
        const uri = URI.file(filePath);
        return Effect.tryPromise({
          try: async () => {
            await fs.stat(uri);
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
    isDirectory: (path: string): Effect.Effect<boolean, Error, never> =>
      Effect.tryPromise({
        try: async () => (await fs.stat(URI.file(path))).type === vscode.FileType.Directory,
        catch: e => new Error(String(e))
      }).pipe(Effect.catchAll(() => Effect.succeed(false))),
    isFile: (path: string): Effect.Effect<boolean, Error, never> =>
      Effect.tryPromise({
        try: async () => (await fs.stat(URI.file(path))).type === vscode.FileType.File,
        catch: e => new Error(String(e))
      }).pipe(Effect.catchAll(() => Effect.succeed(false))),
    createDirectory: (dirPath: string): Effect.Effect<void, Error, never> =>
      Effect.tryPromise({
        try: async () => {
          await fs.createDirectory(URI.file(dirPath));
        },
        catch: e => new Error(`Failed to create directory ${dirPath}: ${String(e)}`)
      }),
    deleteFile: (filePath: string, options = {}): Effect.Effect<void, Error, never> =>
      Effect.tryPromise({
        try: async () => {
          await fs.delete(URI.file(filePath), options);
        },
        catch: e => new Error(`Failed to delete file ${filePath}: ${String(e)}`)
      }),
    readDirectory: (dirPath: string): Effect.Effect<string[], Error, never> =>
      Effect.tryPromise({
        try: async () => (await fs.readDirectory(URI.file(dirPath))).map(([name]) => name),
        catch: e => new Error(`Failed to read directory ${dirPath}: ${String(e)}`)
      }),
    stat: (filePath: string): Effect.Effect<vscode.FileStat, Error, never> =>
      Effect.tryPromise({
        try: async () => await fs.stat(URI.file(filePath)),
        catch: e => new Error(`Failed to get file stats for ${filePath}: ${String(e)}`)
      }),
    safeDelete: (filePath: string, options = {}): Effect.Effect<void, Error, never> =>
      Effect.tryPromise({
        try: async () => {
          await fs.stat(URI.file(filePath));
          return URI.file(filePath);
        },
        catch: () => undefined
      }).pipe(
        Effect.flatMap(uri =>
          uri
            ? Effect.tryPromise({
                try: async () => {
                  await fs.delete(uri, options);
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
          await fs.rename(URI.file(oldPath), URI.file(newPath));
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
