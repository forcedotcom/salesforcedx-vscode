/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FileStat, DirectoryEntry } from './types/fileSystemTypes';
import { getVirtualFs, setFs } from '@salesforce/core/fs';
import { getServicesApi } from '@salesforce/effect-ext-utils';
import { Effect } from 'effect';
import { minimatch } from 'minimatch';
import * as vscode from 'vscode';
import {
  WORKSPACE_READ_FILE_REQUEST,
  WORKSPACE_STAT_REQUEST,
  WORKSPACE_READ_DIRECTORY_REQUEST,
  WORKSPACE_FIND_FILES_REQUEST,
  WORKSPACE_DELETE_FILE_REQUEST,
  type WorkspaceReadFileParams,
  type WorkspaceReadFileResult,
  type WorkspaceStatParams,
  type WorkspaceStatResult,
  type WorkspaceReadDirectoryParams,
  type WorkspaceReadDirectoryResult,
  type WorkspaceFindFilesParams,
  type WorkspaceFindFilesResult,
  type WorkspaceDeleteFileParams,
  type WorkspaceDeleteFileResult
} from './lspCustomRequests';

/** Either-shaped result from Effect.either (Left | Right) */
type EitherResult = { _tag: 'Left'; left: unknown } | { _tag: 'Right'; right: unknown };

function isEitherResult(x: unknown): x is EitherResult {
  if (typeof x !== 'object' || x === null || !('_tag' in x)) return false;
  const tag = Reflect.get(x, '_tag');
  return tag === 'Left' || tag === 'Right';
}

function isVscodeFileStat(x: unknown): x is vscode.FileStat {
  return typeof x === 'object' && x !== null && 'type' in x && 'ctime' in x && 'mtime' in x && 'size' in x;
}

/** Type guard for services that optionally expose getWorkspaceVolume (web). */
const hasGetWorkspaceVolume = (s: unknown): s is { getWorkspaceVolume?: () => import('memfs').Volume | undefined } =>
  typeof s === 'object' && s !== null && 'getWorkspaceVolume' in s;

/** Client that can handle LSP requests (Node or Browser LanguageClient). */
export type WorkspaceReadFileClient = {
  onRequest<P, R>(method: string, handler: (params: P) => Promise<R>): void;
};

const vscodeFileTypeToStatType = (vscodeType: vscode.FileType): 'file' | 'directory' =>
  vscodeType === vscode.FileType.Directory ? 'directory' : 'file';

function isCallable(u: unknown): u is (...args: unknown[]) => unknown {
  return typeof u === 'function';
}

function isObjectWithKeys(u: unknown): u is object & Record<string, unknown> {
  return typeof u === 'object' && u !== null;
}

/** Normalize unknown readdir entry to { name, isDir, isFile } without type assertions. */
function normalizeDirent(entry: unknown): { name: string; isDir: boolean; isFile: boolean } {
  let name = String(entry);
  let isDir = false;
  let isFile = true;
  if (isObjectWithKeys(entry) && 'name' in entry) {
    name = typeof entry.name === 'string' ? entry.name : String(entry);
    if (isCallable(entry.isDirectory)) {
      isDir = entry.isDirectory() === true;
    }

    isFile = isCallable(entry.isFile) ? entry.isFile() === true : !isDir;
  }
  return { name, isDir, isFile };
}

/**
 * Find files by pattern using the given fs (readdir + minimatch). Used for memfs only.
 * Caller should pass the virtual fs from getVirtualFs(volume) so we use the same volume as the workspace.
 */
