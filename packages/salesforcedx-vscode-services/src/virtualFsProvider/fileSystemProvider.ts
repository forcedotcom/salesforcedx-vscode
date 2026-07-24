/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// we disable this rule so the methods match the vscode interface
/* eslint-disable class-methods-use-this */
/* eslint-disable functional/no-throw-statements */
/* eslint-disable functional/no-try-statements */

import { fs } from '@salesforce/core/fs';
import type { MetadataType } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { isError, isString } from 'effect/Predicate';
import { Buffer } from 'node:buffer';
// eslint-disable-next-line no-restricted-imports
import type { Dirent } from 'node:fs';
import * as vscode from 'vscode';
import { Utils, type URI } from 'vscode-uri';
import { MetadataRegistryService } from '../core/metadataRegistryService';
import { unknownToErrorCause } from '../core/shared';
import { getServicesRuntime, isServicesRuntimeReady } from '../servicesRuntime';
import { joinPathWithBase } from '../vscode/uriUtils';
import { WorkspaceService } from '../vscode/workspaceService';
import { emitter } from './memfsWatcher';
import { VirtualFsProviderError } from './virtualFsProviderError';

/** Convert ENOENT errors to VS Code FileSystemError.FileNotFound */
const handleFileSystemError = (error: unknown, uri: URI): never => {
  if (isError(error) && 'code' in error && error.code === 'ENOENT') {
    throw vscode.FileSystemError.FileNotFound(uri);
  }
  throw error;
};

/** Extract SDR suffix from path: "MyClass.cls" -> "cls", "MyClass.cls-meta.xml" -> "cls" */
const suffixFromPath = (uri: URI): string | undefined => {
  const base = Utils.basename(uri);
  const metaMatch = base.match(/\.([^.]+)-meta\.xml$/);
  if (metaMatch) return metaMatch[1];
  const ext = Utils.extname(uri).slice(1);
  return ext || undefined;
};

/** Effect that uses MetadataRegistryService (cached) to resolve metadata type from URI */
const checkIsReadOnly = Effect.fn('isItReadOnly')(function* (readOnlyTypes: MetadataType[], uri: URI) {
  if (readOnlyTypes.length === 0) return false;
  const suffix = suffixFromPath(uri);
  if (!suffix) return false;
  const registryAccess = yield* MetadataRegistryService.getRegistryAccess();
  const metadataType = registryAccess.getTypeBySuffix(suffix);
  if (!metadataType) return false;
  return readOnlyTypes.some(opt => opt.id === metadataType.id);
});

/** Layer required to run isItReadOnly*/
export const isItReadOnlyLayer = Layer.mergeAll(MetadataRegistryService.Default, WorkspaceService.Default);

/**
 * Synchronous read-only check for the imperative FS boundary.
 * - empty readOnly → false without touching the runtime (hot path + setup-time timing).
 * - runtime ready → reuse activation-built services (shared caches).
 * - runtime not ready (defensive: non-empty readOnly before publish) → build a throwaway graph.
 */
const isItReadOnly = (readOnlyTypes: MetadataType[], uri: URI): boolean => {
  if (readOnlyTypes.length === 0) return false;
  return isServicesRuntimeReady()
    ? getServicesRuntime().pipe(
        Effect.map(runtime => runtime.runSync(checkIsReadOnly(readOnlyTypes, uri))),
        Effect.runSync
      )
    : checkIsReadOnly(readOnlyTypes, uri).pipe(Effect.provide(isItReadOnlyLayer), Effect.runSync);
};

export class FsProvider implements vscode.FileSystemProvider {
  public readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = emitter.event;
  public readOnly: MetadataType[] = [];

  public exists(uri: URI): boolean {
    return fs.existsSync(uri.path);
  }

  public async stat(uri: URI): Promise<vscode.FileStat> {
    try {
      const stats = fs.statSync(uri.path);

      return {
        type: stats.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
        ctime: stats.ctimeMs,
        mtime: stats.mtimeMs,
        size: stats.size,
        ...(isItReadOnly(this.readOnly, uri) ? { permissions: vscode.FilePermission.Readonly } : {})
      };
    } catch (error) {
      return handleFileSystemError(error, uri);
    }
  }

