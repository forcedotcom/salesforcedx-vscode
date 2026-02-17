/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, OrgAuthorization } from '@salesforce/core';
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
import { determineOrgMarkers, getAuthFieldsFor, getDefaultOrgConfiguration } from '../util/orgUtil';

/** Org type derived from OrgAuthorization (no async calls) */
const getOrgTypeFromAuth = (orgAuth: OrgAuthorization): 'DevHub' | 'Sandbox' | 'Scratch' | 'Org' => {
  if (orgAuth.isDevHub) {
    return 'DevHub';
  }
  if (orgAuth.isSandbox) {
    return 'Sandbox';
  }
  if (orgAuth.isScratchOrg) {
    return 'Scratch';
  }
  return 'Org';
};

/** Codicon name for org type */
const getIconForOrgType = (type: 'DevHub' | 'Sandbox' | 'Scratch' | 'Org'): string => {
  switch (type) {
    case 'DevHub':
      return '$(server)';
    case 'Sandbox':
      return '$(beaker)';
    case 'Scratch':
      return '$(zap)';
    default:
      return '$(cloud)';
  }
};

/** QuickPickItem for org selection with metadata for handling */
export interface OrgQuickPickItem extends vscode.QuickPickItem {
  orgUsername?: string;
  orgAlias?: string;
  commandId?: string;
}

/** First-position icons: default markers (🌳/🍁) when applicable, then type icon */
const getFirstIcons = (defaultMarkers: string, typeIcon: string): string => {
  const markers = defaultMarkers ? (defaultMarkers === '🌳,🍁' ? '🌳🍁' : defaultMarkers) : '';
  return markers ? `${markers} ${typeIcon}` : typeIcon;
};

/** Sort: Scratch, Sandbox, Other, DevHub, Defaults; within each, alphabetical by alias or username. Exported for test. */
export const sortOrgs = (
  orgs: OrgAuthorization[],
  defaultConfig: Awaited<ReturnType<typeof getDefaultOrgConfiguration>>
): OrgAuthorization[] => {
  const getPrimaryKey = (o: OrgAuthorization): number => {
    const markers = determineOrgMarkers(o, defaultConfig);
    if (markers) return 4; // Defaults last
    if (o.isScratchOrg) return 0;
    if (o.isSandbox) return 1;
    if (o.isDevHub) return 3;
    return 2; // Org (other)
  };
  const getSecondaryKey = (o: OrgAuthorization): string =>
    (o.aliases?.[0] ?? o.username ?? '').toLowerCase();

  return [...orgs].toSorted((a, b) => {
    const pa = getPrimaryKey(a);
    const pb = getPrimaryKey(b);
    if (pa !== pb) return pa - pb;
    return getSecondaryKey(a).localeCompare(getSecondaryKey(b));
  });
};

/** Build QuickPick items from orgs with icons | alias(s) | type | username */
const buildOrgQuickPickItems = (
  orgs: OrgAuthorization[],
  defaultConfig: Awaited<ReturnType<typeof getDefaultOrgConfiguration>>
): OrgQuickPickItem[] =>
  orgs.map(orgAuth => {
    const defaultMarkers = determineOrgMarkers(orgAuth, defaultConfig);
    const orgType = getOrgTypeFromAuth(orgAuth);
    const typeIcon = getIconForOrgType(orgType);
    const firstIcons = getFirstIcons(defaultMarkers, typeIcon);
    const aliasDisplay =
      orgAuth.aliases && orgAuth.aliases.length > 0 ? orgAuth.aliases.join(', ') : null;
    const label =
      aliasDisplay !== null ? `${firstIcons} | ${aliasDisplay} | ${orgAuth.username}` : `${firstIcons} | ${orgAuth.username}`;
    return {
      label,
      detail: orgAuth.error ?? undefined,
      orgUsername: orgAuth.username,
      orgAlias: orgAuth.aliases?.[0]
    };
  });

/** Action items for SFDX commands */
const ACTION_ITEMS: OrgQuickPickItem[] = [
  {
    label: `$(plus) ${nls.localize('org_login_web_authorize_org_text')}`,
    description: '',
    commandId: 'sf.org.login.web'
  },
  {
    label: `$(plus) ${nls.localize('org_login_web_authorize_dev_hub_text')}`,
    description: '',
    commandId: 'sf.org.login.web.dev.hub'
  },
  {
    label: `$(plus) ${nls.localize('org_create_default_scratch_org_text')}`,
    description: '',
    commandId: 'sf.org.create'
  },
  {
    label: `$(plus) ${nls.localize('org_login_access_token_text')}`,
    description: '',
    commandId: 'sf.org.login.access.token'
  },
  {
    label: `$(plus) ${nls.localize('org_list_clean_text')}`,
    description: '',
    commandId: 'sf.org.list.clean'
  }
];

// exported for test
export const isOrgExpired = async (targetOrgOrAlias: string): Promise<boolean> => {
  const authFields = await getAuthFieldsFor(targetOrgOrAlias);
  const expirationDate = authFields.expirationDate ? new Date(authFields.expirationDate) : undefined;
  return expirationDate ? expirationDate < new Date() : false;
};

export const setDefaultOrg = async (): Promise<CancelResponse | ContinueResponse<{}>> => {
  const allAuthorizations = await AuthInfo.listAllAuthorizations();
  const defaultConfig = await getDefaultOrgConfiguration();

  const activeOrgs = allAuthorizations.filter(o => o.isExpired !== true);
  const sortedOrgs = sortOrgs(activeOrgs, defaultConfig);
  const orgItems = buildOrgQuickPickItems(sortedOrgs, defaultConfig);

  const quickPickList: OrgQuickPickItem[] = [...ACTION_ITEMS, ...orgItems];

  const selection = await vscode.window.showQuickPick(quickPickList, {
    placeHolder: nls.localize('org_select_text'),
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!selection) {
    return { type: 'CANCEL' };
  }

  const orgItem: OrgQuickPickItem = selection;
  if (orgItem.commandId) {
    vscode.commands.executeCommand(orgItem.commandId);
    return { type: 'CONTINUE', data: {} };
  }

  const usernameOrAlias = orgItem.orgAlias ?? orgItem.orgUsername ?? '';
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
