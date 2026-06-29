/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Column, createTable, ExtensionProviderService, Row } from '@salesforce/effect-ext-utils';
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { nls } from '../messages';
import { gatherOrgForDisplay } from '../parameterGatherers/selectOrgForDisplay';
import { OrgInfo } from '../types/orgInfo';
import { getOrgInfoEffect } from '../util/orgDisplay';

/** Shared sensitive-info warning shown before the org-details table (both display paths). */
const ACCESS_WARNING = `Warning: This command will expose sensitive information that allows for subsequent activity using your current authenticated session.
Sharing this information is equivalent to logging someone in under the current credential, resulting in unintended access and escalation of privilege.
For additional information, please review the authorization section of the https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm.`;

class NoTargetOrgError extends Schema.TaggedError<NoTargetOrgError>()('NoTargetOrgError', {
  message: Schema.String
}) {}

const getTargetUsername = Effect.fn('getTargetUsername')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const targetOrgRef = yield* api.services.TargetOrgRef();
  const currentOrgInfo = yield* SubscriptionRef.get(targetOrgRef);
  if (currentOrgInfo.username) {
    return currentOrgInfo.username;
  }
  const fromProjectConfig = yield* Effect.promise(() => ConfigUtil.getUsername());
  if (fromProjectConfig) {
    return fromProjectConfig;
  }
  return yield* new NoTargetOrgError({ message: nls.localize('error_no_target_org') });
});

const formatOrgInfoAsTable = (orgInfo: OrgInfo): string => {
  const columns: Column[] = [
    { key: 'property', label: 'Key' },
    { key: 'value', label: 'Value' }
  ];
  const isScratchOrg = !!orgInfo.devHubId;

  const rows: Row[] = [
    { property: 'Access Token', value: orgInfo.accessToken },
    { property: 'Alias', value: orgInfo.aliases.join(', ') },
    { property: 'API Version', value: orgInfo.apiVersion },
    { property: 'Client Id', value: orgInfo.clientId },
    { property: 'Connected Status', value: orgInfo.connectionStatus },
    { property: 'Instance Url', value: orgInfo.instanceUrl },
    { property: 'Org Id', value: orgInfo.id },
    { property: 'Username', value: orgInfo.username },
    ...(orgInfo.namespace ? [{ property: 'Namespace', value: orgInfo.namespace }] : []),
    ...(isScratchOrg
      ? [
          { property: 'Dev Hub Id', value: orgInfo.devHubId },
          { property: 'Created By', value: orgInfo.createdBy },
          { property: 'Created Date', value: orgInfo.createdDate },
          { property: 'Expiration Date', value: orgInfo.expirationDate },
          { property: 'Status', value: orgInfo.status },
          { property: 'Password', value: orgInfo.password ?? '' },
          { property: 'Org Name', value: orgInfo.orgName }
        ]
      : []),
    ...(orgInfo.edition && !isScratchOrg ? [{ property: 'Edition', value: orgInfo.edition }] : [])
  ].toSorted((a, b) => String(a.property).localeCompare(String(b.property)));

  return createTable(rows, columns, 'Org Description');
};

/** Write the sensitive-info warning followed by the org-details table to the output channel. */
const writeOrgInfoToChannel = Effect.fn('orgDisplay.writeOrgInfoToChannel')(function* (orgInfo: OrgInfo) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;
  yield* channel.appendToChannel(ACCESS_WARNING);
  yield* channel.appendToChannel('');
  yield* channel.appendToChannel(formatOrgInfoAsTable(orgInfo));
  yield* channel.showChannel;
});

/**
 * Effect command for `sf.org.display.default`: resolve the default org, then write its details table
 * (preceded by the sensitive-info warning) to the output channel.
 */
export const orgDisplayDefaultCommand = Effect.fn('orgDisplayDefaultCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  yield* api.services.ProjectService.getSfProject();

  const targetUsername = yield* getTargetUsername();
  const orgInfo = yield* getOrgInfoEffect(targetUsername);
  yield* writeOrgInfoToChannel(orgInfo);
});

/**
 * Effect command for `sf.org.display.username`: pick an authed org, then write its details table
 * (preceded by the sensitive-info warning) to the output channel.
 */
export const orgDisplayUsernameCommand = Effect.fn('orgDisplayUsernameCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  yield* api.services.ProjectService.getSfProject();

  // picker selection; UserCancellationError propagates to ErrorHandlerService (no error toast on Esc).
  const { username } = yield* gatherOrgForDisplay();
  const orgInfo = yield* getOrgInfoEffect(username);
  yield* writeOrgInfoToChannel(orgInfo);
});
