/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { ExecuteAnonymousResult } from 'salesforcedx-vscode-services';
import { Utils } from 'vscode-uri';

const DEBUG_LOGS_SUBPATH = ['.sfdx', 'tools', 'debug', 'logs'] as const;
const EXEC_ANON_FOLDER_PREFIX = 'execute-anonymous-';

const getLogsDirUri = Effect.fn('LogStorage.getLogsDirUri')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  return Utils.joinPath(workspaceInfo.uri, ...DEBUG_LOGS_SUBPATH);
});

/** Resolve the debug logs directory URI. Caller typically creates it before use. */
export const getDebugLogsDir = Effect.fn('LogStorage.getDebugLogsDir')(function* () {
  return yield* getLogsDirUri();
});

/** Log IDs already saved in execute-anonymous folders. Used by poller to avoid duplicates. */
export const getExecAnonLogIds = Effect.fn('LogStorage.getExecAnonLogIds')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const dirUri = yield* getLogsDirUri();
  const entries = yield* api.services.FsService.readDirectory(dirUri).pipe(Effect.catchAll(() => Effect.succeed([])));
  const idResults = yield* Effect.all(
    entries.map(entryUri =>
      Effect.gen(function* () {
        const name = Utils.basename(entryUri);
        if (!name.startsWith(EXEC_ANON_FOLDER_PREFIX)) return undefined;
        const isDir = yield* api.services.FsService.isDirectory(entryUri);
        if (!isDir) return undefined;
        const match = name.match(/^execute-anonymous-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-(.+)$/);
        return match?.[1];
      })
    )
  );
  return new Set(idResults.filter((id): id is string => id !== undefined));
});

/** Write log body to {logId}.log, return the file URI. */
export const saveLog = Effect.fn('LogStorage.saveLog')(function* (logId: string, body: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const dirUri = yield* getLogsDirUri();
  const fileUri = Utils.joinPath(dirUri, `${logId}.log`);
  yield* api.services.FsService.writeFile(fileUri, body);
  return fileUri;
});

/** Save log to disk and open in editor. */
export const saveAndOpenLog = Effect.fn('LogStorage.saveAndOpenLog')(function* (logId: string, body: string) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fileUri = yield* saveLog(logId, body);
  yield* api.services.FsService.showTextDocument(fileUri);
});

type ResultWithExecutedAt = ExecuteAnonymousResult & { executedAt: string; logId?: string };

/** Save execute-anonymous to a folder: result.json, script.apex, debug.log (raw Apex log format). Returns logUri for caller to open on demand. */
export const saveExecResult = Effect.fn('LogStorage.saveExecResult')(function* (
  code: string,
  result: ExecuteAnonymousResult,
  logBody: string,
  logId?: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const dirUri = yield* getLogsDirUri();
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-').slice(0, 19);
  const folderName = logId
    ? `${EXEC_ANON_FOLDER_PREFIX}${timestamp}-${logId}`
    : `${EXEC_ANON_FOLDER_PREFIX}${timestamp}`;
  const runDirUri = Utils.joinPath(dirUri, folderName);
  yield* api.services.FsService.createDirectory(runDirUri);

  const resultWithExecutedAt: ResultWithExecutedAt = {
    ...result,
    executedAt: new Date().toISOString(),
    ...(logId !== undefined && { logId })
  };
  yield* Effect.all(
    [
      api.services.FsService.writeFile(
        Utils.joinPath(runDirUri, 'result.json'),
        JSON.stringify(resultWithExecutedAt, undefined, 2)
      ),
      api.services.FsService.writeFile(Utils.joinPath(runDirUri, 'script.apex'), code),
      api.services.FsService.writeFile(Utils.joinPath(runDirUri, 'debug.log'), logBody)
    ],
    { concurrency: 'unbounded' }
  );

  return Utils.joinPath(runDirUri, 'debug.log');
});
