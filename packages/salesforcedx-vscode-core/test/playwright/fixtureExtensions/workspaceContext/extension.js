/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const Context = require('effect/Context');
const Effect = require('effect/Effect');
const vscode = require('vscode');

const CORE_EXTENSION_ID = 'salesforce.salesforcedx-vscode-core';
const SERVICES_EXTENSION_ID = 'salesforce.salesforcedx-vscode-services';
const SET_USERNAME_COMMAND = 'sf.internal.workspaceContext.setTargetOrgToUsername';
const STATE_FILE = '.workspace-context-state.json';

const getExtensionApi = async id => {
  const extension = vscode.extensions.getExtension(id);
  if (!extension) throw new Error(`Required extension ${id} is not installed`);
  return extension.isActive ? extension.exports : extension.activate();
};

const activate = async extensionContext => {
  const coreApi = await getExtensionApi(CORE_EXTENSION_ID);
  const servicesApi = await getExtensionApi(SERVICES_EXTENSION_ID);
  const workspaceContext = coreApi.services.WorkspaceContext.getInstance();
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) throw new Error('Workspace Context Playwright requires an open workspace');

  const stateUri = vscode.Uri.joinPath(workspace.uri, STATE_FILE);
  const writeState = state => vscode.workspace.fs.writeFile(stateUri, Buffer.from(JSON.stringify(state)));
  let state = {
    eventCount: 0,
    getters: {
      username: workspaceContext.username,
      alias: workspaceContext.alias,
      orgId: workspaceContext.orgId
    }
  };

  extensionContext.subscriptions.push(
    workspaceContext.onOrgChange(event => {
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
    }),
    vscode.commands.registerCommand(SET_USERNAME_COMMAND, async () => {
      const username = workspaceContext.username;
      if (!username) throw new Error('WorkspaceContext has no username');
      const dependencies = servicesApi.services.prebuiltServicesDependencies;
      const configService = Context.get(dependencies, servicesApi.services.ConfigService);
      const connectionService = Context.get(dependencies, servicesApi.services.ConnectionService);
      await Effect.runPromise(
        configService
          .setTargetOrg(username)
          .pipe(Effect.zipRight(connectionService.invalidateCachedConnections()), Effect.zipRight(connectionService.getConnection()))
      );
    })
  );

  await writeState(state);
};

module.exports = { activate };
