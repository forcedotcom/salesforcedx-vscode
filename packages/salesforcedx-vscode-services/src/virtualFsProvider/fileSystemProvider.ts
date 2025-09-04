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
import * as Effect from 'effect/Effect';
import { Buffer } from 'node:buffer';
// eslint-disable-next-line no-restricted-imports
import type { Dirent } from 'node:fs';
import * as vscode from 'vscode';
import { emitter } from './memfsWatcher';
/**
 * the VSCode API doesn't store these anywhere by default.
 * This is hooked up to memfs right now, and its watcher handles everything else
 */
export class FsProvider implements vscode.FileSystemProvider {
  public readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = emitter.event;

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
    await fs.promises.mkdir(uri.fsPath, { recursive: true });
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
    const program = Effect.sync(() => {
      if (!options.create && !this.exists(uri)) {
        return Effect.fail(vscode.FileSystemError.FileNotFound(uri));
      }
      if (!options.overwrite && this.exists(uri)) {
        return Effect.fail(vscode.FileSystemError.FileExists(uri));
      }
      return Effect.succeed(undefined);
    }).pipe(
      // Write file to filesystem
      Effect.flatMap(() =>
        Effect.tryPromise({
          try: () => fs.promises.writeFile(uri.fsPath, Buffer.from(content)),
          catch: e => new Error(`Failed to write file: ${String(e)}`)
        })
      )
    );

    await Effect.runPromise(Effect.scoped(program));

    emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  public async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
    await fs.promises.rm(uri.fsPath, { recursive: options.recursive, force: true });
    emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  public async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
    if (!options.overwrite && this.exists(newUri)) {
      throw vscode.FileSystemError.FileExists(newUri);
    }
    await fs.promises.rename(oldUri.fsPath, newUri.fsPath);

    emitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    ]);
  }

  public watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }
}
