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

export type WorkspaceService = {
  /** Get info about the workspace */
  readonly getWorkspaceDescription: Effect.Effect<WorkspaceDescription, never, never>;
};

export const WorkspaceService = Context.GenericTag<WorkspaceService>('WorkspaceService');

type WorkspaceDescription = {
  /** includes the file:// or other schemeprefix */
  path: string;
  /** the path without the scheme prefix */
  fsPath: string;
  isEmpty: boolean;
  isVirtualFs: boolean;
};

export const WorkspaceServiceLive = Layer.succeed(WorkspaceService, {
  getWorkspaceDescription: Effect.sync(() => {
    const folders = vscode.workspace.workspaceFolders;
    console.log(`Workspace folders: ${JSON.stringify(folders, null, 2)}`);
    console.log(`Workspace folders length: ${folders?.length}`);
    console.log(`Workspace name: ${vscode.workspace.name}`);
    console.log(`First folder URI: ${JSON.stringify(folders?.[0]?.uri ?? '', null, 2)}`);
    console.log('First folder fsPath:', folders?.[0]?.uri.fsPath);
    console.log(`PathWithSchema: ${getPathWithSchema(folders?.[0]?.uri ?? vscode.Uri.parse(''))}`);
    console.log(`home is ${os.homedir()}`);
    console.log(`isWeb: ${Global.isWeb}`);
    return {
      path: getPathWithSchema(folders?.[0]?.uri ?? vscode.Uri.parse('')),
      isEmpty: folders?.length === 0,
      isVirtualFs: folders?.[0]?.uri.scheme !== 'file',
      fsPath: folders?.[0]?.uri.fsPath ?? ''
    };
  })
});

const getPathWithSchema = (uri: vscode.Uri): string => (uri.scheme === 'file' ? uri.fsPath : uri.toString());
