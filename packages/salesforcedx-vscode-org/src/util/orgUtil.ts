/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthFields, AuthInfo, OrgConfigProperties, Config } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { notificationService, workspaceUtils, ConfigAggregatorProvider } from '@salesforce/salesforcedx-utils-vscode';
import { Effect, Stream, SubscriptionRef } from 'effect';
import * as Chunk from 'effect/Chunk';
import { isString } from 'effect/Predicate';
import { channelService } from '../channels';
import { nls } from '../messages';

const DAYS_BEFORE_EXPIRE = 5;

/** Get ConfigAggregator Effect for the current workspace */
export const getConfigAggregatorEffect = Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const configService = yield* api.services.ConfigService;
  return yield* configService.getConfigAggregator();
});

const orgExpiresSoon = (authFields: AuthFields) =>
  isString(authFields.expirationDate) &&
  new Date(authFields.expirationDate) <= new Date(Date.now() + DAYS_BEFORE_EXPIRE * 24 * 60 * 60 * 1000);

const orgIsExpired = (authFields: AuthFields) =>
  isString(authFields.expirationDate) && new Date(authFields.expirationDate) < new Date();

/** One time notification about orgs that expire soon */
export const checkForSoonToBeExpiredOrgs = Effect.fn(function* () {
  const daysUntilExpiration = new Date();
  daysUntilExpiration.setDate(daysUntilExpiration.getDate() + DAYS_BEFORE_EXPIRE);
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const defaultOrgRef = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  const results = yield* Stream.fromIterable(yield* Effect.promise(() => AuthInfo.listAllAuthorizations())).pipe(
    // only scratch org can expire
    Stream.filter(o => Boolean(o.isScratchOrg)),
    Stream.mapEffect(o => Effect.promise(() => getAuthFieldsFor(o.username))),
    Stream.tap(o =>
      // special warning about when default orgs expire
      defaultOrgRef.username && o.username === defaultOrgRef.username && orgIsExpired(o)
        ? Effect.sync(() => void notificationService.showWarningMessage(nls.localize('default_org_expired')))
        : Effect.void
    ),
    // Filter out the expired orgs.
    Stream.filter(o => !orgIsExpired(o)),
    Stream.filter(orgExpiresSoon),
    // TODO: type guards or some Schema based check instead of !
    Stream.map(o =>
      nls.localize('pending_org_expiration_expires_on_message', o.alias ?? o.username!, o.expirationDate!)
    ),
    Stream.runCollect
  );

  if (results.length === 0) {
    return;
  }

  notificationService.showWarningMessage(
    nls.localize('pending_org_expiration_notification_message', DAYS_BEFORE_EXPIRE)
  );

  channelService.appendLine(
    nls.localize(
      'pending_org_expiration_output_channel_message',
      DAYS_BEFORE_EXPIRE,
      Chunk.toArray(results).join('\n\n')
    )
  );
  channelService.showChannelOutput();
});

export const getAuthFieldsFor = async (username: string): Promise<AuthFields> => {
  const authInfo: AuthInfo = await AuthInfo.create({
    username
  });

  return authInfo.getFields();
};

export const updateConfigAndStateAggregators = async (): Promise<void> => {
  const { StateAggregator } = await import('@salesforce/core');

  // Force the ConfigAggregatorProvider to reload its stored
  // ConfigAggregators so that this config file change is accounted
  // for and the ConfigAggregators are updated with the latest info.
  const configAggregatorProvider = ConfigAggregatorProvider.getInstance();
  await configAggregatorProvider.reloadConfigAggregators();
  // Also force the StateAggregator to reload to have the latest
  // authorization info.
  StateAggregator.clearInstance(workspaceUtils.getRootWorkspacePath());
};

const setUsernameOrAlias = async (usernameOrAlias: string): Promise<void> => {
  const config = await Config.create(Config.getDefaultOptions());
  config.set(OrgConfigProperties.TARGET_ORG, usernameOrAlias);
  await config.write();
  await updateConfigAndStateAggregators();
};

/** Sets the target org or alias in the local config */
export const setTargetOrgOrAlias = async (usernameOrAlias: string): Promise<void> => {
  const { Org } = await import('@salesforce/core');

  const originalDirectory = process.cwd();
  // In order to correctly setup Config, the process directory needs to be set to the current workspace directory
  const workspacePath = workspaceUtils.getRootWorkspacePath();
  try {
    // checks if the usernameOrAlias is non-empty and active.
    if (usernameOrAlias) {
      // throws an error if the org associated with the usernameOrAlias is expired.
      await Org.create({ aliasOrUsername: usernameOrAlias });
    }
    process.chdir(workspacePath);
    await setUsernameOrAlias(usernameOrAlias);
  } finally {
    process.chdir(originalDirectory);
  }
};

/** Get connection status from error */
export const getConnectionStatusFromError = (err: any, username?: string): string => {
  const message = err instanceof Error ? err.message : String(err);
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes('maintenance')) return 'Down (Maintenance)';
  if (lowerMsg.includes('<html>') || lowerMsg.includes('<!doctype html>')) return 'Bad Response';
  if (
    ['expired access/refresh token', 'invalid_session_id', 'bad_oauth_token', 'refreshtokenautherror'].some(token =>
      lowerMsg.includes(token)
    )
  ) {
    return 'Unable to refresh session: expired access/refresh token';
  }
  if (shouldRemoveOrg(err)) {
    return username ? `Invalid org: ${username}` : 'Invalid org';
  }

  return message;
};

/** Check if org should be removed based on error */
export const shouldRemoveOrg = (err: any): boolean => {
  const lowerMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return ['invalid_login', 'no such org', 'namedorgnotfound', 'noauthinfofound'].some(msg => lowerMsg.includes(msg));
};
