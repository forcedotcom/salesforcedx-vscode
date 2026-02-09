/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { CancelResponse, ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { Duration } from 'effect';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import type { DefaultOrgInfoSchema } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { ORG_OPEN_COMMAND } from '../constants';
import { nls } from '../messages';
import { getAuthFieldsFor } from '../util/orgUtil';

// exported for test
export const isOrgExpired = async (targetOrgOrAlias: string): Promise<boolean> => {
  const authFields = await getAuthFieldsFor(targetOrgOrAlias);
  const expirationDate = authFields.expirationDate ? new Date(authFields.expirationDate) : undefined;
  return expirationDate ? expirationDate < new Date() : false;
};

export const setDefaultOrg = async (): Promise<CancelResponse | ContinueResponse<{}>> => {
  const quickPickStandardItemsMap = new Map<string, string>([
    [`$(plus) ${nls.localize('org_login_web_authorize_org_text')}`, 'sf.org.login.web'],
    [`$(plus) ${nls.localize('org_login_web_authorize_dev_hub_text')}`, 'sf.org.login.web.dev.hub'],
    [`$(plus) ${nls.localize('org_create_default_scratch_org_text')}`, 'sf.org.create'],
    [`$(plus) ${nls.localize('org_login_access_token_text')}`, 'sf.org.login.access.token'],
    [`$(plus) ${nls.localize('org_list_clean_text')}`, 'sf.org.list.clean']
  ]);

  const quickPickList = Array.from(quickPickStandardItemsMap.keys()).concat(
    (await AuthInfo.listAllAuthorizations())
      .filter(o => !o.isExpired)
      .map(o => (o.aliases?.length ? `${o.aliases.join(',')} - ${o.username}` : o.username))
  );

  const selection = await vscode.window.showQuickPick(quickPickList, {
    placeHolder: nls.localize('org_select_text')
  });

  if (!selection) {
    return { type: 'CANCEL' };
  }

  if (quickPickStandardItemsMap.has(selection)) {
    vscode.commands.executeCommand(quickPickStandardItemsMap.get(selection)!);
    return { type: 'CONTINUE', data: {} };
  }

  // Format is: "alias1,alias2,alias3 - username" or just "username"
  const lastDashIndex = selection.lastIndexOf(' - ');
  const usernameOrAlias = lastDashIndex !== -1 ? selection.substring(0, lastDashIndex) : selection;

  vscode.commands.executeCommand('sf.config.set', usernameOrAlias);
  return { type: 'CONTINUE', data: {} };
};

/** Create and initialize OrgList with Effect-based TargetOrgRef watching */
export const createOrgPicker = Effect.fn(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgPickerStatuBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 48);
  const orgOpenStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 49);

  yield* Effect.addFinalizer(() => Effect.sync(() => orgPickerStatuBarItem.dispose()));
  yield* Effect.addFinalizer(() => Effect.sync(() => orgOpenStatusBarItem.dispose()));

  orgPickerStatuBarItem.command = 'sf.set.default.org';
  orgPickerStatuBarItem.tooltip = nls.localize('status_bar_org_picker_tooltip');
  // we always show this one, even if there is no org
  orgPickerStatuBarItem.show();

  // these don't change, we just show/hide based on there being an org or
  orgOpenStatusBarItem.tooltip = nls.localize('status_bar_open_org_tooltip');
  orgOpenStatusBarItem.command = ORG_OPEN_COMMAND;
  orgOpenStatusBarItem.text = '$(browser)';

  // watch for org changes
  const targetOrgRef = yield* api.services.TargetOrgRef();

  yield* Effect.forkDaemon(
    Stream.concat(Stream.fromEffect(SubscriptionRef.get(targetOrgRef)), targetOrgRef.changes).pipe(
      Stream.tap(orgInfo => Effect.log('Org Extension:orgChange', orgInfo)),
      Stream.tap(orgInfo =>
        Effect.sync(() => (orgInfo.username ? orgOpenStatusBarItem.show() : orgOpenStatusBarItem.hide()))
      ),
      Stream.mapEffect(orgInfo => getStatusBarText(orgInfo)),
      Stream.runForEach(text => Effect.sync(() => (orgPickerStatuBarItem.text = text)))
    )
  );

  // These statusBarItems stay on the page until the extension is deactivated
  yield* Effect.sleep(Duration.infinity);
});

const getStatusBarText = Effect.fn('updateTargetOrgDisplay')(function* ({
  username,
  aliases,
  isScratch
}: typeof DefaultOrgInfoSchema.Type) {
  if (!username) {
    return nls.localize('missing_default_org');
  }
  const isExpired = isScratch ? yield* Effect.promise(() => isOrgExpired(username)) : false;

  return `${isExpired ? '$(warning)' : '$(plug)'} ${aliases?.[0] ?? username}`;
});
