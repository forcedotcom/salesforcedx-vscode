/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// vscode FileSystemProvider contract requires synchronous FileSystemError throws
/* eslint-disable functional/no-throw-statements */

import * as vscode from 'vscode';
import { type URI } from 'vscode-uri';
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

export class OrgDataFsProvider implements vscode.FileSystemProvider {
  private readonly root = createDirectoryEntry();
  private readonly changeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  public readonly onDidChangeFile = this.changeEmitter.event;
  private readonly readOnlyErrorMessage = nls.localize('org_data_vfs_readonly_prefix_text');

  // eslint-disable-next-line class-methods-use-this
  public watch(_uri: URI, _options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  public stat(uri: URI): vscode.FileStat {
    const entry = this.getEntry(uri);
    if (!entry) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return toStat(entry);
  }

  public readDirectory(uri: URI): [string, vscode.FileType][] {
    const entry = this.getEntry(uri);
    if (entry?.type !== vscode.FileType.Directory) {
      throw vscode.FileSystemError.FileNotADirectory(uri);
    }
    return [...entry.entries.entries()].map(([name, child]) => [name, child.type]);
  }

  public createDirectory(uri: URI): void {
    throw vscode.FileSystemError.NoPermissions(`${this.readOnlyErrorMessage}: ${uri.toString()}`);
  }

  public readFile(uri: URI): Uint8Array {
    const entry = this.getEntry(uri);
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

  public createDirectoryInternal(uri: URI): void {
    this.getOrCreateDirectory(uri);
    this.changeEmitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  public writeFileInternal(uri: URI, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
    const parent = this.getParentDirectory(uri);
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

  public deleteInternal(uri: URI, options: { recursive: boolean }): void {
    const parent = this.getParentDirectory(uri);
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

  private getParentDirectory(uri: URI): DirectoryEntry {
    const parts = pathParts(uri);
    return this.getDirectory(uri.with({ path: `/${parts.slice(0, -1).join('/')}` }));
  }

  private getDirectory(uri: URI): DirectoryEntry {
    const entry = this.getEntry(uri);
    if (entry?.type !== vscode.FileType.Directory) {
      throw vscode.FileSystemError.FileNotADirectory(uri);
    }
    return entry;
  }

  private getOrCreateDirectory(uri: URI): DirectoryEntry {
    return pathParts(uri).reduce<DirectoryEntry>((current, part) => {
      const existing = current.entries.get(part);
      if (!existing) {
        const directory = createDirectoryEntry();
        current.entries.set(part, directory);
        current.mtime = now();
        return directory;
      }
      if (existing.type !== vscode.FileType.Directory) {
        throw vscode.FileSystemError.FileNotADirectory(uri);
      }
      return existing;
    }, this.root);
  }

  private getEntry(uri: URI): Entry | undefined {
    return pathParts(uri).reduce<Entry | undefined>(
      (current, part) => (current?.type === vscode.FileType.Directory ? current.entries.get(part) : undefined),
      this.root
    );
  }

  // eslint-disable-next-line class-methods-use-this
  private basename(uri: URI): string {
    const name = pathParts(uri).at(-1);
    if (!name) {
      throw vscode.FileSystemError.NoPermissions(`Cannot write to root of ${uri.scheme}`);
    }
    return name;
  }
}
