/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgUserInfo } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { WorkspaceContext } from './workspaceContext';

const TEST_COMMAND = 'sf.internal.workspaceContext.capture';
const STATE_FILE = '.workspace-context-state.json';

type WorkspaceContextTestState = {
  eventCount: number;
  event?: OrgUserInfo;
  getters: OrgUserInfo & { orgId?: string };
};

const writeState = (state: WorkspaceContextTestState): Thenable<void> => {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  return workspace
    ? vscode.workspace.fs.writeFile(vscode.Uri.joinPath(workspace.uri, STATE_FILE), Buffer.from(JSON.stringify(state)))
    : Promise.resolve();
};

export const registerWorkspaceContextTestCommand = (extensionContext: vscode.ExtensionContext): void => {
  if (extensionContext.extensionMode !== vscode.ExtensionMode.Development) return;

  extensionContext.subscriptions.push(
    vscode.commands.registerCommand(TEST_COMMAND, async () => {
      const workspaceContext = WorkspaceContext.getInstance();
      let state: WorkspaceContextTestState = {
        eventCount: 0,
        getters: {
          username: workspaceContext.username,
          alias: workspaceContext.alias,
          orgId: workspaceContext.orgId
        }
      };
      const subscription = workspaceContext.onOrgChange(event => {
        state = {
          eventCount: state.eventCount + 1,
          event,
          getters: {
            username: workspaceContext.username,
            alias: workspaceContext.alias,
            orgId: workspaceContext.orgId
          }
        };
        return writeState(state);
      });
      extensionContext.subscriptions.push(subscription);
      await writeState(state);
    })
  );
};

export const startWorkspaceContextTestCapture = async (): Promise<void> =>
  vscode.commands.executeCommand(TEST_COMMAND);
