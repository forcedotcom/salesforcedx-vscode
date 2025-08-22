/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core';
import { Context, Effect, Layer } from 'effect';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { SdkLayer } from '../observability/spans';

export type WorkspaceService = {
  /** Get info about the workspace */
  readonly getWorkspaceInfo: Effect.Effect<WorkspaceInfo, never, never>;
};

export const WorkspaceService = Context.GenericTag<WorkspaceService>('WorkspaceService');

type WorkspaceInfo = {
  /** includes the file:// or other schemeprefix */
  path: string;
  /** the path without the scheme prefix */
  fsPath: string;
  isEmpty: boolean;
  isVirtualFs: boolean;
};

const getWorkspaceInfoTask = Effect.sync(() => {
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
  Effect.withSpan('getWorkspaceInfo'),
  Effect.provide(SdkLayer)
);

export const WorkspaceServiceLive = Layer.scoped(
  WorkspaceService,
  Effect.gen(function* () {
    // Create the cached effect once at service creation time
    const cachedGetWorkspaceInfo = yield* Effect.cached(getWorkspaceInfoTask);

    return {
      getWorkspaceInfo: cachedGetWorkspaceInfo
    };
  })
);

const getPathWithSchema = (uri: vscode.Uri): string => (uri.scheme === 'file' ? uri.fsPath : uri.toString());
