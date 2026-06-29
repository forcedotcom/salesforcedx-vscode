/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  buildAllServicesLayer,
  closeExtensionScope,
  ExtensionProviderService,
  getExtensionScope
} from '@salesforce/effect-ext-utils';
import type { SalesforceVSCodeOrgApi } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from './channels';
import {
  configSet,
  orgCreate,
  orgDisplay,
  orgListCleanCommand,
  orgLoginWeb,
  orgLoginWebDevHub,
  orgLogoutAll,
  orgLogoutDefault
} from './commands';
import { orgLoginAccessTokenCommand } from './commands/auth/orgLoginAccessToken';
import { orgDeleteDefaultCommand, orgDeleteUsernameCommand } from './commands/orgDelete';
import { orgDisplayDefaultCommand } from './commands/orgDisplay';
import { orgOpenCommand } from './commands/orgOpen';
import { ORG_DISPLAY_DEFAULT_COMMAND, ORG_LOGIN_ACCESS_TOKEN_COMMAND, ORG_OPEN_COMMAND } from './constants';
import { AllServicesLayer, getOrgRuntime, setAllServicesLayer } from './extensionProvider';
import { nls } from './messages';
import { createOrgPicker, setDefaultOrg } from './orgPicker/orgList';
import { checkForSoonToBeExpiredOrgs } from './util/orgUtil';

/** Register all org/auth commands */
const registerCommands = (): vscode.Disposable =>
  vscode.Disposable.from(
    vscode.commands.registerCommand('sf.config.set', configSet),
    vscode.commands.registerCommand('sf.org.login.web', orgLoginWeb),
    vscode.commands.registerCommand('sf.org.create', orgCreate),
    vscode.commands.registerCommand('sf.org.display.username', orgDisplay, {
      flag: '--target-org'
    }),
    vscode.commands.registerCommand('sf.org.login.web.dev.hub', orgLoginWebDevHub),
    vscode.commands.registerCommand('sf.org.logout.all', orgLogoutAll),
    vscode.commands.registerCommand('sf.org.logout.default', orgLogoutDefault)
  );

/** Initialize org picker and org status bar */
const initializeStatusBarItems = Effect.gen(function* () {
  yield* Effect.forkIn(createOrgPicker(), yield* getExtensionScope());

  // Register org picker commands
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const contextService = yield* api.services.ExtensionContextService;
  const context = yield* contextService.getContext;
  const setDefaultOrgCmd = vscode.commands.registerCommand('sf.set.default.org', setDefaultOrg);
  context.subscriptions.push(setDefaultOrgCmd);

  // alert user about orgs that are expiring soon
  yield* Effect.forkDaemon(checkForSoonToBeExpiredOrgs());
});

export const activate = async (extensionContext: vscode.ExtensionContext): Promise<SalesforceVSCodeOrgApi> => {
  console.log('Salesforce Org Management extension activated');

  const extensionScope = Effect.runSync(getExtensionScope());
  // fallbackDisplayName only fires if package.json displayName is absent; channel_name must match displayName ('Salesforce Org Management')
  setAllServicesLayer(buildAllServicesLayer(extensionContext, nls.localize('channel_name')));
  await activateEffect(extensionContext).pipe(Scope.extend(extensionScope), getOrgRuntime().runPromise);

  const api: SalesforceVSCodeOrgApi = {
    channelService
  };
  return api;
};

const activateEffect = Effect.fn('activation:salesforcedx-vscode-org')(function* (
  extensionContext: vscode.ExtensionContext
) {
  // Register output channel
  extensionContext.subscriptions.push(OUTPUT_CHANNEL, registerCommands());

  // Register Effect-based commands with AllServicesLayer for proper tracing
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);
  yield* registerCommand('sf.org.delete.default', orgDeleteDefaultCommand);
  yield* registerCommand('sf.org.delete.username', orgDeleteUsernameCommand);
  yield* registerCommand('sf.org.list.clean', orgListCleanCommand);
  yield* registerCommand(ORG_OPEN_COMMAND, orgOpenCommand);
  yield* registerCommand(ORG_DISPLAY_DEFAULT_COMMAND, orgDisplayDefaultCommand);
  yield* registerCommand(ORG_LOGIN_ACCESS_TOKEN_COMMAND, orgLoginAccessTokenCommand);

  // Initialize org picker and status bar
  yield* initializeStatusBarItems;
});

export const deactivate = (): void => {
  Effect.runSync(closeExtensionScope());
  console.log('Salesforce Org Management extension deactivated');
};

export type { SalesforceVSCodeOrgApi } from '@salesforce/salesforcedx-utils-vscode';
export type { OrgListCleanError } from './commands/orgList';
