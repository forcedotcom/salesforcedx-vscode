/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// we disable this rule so the methods match the vscode interface
/* eslint-disable class-methods-use-this */
/* eslint-disable functional/no-throw-statements */

import { fs } from '@salesforce/core/fs';
import { Effect, Layer, pipe } from 'effect';
import { Buffer } from 'node:buffer';
import { Dirent } from 'node:fs';
import * as vscode from 'vscode';
import { ChannelServiceLayer } from '../vscode/channelService';
import { IndexedDBStorageService, IndexedDBStorageServiceLive } from './indexedDbStorage';
import { emitter } from './memfsWatcher';

const dependencies = Layer.provideMerge(IndexedDBStorageServiceLive, ChannelServiceLayer('Salesforce Services'));
/**
 * the VSCode API doesn't store these anywhere by default.
 * This is hooked up to memfs right now, and its watcher handles everything else
 */
export class FsProvider implements vscode.FileSystemProvider {
  public readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = emitter.event;

  public async init(): Promise<FsProvider> {
    const program = pipe(
      IndexedDBStorageService,
      Effect.flatMap(storage => storage.loadState),
      Effect.provide(dependencies),
      Effect.withSpan('FsProvider: init')
    );

    await Effect.runPromise(program);

    return this;
  }

  public exists(uri: vscode.Uri): boolean {
    return fs.existsSync(uri.fsPath);
  }

  public stat(uri: vscode.Uri): vscode.FileStat {
    const stats = fs.statSync(uri.fsPath);
    return {
      type: stats.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
      ctime: stats.ctimeMs,
      mtime: stats.mtimeMs,
      size: stats.size
    };
  }

  public readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return (fs.readdirSync(uri.fsPath, { withFileTypes: true }) as Dirent[]).map(dirent => [
      dirent.name,
      dirent.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File
    ]);
  }

  public async createDirectory(uri: vscode.Uri): Promise<void> {
    fs.mkdirSync(uri.fsPath, { recursive: true });
    emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
  }

  public readFile(uri: vscode.Uri): Uint8Array {
    // memfs types are loose around readFileSync
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return new Uint8Array(fs.readFileSync(uri.fsPath) as Buffer);
  }

  public async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): Promise<void> {
    const program = pipe(
      // Validate file existence
      Effect.sync(() => {
        if (!options.create && !this.exists(uri)) {
          return Effect.fail(vscode.FileSystemError.FileNotFound(uri));
        }
        if (!options.overwrite && this.exists(uri)) {
          return Effect.fail(vscode.FileSystemError.FileExists(uri));
        }
        return Effect.succeed(undefined);
      }),
      // Write file to filesystem
      Effect.flatMap(() =>
        Effect.tryPromise({
          try: () => fs.promises.writeFile(uri.fsPath, Buffer.from(content)),
          catch: e => new Error(`Failed to write file: ${String(e)}`)
        })
      ),
      // Save to IndexedDB
      Effect.flatMap(() => IndexedDBStorageService),
      Effect.flatMap(storage => storage.saveFile(uri.fsPath)),
      Effect.provide(dependencies),
      Effect.withSpan('FsProvider: writeFile')
    );

    await Effect.runPromise(program);

    emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  public async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
    await fs.promises.rm(uri.fsPath, { recursive: options.recursive, force: true });

    const program = pipe(
      IndexedDBStorageService,
      Effect.flatMap(storage => storage.deleteFile(uri.fsPath)),
      Effect.provide(dependencies),
      Effect.withSpan('FsProvider: delete')
    );

    await Effect.runPromise(program);

    emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  public async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
    if (!options.overwrite && this.exists(newUri)) {
      throw vscode.FileSystemError.FileExists(newUri);
    }
    fs.renameSync(oldUri.fsPath, newUri.fsPath);

    const program = pipe(
      IndexedDBStorageService,
      Effect.flatMap(storage =>
        pipe(
          storage.deleteFile(oldUri.fsPath),
          Effect.flatMap(() => storage.saveFile(newUri.fsPath))
        )
      ),
      Effect.provide(dependencies),
      Effect.withSpan('FsProvider: rename')
    );

    await Effect.runPromise(program);

    emitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    ]);
  }

  public watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }
}
