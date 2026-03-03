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
// eslint-disable-next-line no-restricted-imports
import { glob } from 'node:fs/promises';
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

/** Client that can handle LSP requests (Node or Browser LanguageClient). */
export type WorkspaceReadFileClient = {
  onRequest<P, R>(method: string, handler: (params: P) => Promise<R>): void;
};

const vscodeFileTypeToStatType = (vscodeType: vscode.FileType): 'file' | 'directory' =>
  vscodeType === vscode.FileType.Directory ? 'directory' : 'file';

/** Invoke glob's callback form (web polyfill). No type assertion: glob's types don't declare the callback overload. */
export const globWithCallback = (fn: unknown, pattern: string, cwd: string): Promise<string[]> => {
  if (typeof fn !== 'function') {
    return Promise.reject(new Error('glob callback API not available'));
  }
  return new Promise((resolve, reject) => {
    const callback = (err: Error | null, result?: string[]) => {
      if (err) reject(err);
      else resolve(Array.isArray(result) ? result : []);
    };
    Reflect.apply(fn, undefined, [pattern, { cwd }, callback]);
  });
};

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
      const svc = apiResult.right.services;
      const volume = svc.getWorkspaceVolume?.();
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
      const content = result.right;
      log.appendLine(`[readFile] success uri=${uri} size=${content?.length ?? 0}`);
      return { content };
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
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FsService;
          return yield* fs.stat(uri);
        }).pipe(Effect.provide(FsService.Default), Effect.either)
      );
      if (result._tag === 'Left') {
        const left = result.left;
        const message = left instanceof Error ? left.message : String(left);
        log.appendLine(`[stat] error: ${message}`);
        return { error: message };
      }
      const stat = vscodeStatToFileStat(result.right);
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
        const cwd = baseUri.fsPath;
        findFilesLog.appendLine(`[findFiles] glob pattern=${p} cwd=${cwd} scheme=${baseUri.scheme}`);
        let matches: string[] = [];
        try {
          for await (const match of glob(p, { cwd })) {
            matches.push(match);
          }
        } catch (globErr) {
          const msg = globErr instanceof Error ? globErr.message : String(globErr);
          if (msg.includes('callback must be a function')) {
            findFilesLog.appendLine('[findFiles] using glob callback API (web polyfill)');
            matches = await globWithCallback(glob, p, cwd);
          } else {
            throw globErr;
          }
        }
        const uris = matches.map((rel: string) =>
          vscode.Uri.joinPath(baseUri, ...rel.replaceAll('\\', '/').split('/').filter(Boolean)).toString()
        );
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
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FsService;
          return yield* fs.deleteFile(uri);
        }).pipe(Effect.provide(FsService.Default), Effect.either)
      );
      if (result._tag === 'Left') {
        const left = result.left;
        const message = left instanceof Error ? left.message : String(left);
        log.appendLine(`[deleteFile] error: ${message}`);
        return { error: message };
      }
      log.appendLine(`[deleteFile] success uri=${uri}`);
      return {};
    }
  );
};
