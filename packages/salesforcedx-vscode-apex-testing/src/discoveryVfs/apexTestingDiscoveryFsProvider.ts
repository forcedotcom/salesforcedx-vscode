/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

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

export class ApexTestingDiscoveryFsProvider implements vscode.FileSystemProvider {
  private readonly root = createDirectoryEntry();
  private readonly changeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  public readonly onDidChangeFile = this.changeEmitter.event;

  public watch(_uri: vscode.Uri, _options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  public stat(uri: vscode.Uri): vscode.FileStat {
    const entry = this.getEntry(uri, false);
    if (!entry) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return this.toStat(entry);
  }

  public readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    const entry = this.getEntry(uri, false);
    if (entry?.type !== vscode.FileType.Directory) {
      throw vscode.FileSystemError.FileNotADirectory(uri);
    }
    return [...entry.entries.entries()].map(([name, child]) => [name, child.type]);
  }

  public createDirectory(uri: vscode.Uri): void {
    this.getOrCreateDirectory(uri);
    this.changeEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  public readFile(uri: vscode.Uri): Uint8Array {
    const entry = this.getEntry(uri, false);
    if (entry?.type !== vscode.FileType.File) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return entry.data;
  }

  public writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
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

  public delete(uri: vscode.Uri, options: { recursive: boolean }): void {
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

  public rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
    const oldParent = this.getParentDirectory(oldUri, false);
    const oldName = this.basename(oldUri);
    const existing = oldParent.entries.get(oldName);
    if (!existing) {
      throw vscode.FileSystemError.FileNotFound(oldUri);
    }

    const newParent = this.getParentDirectory(newUri, false);
    const newName = this.basename(newUri);
    const destination = newParent.entries.get(newName);

    if (destination && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(newUri);
    }
    oldParent.entries.delete(oldName);
    newParent.entries.set(newName, existing);
    oldParent.mtime = now();
    newParent.mtime = now();
    this.changeEmitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    ]);
  }

  private toStat(entry: Entry): vscode.FileStat {
    return {
      type: entry.type,
      ctime: entry.ctime,
      mtime: entry.mtime,
      size: entry.type === vscode.FileType.File ? entry.data.length : 0
    };
  }

  private getParentDirectory(uri: vscode.Uri, create: boolean): DirectoryEntry {
    const parts = this.pathParts(uri);
    const parentUri = uri.with({ path: `/${parts.slice(0, -1).join('/')}` });
    return create ? this.getOrCreateDirectory(parentUri) : this.getDirectory(parentUri);
  }

  private getDirectory(uri: vscode.Uri): DirectoryEntry {
    const entry = this.getEntry(uri, false);
    if (entry?.type !== vscode.FileType.Directory) {
      throw vscode.FileSystemError.FileNotADirectory(uri);
    }
    return entry;
  }

  private getOrCreateDirectory(uri: vscode.Uri): DirectoryEntry {
    const parts = this.pathParts(uri);
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

  private getEntry(uri: vscode.Uri, createDirectories: boolean): Entry | undefined {
    const parts = this.pathParts(uri);
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

  private pathParts(uri: vscode.Uri): string[] {
    return uri.path.split('/').filter(Boolean);
  }

  private basename(uri: vscode.Uri): string {
    const parts = this.pathParts(uri);
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
