/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  NoWorkspaceOpenError,
  WorkspaceService,
  type WorkspaceInfo,
  type WorkspaceWithFolder
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

const workspaceInfo = Effect.sync((): WorkspaceInfo => {
  const folders = vscode.workspace.workspaceFolders;
  const uri = folders?.[0]?.uri ?? URI.parse('');
  const isVirtualFs = folders?.[0]?.uri.scheme !== 'file';
  const originalFsPath = folders?.[0]?.uri.fsPath ?? '';
  return {
    uri,
    path: uri.scheme === 'file' ? uri.fsPath : uri.toString(),
    isEmpty: !folders?.length,
    isVirtualFs,
    // vscode-uri can expose Windows separators on virtual filesystems in browser tests.
    fsPath: isVirtualFs ? originalFsPath.replaceAll('\\', '/') : originalFsPath,
    cwd: process.cwd()
  };
}).pipe(
  Effect.tap(info =>
    Effect.annotateCurrentSpan({
      ...info,
      folders: vscode.workspace.workspaceFolders,
      home: os.homedir(),
      workspaceName: vscode.workspace.name
    })
  ),
  Effect.withSpan('getWorkspaceInfoTask')
);

const isNonEmptyWorkspace = (info: WorkspaceInfo): info is WorkspaceWithFolder => !info.isEmpty;

/** Stable layer identity: later service slices reuse this layer rather than rebuilding workspace state. */
export const WorkspaceServiceLayer = Layer.succeed(
  WorkspaceService,
  WorkspaceService.of({
    // Always read fresh: web workspace folders can mount after layer acquisition.
    getWorkspaceInfo: Effect.fn('WorkspaceService.getWorkspaceInfo')(() => workspaceInfo),
    getWorkspaceInfoOrThrow: Effect.fn('WorkspaceService.getWorkspaceInfoOrThrow')(() =>
      workspaceInfo.pipe(
        Effect.filterOrFail(
          isNonEmptyWorkspace,
          () => new NoWorkspaceOpenError({ message: 'No workspace is currently open' })
        )
      )
    )
  })
);
