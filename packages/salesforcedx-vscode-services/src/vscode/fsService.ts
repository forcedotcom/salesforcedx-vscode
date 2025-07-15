/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Context, Effect, Layer } from 'effect';
import * as S from 'effect/Schema';
import { dirname } from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ChannelService } from '../vscode/channelService';

export type FsService = {
  readFile: (filePath: string) => Effect.Effect<string, Error, ChannelService>;
  writeFile: (filePath: string, content: string) => Effect.Effect<void, Error, ChannelService>;
  fileOrFolderExists: (filePath: string) => Effect.Effect<boolean, Error, ChannelService>;
  isDirectory: (path: string) => Effect.Effect<boolean, Error, never>;
  isFile: (path: string) => Effect.Effect<boolean, Error, never>;
  createDirectory: (dirPath: string) => Effect.Effect<void, Error, never>;
  deleteFile: (
    filePath: string,
    options?: { recursive?: boolean; useTrash?: boolean }
  ) => Effect.Effect<void, Error, never>;
  readDirectory: (dirPath: string) => Effect.Effect<string[], Error, never>;
  stat: (filePath: string) => Effect.Effect<vscode.FileStat, Error, never>;
  safeDelete: (
    filePath: string,
    options?: { recursive?: boolean; useTrash?: boolean }
  ) => Effect.Effect<void, Error, never>;
  rename: (oldPath: string, newPath: string) => Effect.Effect<void, Error, never>;
  /** Reads a file, parses JSON, and validates it with the provided Effect Schema. */
  readJSON: <A>(filePath: string, schema: S.Schema<A>) => Effect.Effect<A, Error, ChannelService>;
};

export const FsService = Context.GenericTag<FsService>('FsService');

/**
 * FsServiceLive requires ChannelService to be provided as a dependency.
 * Use: Effect.provide(ChannelServiceLayer('Your Channel Name'))
 */
export const FsServiceLive: Layer.Layer<FsService, never, ChannelService> = Layer.scoped(
  FsService,
  Effect.sync(() => {
    const fs = vscode.workspace.fs;
    // capture readFile for use in readJSON
    const readFile = (filePath: string): Effect.Effect<string, Error, ChannelService> =>
      Effect.flatMap(ChannelService, channelService =>
        channelService.appendToChannel(`[FsService] readFile: ${filePath}`).pipe(
          Effect.flatMap(() =>
            Effect.tryPromise({
              try: async () => {
                const uri = URI.file(filePath);
                const data = await fs.readFile(uri);
                return Buffer.from(data).toString('utf8');
              },
              catch: e => new Error(`Failed to read file ${filePath}: ${String(e)}`)
            })
          )
        )
      );
    return {
      readFile,
      writeFile: (filePath: string, content: string): Effect.Effect<void, Error, ChannelService> =>
        Effect.flatMap(ChannelService, channelService =>
          channelService.appendToChannel(`[FsService] writeFile: ${filePath}`).pipe(
            Effect.flatMap(() =>
              Effect.tryPromise({
                try: async () => {
                  const dirPath = dirname(filePath);
                  await fs.createDirectory(URI.file(dirPath));
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
          })
            .pipe(Effect.catchAll(() => Effect.succeed(false)))
            .pipe(
              Effect.tap(result =>
                channelService.appendToChannel(`[FsService] fileOrFolderExists: ${uri.toString()} => ${result}`)
              )
            );
        }),
      isDirectory: (path: string): Effect.Effect<boolean, Error, never> =>
        Effect.tryPromise({
          try: async () => {
            const uri = URI.file(path);
            const fileStat = await fs.stat(uri);
            return fileStat.type === vscode.FileType.Directory;
          },
          catch: e => new Error(String(e))
        }).pipe(Effect.catchAll(() => Effect.succeed(false))),
      isFile: (path: string): Effect.Effect<boolean, Error, never> =>
        Effect.tryPromise({
          try: async () => {
            const uri = URI.file(path);
            const fileStat = await fs.stat(uri);
            return fileStat.type === vscode.FileType.File;
          },
          catch: e => new Error(String(e))
        }).pipe(Effect.catchAll(() => Effect.succeed(false))),
      createDirectory: (dirPath: string): Effect.Effect<void, Error, never> =>
        Effect.tryPromise({
          try: async () => {
            const uri = URI.file(dirPath);
            await fs.createDirectory(uri);
          },
          catch: e => new Error(`Failed to create directory ${dirPath}: ${String(e)}`)
        }),
      deleteFile: (filePath: string, options = {}): Effect.Effect<void, Error, never> =>
        Effect.tryPromise({
          try: async () => {
            const uri = URI.file(filePath);
            await fs.delete(uri, options);
          },
          catch: e => new Error(`Failed to delete file ${filePath}: ${String(e)}`)
        }),
      readDirectory: (dirPath: string): Effect.Effect<string[], Error, never> =>
        Effect.tryPromise({
          try: async () => {
            const uri = URI.file(dirPath);
            const entries = await fs.readDirectory(uri);
            return entries.map(([name]) => name);
          },
          catch: e => new Error(`Failed to read directory ${dirPath}: ${String(e)}`)
        }),
      stat: (filePath: string): Effect.Effect<vscode.FileStat, Error, never> =>
        Effect.tryPromise({
          try: async () => {
            const uri = URI.file(filePath);
            return await fs.stat(uri);
          },
          catch: e => new Error(`Failed to get file stats for ${filePath}: ${String(e)}`)
        }),
      safeDelete: (filePath: string, options = {}): Effect.Effect<void, Error, never> =>
        Effect.tryPromise({
          try: async () => {
            const uri = URI.file(filePath);
            try {
              await fs.stat(uri);
              await fs.delete(uri, options);
            } catch {
              // File doesn't exist or can't be accessed, do nothing
            }
          },
          catch: e => new Error(String(e))
        }).pipe(Effect.catchAll(() => Effect.succeed(undefined))),
      rename: (oldPath: string, newPath: string): Effect.Effect<void, Error, never> =>
        Effect.tryPromise({
          try: async () => {
            const oldUri = URI.file(oldPath);
            const newUri = URI.file(newPath);
            await fs.rename(oldUri, newUri);
          },
          catch: e => new Error(`Failed to rename ${oldPath} to ${newPath}: ${String(e)}`)
        }),
      readJSON: <A>(filePath: string, schema: S.Schema<A>): Effect.Effect<A, Error, ChannelService> =>
        Effect.gen(function* () {
          const text = yield* readFile(filePath);
          return yield* Effect.try({
            try: () => JSON.parse(text),
            catch: (e: unknown) => new Error(`Failed to parse JSON in ${filePath}: ${String(e)}`)
          }).pipe(
            Effect.flatMap((obj: unknown) =>
              S.decodeUnknown(schema)(obj).pipe(
                Effect.mapError((e: unknown) => new Error(`Failed to decode JSON in ${filePath}: ${String(e)}`)),
                Effect.catchAll((e: unknown) =>
                  Effect.fail(new Error(`Failed to decode JSON in ${filePath}: ${String(e)}`))
                )
              )
            )
          );
        })
    };
  })
);
