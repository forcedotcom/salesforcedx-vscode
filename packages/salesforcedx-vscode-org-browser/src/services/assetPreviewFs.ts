/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

export const ASSET_PREVIEW_SCHEME = 'sf-metadata-preview';

const now = () => Date.now();

/* eslint-disable functional/no-throw-statements, class-methods-use-this */
export class AssetPreviewFs implements vscode.FileSystemProvider {
  private readonly files = new Map<string, { data: Uint8Array; ctime: number; mtime: number }>();
  private readonly changeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  public readonly onDidChangeFile = this.changeEmitter.event;

  public watch(): vscode.Disposable {
    return new vscode.Disposable(() => undefined);
  }

  public stat(uri: URI): vscode.FileStat {
    const entry = this.files.get(uri.path);
    if (!entry) throw vscode.FileSystemError.FileNotFound(uri);
    return { type: vscode.FileType.File, ctime: entry.ctime, mtime: entry.mtime, size: entry.data.length };
  }

  public readDirectory(): [string, vscode.FileType][] {
    return [];
  }

  public readFile(uri: URI): Uint8Array {
    const entry = this.files.get(uri.path);
    if (!entry) throw vscode.FileSystemError.FileNotFound(uri);
    return entry.data;
  }

  public writeFile(uri: URI): void {
    throw vscode.FileSystemError.NoPermissions(uri);
  }

  public createDirectory(uri: URI): void {
    throw vscode.FileSystemError.NoPermissions(uri);
  }

  public delete(uri: URI): void {
    throw vscode.FileSystemError.NoPermissions(uri);
  }

  public rename(oldUri: URI): void {
    throw vscode.FileSystemError.NoPermissions(oldUri);
  }

  public writeFileInternal(uri: URI, data: Uint8Array): void {
    const existing = this.files.get(uri.path);
    this.files.set(uri.path, { data, ctime: existing?.ctime ?? now(), mtime: now() });
    this.changeEmitter.fire([{ type: existing ? vscode.FileChangeType.Changed : vscode.FileChangeType.Created, uri }]);
  }

  public clear(): void {
    const paths = [...this.files.keys()];
    this.files.clear();
    if (paths.length > 0) {
      this.changeEmitter.fire(
        paths.map(p => ({
          type: vscode.FileChangeType.Deleted,
          uri: URI.from({ scheme: ASSET_PREVIEW_SCHEME, path: p })
        }))
      );
    }
  }
}
/* eslint-enable functional/no-throw-statements, class-methods-use-this */
