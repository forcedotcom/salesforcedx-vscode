/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, OrgAuthorization } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { CancelResponse, ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { ICONS, type DefaultOrgInfoSchema } from '@salesforce/vscode-services';
import { Duration } from 'effect';
import * as Effect from 'effect/Effect';
import * as Order from 'effect/Order';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { ORG_OPEN_COMMAND } from '../constants';
import { nls } from '../messages';
import {
  determineOrgMarkers,
  getAuthFieldsFor,
  getDefaultOrgConfiguration,
  readAliasesByUsernameFromDisk
} from '../util/orgUtil';

type OrgType = 'DevHub' | 'Sandbox' | 'Scratch' | 'Org';

/** Org type derived from OrgAuthorization (no async calls) */
const getOrgTypeFromAuth = (orgAuth: OrgAuthorization): OrgType => {
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

const orgTypeToLabel = (type: OrgType): string => {
  switch (type) {
    case 'Scratch':
      return 'Scratch Orgs';
    case 'DevHub':
      return 'Dev Hubs';
    case 'Sandbox':
      return 'Sandboxes';
    default:
      return 'Other Orgs';
  }
};

/** Codicon name for org type */
const getIconForOrgType = (type: OrgType): string => {
  switch (type) {
    case 'DevHub':
      return ICONS.ORG_TYPE_DEVHUB;
    case 'Sandbox':
      return ICONS.ORG_TYPE_SANDBOX;
    case 'Scratch':
      return ICONS.ORG_TYPE_SCRATCH;
    default:
      return ICONS.ORG_TYPE_ORG;
  }
};
/** QuickPickItem for org selection with metadata for handling */
interface OrgQuickPickItem extends vscode.QuickPickItem {
  orgUsername?: string;
  orgAlias?: string;
  commandId?: string;
  orgType?: OrgType;
}

type DefaultOrgConfig = Awaited<ReturnType<typeof getDefaultOrgConfiguration>>;

const byTypeAndMarkers = (): Order.Order<OrgAuthorization> =>
  Order.mapInput(Order.number, (o: OrgAuthorization) => {
    if (o.isScratchOrg) return 0;
    if (o.isSandbox) return 1;
    if (o.isDevHub) return 3;
    return 2;
  });

const byAliasFirst: Order.Order<OrgAuthorization> = Order.mapInput(
  Order.reverse(Order.boolean),
  (o: OrgAuthorization) => !!o.aliases?.[0]
);

const byAliasOrUsername: Order.Order<OrgAuthorization> = Order.mapInput(Order.string, (o: OrgAuthorization) =>
  (o.aliases?.[0] ?? o.username ?? '').toLowerCase()
);

/** Sort: Scratch, Sandbox, Other, DevHub, Defaults; within each, aliases first then alphabetical. Exported for test. */
const orgOrder = (): Order.Order<OrgAuthorization> =>
  Order.combineAll([byTypeAndMarkers(), byAliasFirst, byAliasOrUsername]);

/** Build QuickPick items from orgs: icons + (alias(s) | username when alias present) */
const orgAuthToQuickPickItem =
  (defaultConfig: Awaited<ReturnType<typeof getDefaultOrgConfiguration>>) =>
  (orgAuth: OrgAuthorization): OrgQuickPickItem => {
    const defaultMarkers = determineOrgMarkers(orgAuth, defaultConfig);
    const orgType = getOrgTypeFromAuth(orgAuth);
    const typeIcon = getIconForOrgType(orgType);
    const aliasDisplay = orgAuth.aliases?.length ? orgAuth.aliases.join(', ') : undefined;
    const label = aliasDisplay ? `${typeIcon} ${aliasDisplay}` : `${typeIcon} ${orgAuth.username}`;
    const defaultSuffix =
      defaultMarkers === `${ICONS.SF_DEFAULT_HUB} ${ICONS.SF_DEFAULT_ORG}`
        ? `Default Org ${ICONS.SF_DEFAULT_ORG} · Default Dev Hub ${ICONS.SF_DEFAULT_HUB}`
        : defaultMarkers === ICONS.SF_DEFAULT_ORG
          ? `Default Org ${ICONS.SF_DEFAULT_ORG}`
          : defaultMarkers === ICONS.SF_DEFAULT_HUB
            ? `Default Dev Hub ${ICONS.SF_DEFAULT_HUB}`
            : undefined;
    const descriptionParts = [aliasDisplay ? orgAuth.username : undefined, defaultSuffix].filter(Boolean);
    return {
      label,
      description: descriptionParts.length > 0 ? descriptionParts.join(' — ') : undefined,
      orgUsername: orgAuth.username,
      orgAlias: orgAuth.aliases?.[0],
      orgType
    };
  };

/** Action items for SFDX commands */
const ACTION_ITEMS: OrgQuickPickItem[] = [
  {
    label: `${ICONS.ADD} ${nls.localize('org_login_web_authorize_org_text')}`,
    commandId: 'sf.org.login.web'
  },
  {
    label: `${ICONS.ADD} ${nls.localize('org_login_web_authorize_dev_hub_text')}`,
    commandId: 'sf.org.login.web.dev.hub'
  },
  {
    label: `${ICONS.ADD} ${nls.localize('org_create_default_scratch_org_text')}`,
    commandId: 'sf.org.create'
  },
  {
    label: `${ICONS.ADD} ${nls.localize('org_login_access_token_text')}`,
    commandId: 'sf.org.login.access.token'
  },
  {
    label: `${ICONS.ADD} ${nls.localize('org_list_clean_text')}`,
    commandId: 'sf.org.list.clean'
  }
];

// exported for test
export const isOrgExpired = async (targetOrgOrAlias: string): Promise<boolean> => {
  const authFields = await getAuthFieldsFor(targetOrgOrAlias);
  const expirationDate = authFields.expirationDate ? new Date(authFields.expirationDate) : undefined;
  return expirationDate ? expirationDate < new Date() : false;
};

export const authorizationsToQuickPickItems = (
  authorizations: OrgAuthorization[],
  defaultConfig: DefaultOrgConfig
): OrgQuickPickItem[] =>
  authorizations
    .filter(o => o.isExpired !== true)
    .toSorted(orgOrder())
    .map(orgAuthToQuickPickItem(defaultConfig));

export const setDefaultOrg = async (): Promise<CancelResponse | ContinueResponse<{}>> => {
  const [defaultConfig, authorizations, aliasesByUsername] = await Promise.all([
    getDefaultOrgConfiguration(),
    AuthInfo.listAllAuthorizations(),
    readAliasesByUsernameFromDisk()
  ]);

  // Supplement stale StateAggregator alias data with fresh disk data
  const freshAuthorizations = authorizations.map(org =>
    org.aliases?.length ? org : { ...org, aliases: aliasesByUsername.get(org.username) ?? [] }
  );

  const quickPickList = [
    ...ACTION_ITEMS,
    ...authorizationsToQuickPickItems(freshAuthorizations, defaultConfig).flatMap((item, index, array) => {
      // add a separator if the previous item is not the same type as the current item
      if (item.orgType && (index === 0 || item.orgType !== array[index - 1].orgType)) {
        return [{ kind: vscode.QuickPickItemKind?.Separator ?? 1, label: orgTypeToLabel(item.orgType) }, item];
      }
      return [item];
    })
  ];

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
export const createOrgPicker = Effect.fn('OrgPicker.createOrgPicker')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgPickerStatuBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 47);
  const orgOpenStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 48);

  yield* Effect.addFinalizer(() => Effect.sync(() => orgPickerStatuBarItem.dispose()));
  yield* Effect.addFinalizer(() => Effect.sync(() => orgOpenStatusBarItem.dispose()));

  orgPickerStatuBarItem.command = 'sf.set.default.org';

  // these don't change, we just show/hide based on there being an org
  orgOpenStatusBarItem.tooltip = nls.localize('status_bar_open_org_tooltip');
  orgOpenStatusBarItem.command = ORG_OPEN_COMMAND;
  orgOpenStatusBarItem.text = ICONS.BROWSER;

  // we always show this one, even if there is no org
  orgPickerStatuBarItem.show();

  // watch for org changes
  const targetOrgRef = yield* api.services.TargetOrgRef();

  yield* Effect.forkDaemon(
    Stream.concat(Stream.fromEffect(SubscriptionRef.get(targetOrgRef)), targetOrgRef.changes).pipe(
      Stream.tap(orgInfo => Effect.log('Org Extension:orgChange', orgInfo)),
      Stream.tap(orgInfo =>
        Effect.sync(() => (orgInfo.username ? orgOpenStatusBarItem.show() : orgOpenStatusBarItem.hide()))
      ),
      Stream.mapEffect(orgInfo => getStatusBarContent(orgInfo)),
      Stream.runForEach(({ text, tooltip }) =>
        Effect.sync(() => {
          orgPickerStatuBarItem.text = text;
          orgPickerStatuBarItem.tooltip = tooltip;
        })
      )
    )
  );

  // These statusBarItems stay on the page until the extension is deactivated
  yield* Effect.sleep(Duration.infinity);
});

