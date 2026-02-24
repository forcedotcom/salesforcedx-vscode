/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FileStat, DirectoryEntry } from './types/fileSystemTypes';
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
  type WorkspaceReadFileParams,
  type WorkspaceReadFileResult,
  type WorkspaceStatParams,
  type WorkspaceStatResult,
  type WorkspaceReadDirectoryParams,
  type WorkspaceReadDirectoryResult,
  type WorkspaceFindFilesParams,
  type WorkspaceFindFilesResult
} from './lspCustomRequests';

/** Client that can handle LSP requests (Node or Browser LanguageClient). */
export type WorkspaceReadFileClient = {
  onRequest<P, R>(method: string, handler: (params: P) => Promise<R>): void;
};

const vscodeFileTypeToStatType = (vscodeType: vscode.FileType): 'file' | 'directory' =>
  vscodeType === vscode.FileType.Directory ? 'directory' : 'file';

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
  client.onRequest<WorkspaceReadFileParams, WorkspaceReadFileResult>(
    WORKSPACE_READ_FILE_REQUEST,
    async (params): Promise<WorkspaceReadFileResult> => {
      const { uri } = params;
      const apiResult = Effect.runSync(Effect.either(getServicesApi));
      if (apiResult._tag === 'Left') {
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
        const message = result.left instanceof Error ? result.left.message : String(result.left);
        return { error: message };
      }
      return { content: result.right };
    }
  );

  client.onRequest<WorkspaceStatParams, WorkspaceStatResult>(
    WORKSPACE_STAT_REQUEST,
    async (params): Promise<WorkspaceStatResult> => {
      console.log(`[LWC Init ${new Date().toISOString()}] workspace/stat handler invoked uri=${params?.uri ?? '?'}`);
      const { uri } = params;
      const apiResult = Effect.runSync(Effect.either(getServicesApi));
      if (apiResult._tag === 'Left') {
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
        const message = result.left instanceof Error ? result.left.message : String(result.left);
        return { error: message };
      }
      return { stat: vscodeStatToFileStat(result.right) };
    }
  );

  client.onRequest<WorkspaceReadDirectoryParams, WorkspaceReadDirectoryResult>(
    WORKSPACE_READ_DIRECTORY_REQUEST,
    async (params): Promise<WorkspaceReadDirectoryResult> => {
      try {
        const { uri: uriStr } = params;
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
        return { entries: result };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
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

      try {
        const cwd = baseUri.fsPath;
        findFilesLog.appendLine(`[findFiles] using fs.promises.glob (Node or web polyfill) pattern=${p} cwd=${cwd}`);
        const matches: string[] = [];
        for await (const m of glob(p, { cwd })) {
          matches.push(m);
        }
        const uris = matches.map((rel: string) =>
          vscode.Uri.joinPath(baseUri, ...rel.replaceAll('\\', '/').split('/').filter(Boolean)).toString()
        );
        findFilesLog.appendLine(`[findFiles] returned ${uris.length} uris`);
        return { uris };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : undefined;
        findFilesLog.appendLine(`[findFiles] glob failed with error: ${message}`);
        if (stack) {
          findFilesLog.appendLine(`[findFiles] stack: ${stack}`);
        }
        findFilesLog.appendLine('[findFiles] returning undefined');
        return { uris: undefined };
      }
    }
  );
};
