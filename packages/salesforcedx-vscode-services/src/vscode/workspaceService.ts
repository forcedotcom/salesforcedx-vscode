/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { SdkLayer } from '../observability/spans';

type WorkspaceInfo = {
  /** includes the file:// or other schemeprefix */
  path: string;
  /** the path without the scheme prefix */
  fsPath: string;
  isEmpty: boolean;
  isVirtualFs: boolean;
};

const getWorkspaceInfoTask = Effect.sync((): WorkspaceInfo => {
  const folders = vscode.workspace.workspaceFolders;
  return {
    path: getPathWithSchema(folders?.[0]?.uri ?? vscode.Uri.parse('')),
    isEmpty: folders?.length === 0,
    isVirtualFs: folders?.[0]?.uri.scheme !== 'file',
    fsPath: folders?.[0]?.uri.fsPath ?? ''
  };
}).pipe(
  Effect.tap(info => Effect.annotateCurrentSpan(info)),
  Effect.tap(() =>
    Effect.annotateCurrentSpan({
      folders: vscode.workspace.workspaceFolders,
      isWeb: Global.isWeb,
      home: os.homedir(),
      workspaceName: vscode.workspace.name
    })
  ),
  Effect.withSpan('getWorkspaceInfoTask ( cache miss )'),
  Effect.provide(SdkLayer)
);

// Global cached workspace info - created once at module level
const globalCachedWorkspaceInfo = Effect.runSync(
  Effect.cached(getWorkspaceInfoTask).pipe(Effect.withSpan('getWorkspaceInfo'))
);

export class WorkspaceService extends Effect.Service<WorkspaceService>()('WorkspaceService', {
  succeed: {
    /** Get info about the workspace */
    getWorkspaceInfo: globalCachedWorkspaceInfo
  } as const
}) {}

const getPathWithSchema = (uri: vscode.Uri): string => (uri.scheme === 'file' ? uri.fsPath : uri.toString());