  public readDirectory(uri: URI): [string, vscode.FileType][] {
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return (fs.readdirSync(uri.path, { withFileTypes: true }) as Dirent[]).map(dirent => [
        dirent.name,
        dirent.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File
      ]);
    } catch (error) {
      return handleFileSystemError(error, uri);
    }
  }

  public async createDirectory(uri: URI): Promise<void> {
    await fs.promises.mkdir(uri.path, { recursive: true });
    emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
  }

  public readFile(uri: URI): Uint8Array {
    try {
      // memfs types are loose around readFileSync
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return new Uint8Array(fs.readFileSync(uri.path) as Buffer);
    } catch (error) {
      return handleFileSystemError(error, uri);
    }
  }

  public async writeFile(
    uri: URI,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): Promise<void> {
    if (isItReadOnly(this.readOnly, uri)) {
      throw vscode.FileSystemError.NoPermissions(uri);
    }
    const program = Effect.sync(() => {
      if (!options.create && !this.exists(uri)) {
        return Effect.fail(vscode.FileSystemError.FileNotFound(uri));
      }
      if (!options.overwrite && this.exists(uri)) {
        return Effect.fail(vscode.FileSystemError.FileExists(uri));
      }
      return Effect.void;
    }).pipe(
      // Write file to filesystem
      Effect.flatMap(() =>
        Effect.tryPromise({
          try: () => fs.promises.writeFile(uri.path, Buffer.from(content)),
          catch: e => new VirtualFsProviderError({ ...unknownToErrorCause(e), message: 'writeFile', path: uri.path })
        })
      )
    );

    await Effect.runPromise(Effect.scoped(program));

    emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  public async delete(uri: URI, options: { recursive: boolean }): Promise<void> {
    if (isItReadOnly(this.readOnly, uri)) {
      throw vscode.FileSystemError.NoPermissions(uri);
    }
    await fs.promises.rm(uri.path, { recursive: options.recursive, force: true });
    emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  public async rename(oldUri: URI, newUri: URI, options: { overwrite: boolean }): Promise<void> {
    if (isItReadOnly(this.readOnly, oldUri)) {
      throw vscode.FileSystemError.NoPermissions(oldUri);
    }
    if (!options.overwrite && this.exists(newUri)) {
      throw vscode.FileSystemError.FileExists(newUri);
    }
    await fs.promises.rename(oldUri.path, newUri.path);

    emitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri }
    ]);
  }

  public watch(_uri: URI, _options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  /**
   * Find files by glob. baseUri optional: when provided (via RelativePattern), search under that URI only; otherwise use workspace folder.
   * The 4 param is usually a cancellation token.  That is omitted here because there's no way to interrupt the glob operation..
   */
  public async findFiles(
    include: vscode.GlobPattern,
    exclude?: vscode.GlobPattern | null,
    maxResults?: number
  ): Promise<URI[]> {
    const pattern = isString(include) ? include : include.pattern;
    const baseUri =
      (typeof include === 'object' && 'baseUri' in include ? include.baseUri : undefined) ??
      vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!baseUri) return [];
    const excludeArr = exclude == null ? undefined : isString(exclude) ? [exclude] : [exclude.pattern];
    // Only runs on web (memfs); node:fs.glob returns AsyncIterator but we never hit that path
    // this is fixed in higher memfs versions, but there's other conflicts there (would break sfdx-core support for node 20)
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- web-only, memfs returns Promise<string[]>
    const matches = await (fs.promises.glob(pattern, {
      cwd: baseUri.path,
      exclude: excludeArr
    }) as unknown as Promise<string[]>);
    return (
      matches
        .map(p => joinPathWithBase(baseUri, p))
        // current memfs doesn't have the Dirents option so we need to filter out directories
        .filter(uri => !fs.statSync(uri.path).isDirectory())
        .slice(0, maxResults ?? Infinity)
    );
  }
}
