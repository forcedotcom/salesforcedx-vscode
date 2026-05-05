/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';

type Entry = FileEntry | DirectoryEntry;

type FileEntry = {
  readonly type: vscode.FileType.File;
  ctime: number;
  mtime: number;
  data: Uint8Array;
};

type DirectoryEntry = {
  readonly type: vscode.FileType.Directory;
  ctime: number;
  mtime: number;
  entries: Map<string, Entry>;
};

const now = () => Date.now();

const createDirectoryEntry = (): DirectoryEntry => ({
  type: vscode.FileType.Directory,
  ctime: now(),
  mtime: now(),
  entries: new Map()
});

const createFileEntry = (content: Uint8Array): FileEntry => ({
  type: vscode.FileType.File,
  ctime: now(),
  mtime: now(),
  data: content
});

const toStat = (entry: Entry): vscode.FileStat => ({
  type: entry.type,
  ctime: entry.ctime,
  mtime: entry.mtime,
  size: entry.type === vscode.FileType.File ? entry.data.length : 0
});

const pathParts = (uri: URI): string[] => uri.path.split('/').filter(Boolean);

export class ApexTestingDiscoveryFsProvider implements vscode.FileSystemProvider {
  private readonly root = createDirectoryEntry();
  private readonly changeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  public readonly onDidChangeFile = this.changeEmitter.event;
  private readonly readOnlyErrorMessage = nls.localize('apex_testing_vfs_readonly_prefix_text');

  // eslint-disable-next-line class-methods-use-this
  public watch(_uri: URI, _options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    // No-op watcher - this file system is programmatically updated, not watched
    return new vscode.Disposable(() => undefined);
  }

  public stat(uri: URI): vscode.FileStat {
    const entry = this.getEntry(uri, false);
    if (!entry) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return toStat(entry);
  }

  public readDirectory(uri: URI): [string, vscode.FileType][] {
    const entry = this.getEntry(uri, false);
    if (entry?.type !== vscode.FileType.Directory) {
      throw vscode.FileSystemError.FileNotADirectory(uri);
    }
    return [...entry.entries.entries()].map(([name, child]) => [name, child.type]);
  }

  public createDirectory(uri: URI): void {
    throw vscode.FileSystemError.NoPermissions(`${this.readOnlyErrorMessage}: ${uri.toString()}`);
  }

  public readFile(uri: URI): Uint8Array {
    const entry = this.getEntry(uri, false);
    if (entry?.type !== vscode.FileType.File) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return entry.data;
  }

  public writeFile(uri: URI, _content: Uint8Array, _options: { create: boolean; overwrite: boolean }): void {
    throw vscode.FileSystemError.NoPermissions(`${this.readOnlyErrorMessage}: ${uri.toString()}`);
  }

  public delete(uri: URI, _options: { recursive: boolean }): void {
    throw vscode.FileSystemError.NoPermissions(`${this.readOnlyErrorMessage}: ${uri.toString()}`);
  }

  public rename(oldUri: URI, newUri: URI, _options: { overwrite: boolean }): void {
    throw vscode.FileSystemError.NoPermissions(
      `${this.readOnlyErrorMessage}: ${oldUri.toString()} -> ${newUri.toString()}`
    );
  }

  // Internal API used by discovery persistence to update in-memory VFS state.
  public createDirectoryInternal(uri: URI): void {
    this.getOrCreateDirectory(uri);
    this.changeEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  // Internal API used by discovery persistence to update in-memory VFS state.
  public writeFileInternal(uri: URI, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
    const parent = this.getParentDirectory(uri, false);
    const name = this.basename(uri);
    const existing = parent.entries.get(name);
    if (existing?.type === vscode.FileType.Directory) {
      throw vscode.FileSystemError.FileIsADirectory(uri);
    }
    if (!existing && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (existing && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }

    const next = createFileEntry(content);
    if (existing?.type === vscode.FileType.File) {
      next.ctime = existing.ctime;
    }
    parent.entries.set(name, next);
    parent.mtime = now();
    this.changeEmitter.fire([{ type: existing ? vscode.FileChangeType.Changed : vscode.FileChangeType.Created, uri }]);
  }

  // Internal API used by discovery persistence to update in-memory VFS state.
  public deleteInternal(uri: URI, options: { recursive: boolean }): void {
    const parent = this.getParentDirectory(uri, false);
    const name = this.basename(uri);
    const existing = parent.entries.get(name);
    if (!existing) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }

    if (existing.type === vscode.FileType.Directory && !options.recursive && existing.entries.size > 0) {
      throw vscode.FileSystemError.NoPermissions(`${uri.toString()} is not empty`);
    }
    parent.entries.delete(name);
    parent.mtime = now();
    this.changeEmitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  private getParentDirectory(uri: URI, create: boolean): DirectoryEntry {
    const parts = pathParts(uri);
    const parentUri = uri.with({ path: `/${parts.slice(0, -1).join('/')}` });
    return create ? this.getOrCreateDirectory(parentUri) : this.getDirectory(parentUri);
  }

  private getDirectory(uri: URI): DirectoryEntry {
    const entry = this.getEntry(uri, false);
    if (entry?.type !== vscode.FileType.Directory) {
      throw vscode.FileSystemError.FileNotADirectory(uri);
    }
    return entry;
  }

  private getOrCreateDirectory(uri: URI): DirectoryEntry {
    const parts = pathParts(uri);
    let current = this.root;
    for (const part of parts) {
      const existing = current.entries.get(part);
      if (!existing) {
        const dir = createDirectoryEntry();
        current.entries.set(part, dir);
        current.mtime = now();
        current = dir;
        continue;
      }
      if (existing.type !== vscode.FileType.Directory) {
        throw vscode.FileSystemError.FileNotADirectory(uri);
      }
      current = existing;
    }
    return current;
  }

  private getEntry(uri: URI, createDirectories: boolean): Entry | undefined {
    const parts = pathParts(uri);
    let current: Entry = this.root;
    for (const part of parts) {
      if (current.type !== vscode.FileType.Directory) {
        return undefined;
      }
      const next = current.entries.get(part);
      if (!next) {
        if (!createDirectories) {
          return undefined;
        }
        const dir = createDirectoryEntry();
        current.entries.set(part, dir);
        current.mtime = now();
        current = dir;
        continue;
      }
      current = next;
    }
    return current;
  }

  // eslint-disable-next-line class-methods-use-this
  private basename(uri: URI): string {
    const parts = pathParts(uri);
    const name = parts.at(-1);
    if (!name) {
      throw vscode.FileSystemError.NoPermissions(`Cannot write to root of ${uri.scheme}`);
    }
    return name;
  }
}

let providerInstance: ApexTestingDiscoveryFsProvider | undefined;

export const getApexTestingDiscoveryFsProvider = (): ApexTestingDiscoveryFsProvider => {
  providerInstance ??= new ApexTestingDiscoveryFsProvider();
  return providerInstance;
};
