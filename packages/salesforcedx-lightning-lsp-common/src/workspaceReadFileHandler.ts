/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FileStat, DirectoryEntry } from './types/fileSystemTypes';
import { getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
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

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const isVscodeFileStat = (x: unknown): x is vscode.FileStat =>
  typeof x === 'object' && x !== null && 'type' in x && 'ctime' in x && 'mtime' in x && 'size' in x;

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

const getFs = Effect.flatMap(getServicesApi, api =>
  Effect.provide(api.services.FsService, api.services.FsService.Default)
);

const logTo = (channel: vscode.OutputChannel, msg: string) => Effect.sync(() => channel.appendLine(msg));

/**
 * Register the workspace/readFile LSP request handler so the language server can request
 * file content from the client. The client uses FsService (from salesforcedx-vscode-services)
 * to read from the workspace, supporting both file:// and memfs:// in web.
 *
 * Call this from the extension after the language client has started. Only extensions that
 * have salesforcedx-vscode-services as an extensionDependency should use this.
 */
export const registerWorkspaceReadFileHandler = (client: WorkspaceReadFileClient): void => {
  const log = vscode.window.createOutputChannel('LWC workspace (client)');
  const findFilesLog = vscode.window.createOutputChannel('LWC workspace/findFiles (client)');

  const handleReadFile = Effect.fn('WorkspaceHandler.readFile')(function* (params: WorkspaceReadFileParams) {
    const { uri } = params;
    yield* logTo(log, `[readFile] request uri=${uri.toString()}`);
    const fs = yield* getFs;
    const content = yield* fs.readFile(uri);
    yield* logTo(log, '[readFile] success');
    return { content };
  });

  const handleStat = Effect.fn('WorkspaceHandler.stat')(function* (params: WorkspaceStatParams) {
    const { uri } = params;
    yield* logTo(log, `[stat] request uri=${uri.toString()}`);
    const fs = yield* getFs;
    const vstat = yield* fs.stat(uri.toString());
    if (!isVscodeFileStat(vstat)) yield* Effect.fail(new Error('Invalid stat result'));
    const stat = vscodeStatToFileStat(vstat);
    yield* logTo(log, `[stat] success uri=${uri.toString()} type=${stat.type} size=${stat.size}`);
    return { stat };
  });

  const handleReadDirectory = Effect.fn('WorkspaceHandler.readDirectory')(function* (
    params: WorkspaceReadDirectoryParams
  ) {
    const { uri } = params;
    yield* logTo(log, `[readDirectory] request uri=${uri.toString()}`);
    const entries = yield* Effect.tryPromise(() => vscode.workspace.fs.readDirectory(uri));
    const result: DirectoryEntry[] = entries.map(([name, fileType]) => ({
      name,
      type: vscodeFileTypeToStatType(fileType),
      uri: vscode.Uri.joinPath(uri, name).toString()
    }));
    yield* logTo(log, `[readDirectory] success uri=${uri.toString()} entries=${result.length}`);
    return { entries: result };
  });

  const handleFindFiles = Effect.fn('WorkspaceHandler.findFiles')(function* (params: WorkspaceFindFilesParams) {
    const { baseFolderUri, pattern } = params;
    const baseUri = vscode.Uri.parse(baseFolderUri);
    yield* logTo(
      findFilesLog,
      `[findFiles] request baseFolderUri=${baseFolderUri} pattern=${pattern} scheme=${baseUri.scheme}`
    );
    yield* logTo(log, `[findFiles] request baseFolderUri=${baseFolderUri} pattern=${pattern}`);
    const fs = yield* getFs;
    const uris = yield* fs.findFiles(new vscode.RelativePattern(baseUri, pattern));
    const urisStr = uris.map((u: vscode.Uri) => u.toString());
    yield* logTo(findFilesLog, `[findFiles] returned ${urisStr.length} uris`);
    yield* logTo(log, `[findFiles] success pattern=${pattern} uris=${urisStr.length}`);
    return { uris: urisStr };
  });

  const handleDeleteFile = Effect.fn('WorkspaceHandler.deleteFile')(function* (params: WorkspaceDeleteFileParams) {
    const { uri } = params;
    yield* logTo(log, `[deleteFile] request uri=${uri}`);
    const fs = yield* getFs;
    yield* fs.deleteFile(uri);
    yield* logTo(log, `[deleteFile] success uri=${uri}`);
    return {};
  });

  client.onRequest<WorkspaceReadFileParams, WorkspaceReadFileResult>(WORKSPACE_READ_FILE_REQUEST, params =>
    handleReadFile(params).pipe(
      Effect.catchAll(e =>
        Effect.sync(() => {
          log.appendLine(`[readFile] error: ${errorMessage(e)}`);
          return { error: errorMessage(e) };
        })
      ),
      Effect.runPromise
    )
  );

  client.onRequest<WorkspaceStatParams, WorkspaceStatResult>(WORKSPACE_STAT_REQUEST, params =>
    handleStat(params).pipe(
      Effect.catchAll(e =>
        Effect.sync(() => {
          log.appendLine(
            `[stat] error uri=${params.uri.toString()}: ${errorMessage(e) || `(no message) left=${JSON.stringify(e)}`}`
          );
          return { error: errorMessage(e) || 'Unknown stat error' };
        })
      ),
      Effect.runPromise
    )
  );

  client.onRequest<WorkspaceReadDirectoryParams, WorkspaceReadDirectoryResult>(
    WORKSPACE_READ_DIRECTORY_REQUEST,
    params =>
      handleReadDirectory(params).pipe(
        Effect.catchAll(e =>
          Effect.sync(() => {
            log.appendLine(`[readDirectory] error: ${errorMessage(e)}`);
            return { error: errorMessage(e) };
          })
        ),
        Effect.runPromise
      )
  );

  client.onRequest<WorkspaceFindFilesParams, WorkspaceFindFilesResult>(WORKSPACE_FIND_FILES_REQUEST, params =>
    handleFindFiles(params).pipe(
      Effect.catchAll(e =>
        Effect.sync(() => {
          const message = errorMessage(e);
          const stack = e instanceof Error ? e.stack : undefined;
          findFilesLog.appendLine(`[findFiles] error: ${message}`);
          if (stack) findFilesLog.appendLine(`[findFiles] stack: ${stack}`);
          findFilesLog.appendLine('[findFiles] returning undefined');
          log.appendLine(`[findFiles] error: ${message}`);
          return { uris: undefined };
        })
      ),
      Effect.runPromise
    )
  );

  client.onRequest<WorkspaceDeleteFileParams, WorkspaceDeleteFileResult>(WORKSPACE_DELETE_FILE_REQUEST, params =>
    handleDeleteFile(params).pipe(
      Effect.catchAll(e =>
        Effect.sync(() => {
          log.appendLine(`[deleteFile] error: ${errorMessage(e)}`);
          return { error: errorMessage(e) };
        })
      ),
      Effect.runPromise
    )
  );
};