type OrgTypeFromInfo = 'Scratch' | 'Sandbox' | 'Org';

const getOrgTypeFromInfo = (orgInfo: typeof DefaultOrgInfoSchema.Type): OrgTypeFromInfo =>
  orgInfo.isScratch ? 'Scratch' : orgInfo.isSandbox ? 'Sandbox' : 'Org';

const getStatusBarContent = Effect.fn('updateTargetOrgDisplay')(function* (orgInfo: typeof DefaultOrgInfoSchema.Type) {
  const { username, aliases, isScratch } = orgInfo;
  if (!username) {
    return {
      text: nls.localize('missing_default_org'),
      tooltip: nls.localize('status_bar_org_picker_tooltip')
    };
  }
  const isExpired = isScratch ? yield* Effect.promise(() => isOrgExpired(username)) : false;
  const orgType = getOrgTypeFromInfo(orgInfo);
  const typeIcon = getIconForOrgType(orgType);
  const displayName = aliases?.[0] ?? username;
  const text = `${typeIcon} ${displayName}${isExpired ? ` ${ICONS.WARNING}` : ''}`;

  const tooltip = new vscode.MarkdownString();
  tooltip.appendMarkdown(`**Type: ${orgType}**${isExpired ? ' — Expired' : ''}\n\n`);
  if (aliases?.length) {
    tooltip.appendMarkdown(`Alias: ${aliases.join(', ')}\n\n`);
  }
  tooltip.appendMarkdown(`Username: ${username}\n\n---\n\n*Click to switch default org*`);

  return { text, tooltip };
});
