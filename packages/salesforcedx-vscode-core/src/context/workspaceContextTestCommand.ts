/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { OrgUserInfo } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { getRuntime } from '../services/runtime';
import { WorkspaceContext } from './workspaceContext';

const TEST_COMMAND = 'sf.internal.workspaceContext.capture';
const SET_USERNAME_COMMAND = 'sf.internal.workspaceContext.setTargetOrgToUsername';
const STATE_FILE = '.workspace-context-state.json';
const E2E_TELEMETRY_TAG = 'e2e-test';

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

export const startWorkspaceContextTestCapture = async (extensionContext: vscode.ExtensionContext): Promise<void> => {
  if (vscode.workspace.getConfiguration('salesforcedx-vscode-core').get<string>('telemetry-tag') !== E2E_TELEMETRY_TAG)
    return;

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
    }),
    vscode.commands.registerCommand(SET_USERNAME_COMMAND, async () => {
      const username = WorkspaceContext.getInstance().username;
      if (!username) return;
      await getRuntime().runPromise(
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          yield* api.services.ConfigService.setTargetOrg(username);
          yield* api.services.ConnectionService.invalidateCachedConnections();
          yield* api.services.ConnectionService.getConnection();
        }).pipe(Effect.withSpan('WorkspaceContextTest.setTargetOrgToUsername'))
      );
    })
  );
  await vscode.commands.executeCommand(TEST_COMMAND);
};
