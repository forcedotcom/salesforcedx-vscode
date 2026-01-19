/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getPathWithSchema } from './paths';

type WorkspaceInfo = {
  uri: URI;
  /** includes the file:// or other schemeprefix */
  path: string;
  /** the path without the scheme prefix */
  fsPath: string;
  isEmpty: boolean;
  isVirtualFs: boolean;
  cwd: string;
};

type WorkspaceWithFolder = WorkspaceInfo & {
  isEmpty: false;
};

const getWorkspaceInfoTask = Effect.sync((): WorkspaceInfo => {
  const folders = vscode.workspace.workspaceFolders;
  const isVirtualFs = folders?.[0]?.uri.scheme !== 'file';
  const originalFsPath = folders?.[0]?.uri.fsPath ?? '';
  return {
    uri: folders?.[0]?.uri ?? URI.parse(''),
    path: getPathWithSchema(folders?.[0]?.uri ?? URI.parse('')),
    isEmpty: folders?.length === 0,
    isVirtualFs,
    // in e2e tests, but not on local runs, the path had windows-style \\ separators
    // vscode-uri implementation: https://github.com/microsoft/vscode-uri/blob/65786c7aef8aa1d142fedfde76073cc3549736d2/src/platform.ts#L19C18-L19C37
    // finds the string "windows" in the useragent in the runner.  I haven't found a way to set that to not have the word Windows in it
    // this could cause problems in other places, too.
    fsPath: isVirtualFs ? originalFsPath.replaceAll('\\', '/') : originalFsPath,
    cwd: process.cwd()
  };
}).pipe(
  Effect.tap(info => Effect.annotateCurrentSpan(info)),
  Effect.tap(() =>
    Effect.annotateCurrentSpan({
      folders: vscode.workspace.workspaceFolders,
      home: os.homedir(),
      workspaceName: vscode.workspace.name
    })
  ),
  Effect.withSpan('getWorkspaceInfoTask ( cache miss )')
);

// Global cached workspace info - created once at module level
const globalCachedWorkspaceInfo = Effect.runSync(
  Effect.cached(getWorkspaceInfoTask).pipe(Effect.withSpan('getWorkspaceInfo'))
);

export class WorkspaceService extends Effect.Service<WorkspaceService>()('WorkspaceService', {
  succeed: {
    /** Get info about the workspace */
    getWorkspaceInfo: globalCachedWorkspaceInfo,

    /** GetWorkspaceInfo, throws if there is not one open */
    getWorkspaceInfoOrThrow: globalCachedWorkspaceInfo.pipe(
      Effect.flatMap(info =>
        isNonEmptyWorkspace(info) ? Effect.succeed(info) : Effect.fail(new NoWorkspaceOpenError())
      )
    )
  } as const
}) {}

const isNonEmptyWorkspace = (info: WorkspaceInfo): info is WorkspaceWithFolder => !info.isEmpty;

export class NoWorkspaceOpenError extends Data.TaggedError('NoWorkspaceOpenError')<{}> {}