async function findFilesWithFs(
  cwd: string,
  pattern: string,
  fs: { readdir: (path: string, opts: { withFileTypes: true }) => Promise<unknown[]> },
  log?: { appendLine(value: string): void }
): Promise<string[]> {
  const matches: string[] = [];
  async function walk(dirPath: string, relPrefix: string): Promise<void> {
    let entries: unknown[];
    try {
      const raw = await fs.readdir(dirPath, { withFileTypes: true });
      entries = Array.isArray(raw) ? raw : [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log?.appendLine(`[findFiles] memfs readdir("${dirPath}") error: ${msg}`);
      return;
    }
    const normalized = entries.map(normalizeDirent);
    if (relPrefix === '') {
      log?.appendLine(
        `[findFiles] memfs readdir("${dirPath}") entries=${normalized.length} names=[${normalized
          .slice(0, 10)
          .map(e => e.name)
          .join(', ')}${normalized.length > 10 ? '...' : ''}]`
      );
    }
    for (const e of normalized) {
      const relPath = relPrefix ? `${relPrefix}/${e.name}` : e.name;
      const fullPath = dirPath.endsWith('/') ? `${dirPath}${e.name}` : `${dirPath}/${e.name}`;
      if (e.isFile && minimatch(relPath, pattern, { matchBase: false })) {
        matches.push(relPath.replaceAll('\\', '/'));
      }
      if (e.isDir && !e.name.startsWith('.')) {
        await walk(fullPath, relPath);
      }
    }
  }
  await walk(cwd, '');
  log?.appendLine(`[findFiles] memfs walk done matches=${matches.length}`);
  return [...new Set(matches)].toSorted();
}

const vscodeStatToFileStat = (vstat: vscode.FileStat): FileStat => ({
  type: vscodeFileTypeToStatType(vstat.type),
  ctime: vstat.ctime,
  mtime: vstat.mtime,
  size: vstat.size,
  exists: true
});

/**
 * Register the workspace/readFile LSP request handler so the language server can request
 * file content from the client. The client uses FsService (from salesforcedx-vscode-services)
 * to read from the workspace, supporting both file:// and memfs:// in web.
 *
 * Call this from the extension after the language client has started. Only extensions that
 * have salesforcedx-vscode-services as an extensionDependency should use this.
 */
export const registerWorkspaceReadFileHandler = (client: WorkspaceReadFileClient): void => {
  // In web, point @salesforce/core fs (and thus glob) at the workspace Volume so findFiles sees memfs files.
  if (process.env.ESBUILD_PLATFORM === 'web') {
    const apiResult = Effect.runSync(Effect.either(getServicesApi));
    if (apiResult._tag === 'Right') {
      const services = apiResult.right.services;
      const volume = hasGetWorkspaceVolume(services) ? services.getWorkspaceVolume?.() : undefined;
      if (volume !== undefined && volume !== null) {
        setFs(getVirtualFs(volume));
      }
    }
  }

  const log = vscode.window.createOutputChannel('LWC workspace (client)');

  client.onRequest<WorkspaceReadFileParams, WorkspaceReadFileResult>(
    WORKSPACE_READ_FILE_REQUEST,
    async (params): Promise<WorkspaceReadFileResult> => {
      const { uri } = params;
      log.appendLine(`[readFile] request uri=${uri ?? '?'}`);
      const apiResult = Effect.runSync(Effect.either(getServicesApi));
      if (apiResult._tag === 'Left') {
        log.appendLine('[readFile] error: Services API not available');
        return { error: 'Services API not available' };
      }
      const api = apiResult.right;
      const FsService = api.services.FsService;
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FsService;
          return yield* fs.readFile(uri);
        }).pipe(Effect.provide(FsService.Default), Effect.either)
      );
      if (result._tag === 'Left') {
        const left = result.left;
        const message = left instanceof Error ? left.message : String(left);
        log.appendLine(`[readFile] error: ${message}`);
        return { error: message };
      }
      return { content: result.right };
    }
  );

  client.onRequest<WorkspaceStatParams, WorkspaceStatResult>(
    WORKSPACE_STAT_REQUEST,
    async (params): Promise<WorkspaceStatResult> => {
      const { uri } = params ?? {};
      log.appendLine(`[stat] request uri=${uri ?? '?'}`);
      const apiResult = Effect.runSync(Effect.either(getServicesApi));
      if (apiResult._tag === 'Left') {
        log.appendLine('[stat] error: Services API not available');
        return { error: 'Services API not available' };
      }
      const api = apiResult.right;
      const FsService = api.services.FsService;
      const raw = await Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FsService;
          return yield* fs.stat(uri);
        }).pipe(Effect.provide(FsService.Default), Effect.either)
      );
      if (!isEitherResult(raw)) {
        log.appendLine(`[stat] error uri=${uri ?? '?'}: unexpected result`);
        return { error: 'Unexpected result' };
      }
      if (raw._tag === 'Left') {
        const left = raw.left;
        const message = left instanceof Error ? left.message : String(left);
        const logMsg = message || `(no message) left=${JSON.stringify(left)}`;
        log.appendLine(`[stat] error uri=${uri ?? '?'}: ${logMsg}`);
        return { error: message || 'Unknown stat error' };
      }
      if (!isVscodeFileStat(raw.right)) {
        log.appendLine(`[stat] error uri=${uri ?? '?'}: invalid stat result`);
        return { error: 'Invalid stat result' };
      }
      const stat = vscodeStatToFileStat(raw.right);
      log.appendLine(`[stat] success uri=${uri} type=${stat.type} size=${stat.size}`);
      return { stat };
    }
  );

  client.onRequest<WorkspaceReadDirectoryParams, WorkspaceReadDirectoryResult>(
    WORKSPACE_READ_DIRECTORY_REQUEST,
    async (params): Promise<WorkspaceReadDirectoryResult> => {
      try {
        const { uri: uriStr } = params ?? {};
        log.appendLine(`[readDirectory] request uri=${uriStr ?? '?'}`);
        const uri = vscode.Uri.parse(uriStr);
        const entries: [string, vscode.FileType][] = await vscode.workspace.fs.readDirectory(uri);
        const result: DirectoryEntry[] = entries.map(([name, fileType]) => {
          const entryUri = vscode.Uri.joinPath(uri, name);
          return {
            name,
            type: vscodeFileTypeToStatType(fileType),
            uri: entryUri.toString()
          };
        });
        log.appendLine(`[readDirectory] success uri=${uriStr} entries=${result.length}`);
        return { entries: result };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log.appendLine(`[readDirectory] error: ${message}`);
        return { error: message };
      }
    }
  );

  const findFilesLog = vscode.window.createOutputChannel('LWC workspace/findFiles (client)');

  client.onRequest<WorkspaceFindFilesParams, WorkspaceFindFilesResult>(
    WORKSPACE_FIND_FILES_REQUEST,
    async (params): Promise<WorkspaceFindFilesResult> => {
      const { baseFolderUri, pattern } = params ?? {};
      const baseUri = vscode.Uri.parse(baseFolderUri);
      const p = pattern ?? '**/*';

      findFilesLog.appendLine(
        `[findFiles] request baseFolderUri=${baseFolderUri ?? '?'} pattern=${p} scheme=${baseUri.scheme}`
      );
      log.appendLine(`[findFiles] request baseFolderUri=${baseFolderUri ?? '?'} pattern=${p}`);

      try {
        let uris: string[];
        if (baseUri.scheme === 'memfs') {
          const cwd = baseUri.fsPath.replaceAll('\\', '/');
          findFilesLog.appendLine(`[findFiles] memfs: cwd=${cwd} pattern=${p}`);
          const apiResult = Effect.runSync(Effect.either(getServicesApi));
          if (apiResult._tag === 'Left') {
            findFilesLog.appendLine('[findFiles] memfs: Services API not available');
            uris = [];
          } else {
            const services = apiResult.right.services;
            const volume = hasGetWorkspaceVolume(services) ? services.getWorkspaceVolume?.() : undefined;
            if (volume === undefined || volume === null) {
              findFilesLog.appendLine('[findFiles] memfs: no workspace volume from services');
              uris = [];
            } else {
              const fs = getVirtualFs(volume);
              const fsPromises = fs.promises ?? fs;
              const readdir = fsPromises?.readdir ?? fs.readdir;
              if (!readdir) {
                findFilesLog.appendLine('[findFiles] memfs: virtual fs has no readdir');
                uris = [];
              } else {
                const matches = await findFilesWithFs(cwd, p, { readdir }, findFilesLog);
                uris = matches.map((rel: string) =>
                  vscode.Uri.joinPath(baseUri, ...rel.replaceAll('\\', '/').split('/').filter(Boolean)).toString()
                );
              }
            }
          }
        } else {
          const include = new vscode.RelativePattern(baseUri, p);
          findFilesLog.appendLine(
            `[findFiles] vscode.workspace.findFiles baseUri=${baseFolderUri ?? '?'} pattern=${p}`
          );
          const found = await vscode.workspace.findFiles(include);
          uris = found.map((u: vscode.Uri) => u.toString());
        }
        findFilesLog.appendLine(`[findFiles] returned ${uris.length} uris`);
        log.appendLine(`[findFiles] success pattern=${p} uris=${uris.length}`);
        return { uris };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : undefined;
        findFilesLog.appendLine(`[findFiles] findFiles failed with error: ${message}`);
        if (stack) {
          findFilesLog.appendLine(`[findFiles] stack: ${stack}`);
        }
        findFilesLog.appendLine('[findFiles] returning undefined');
        log.appendLine(`[findFiles] error: ${message}`);
        return { uris: undefined };
      }
    }
  );

  client.onRequest<WorkspaceDeleteFileParams, WorkspaceDeleteFileResult>(
    WORKSPACE_DELETE_FILE_REQUEST,
    async (params): Promise<WorkspaceDeleteFileResult> => {
      const { uri } = params ?? {};
      log.appendLine(`[deleteFile] request uri=${uri ?? '?'}`);
      const apiResult = Effect.runSync(Effect.either(getServicesApi));
      if (apiResult._tag === 'Left') {
        log.appendLine('[deleteFile] error: Services API not available');
        return { error: 'Services API not available' };
      }
      const api = apiResult.right;
      const FsService = api.services.FsService;
      const raw = await Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FsService;
          return yield* fs.deleteFile(uri);
        }).pipe(Effect.provide(FsService.Default), Effect.either)
      );
      if (!isEitherResult(raw)) {
        log.appendLine('[deleteFile] error: unexpected result');
        return { error: 'Unexpected result' };
      }
      if (raw._tag === 'Left') {
        const left = raw.left;
        const message = left instanceof Error ? left.message : String(left);
        log.appendLine(`[deleteFile] error: ${message}`);
        return { error: message };
      }
      log.appendLine(`[deleteFile] success uri=${uri}`);
      return {};
    }
  );
};
