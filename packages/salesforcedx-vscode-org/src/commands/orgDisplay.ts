/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Column,
  createTable,
  ExtensionProviderService,
  Row,
  sfProjectPreconditionChecker
} from '@salesforce/effect-ext-utils';
import {
  ConfigUtil,
  FlagParameter,
  ContinueResponse,
  EmptyParametersGatherer,
  LibraryCommandletExecutor,
  SfCommandlet
} from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { getOrgRuntime } from '../extensionProvider';
import { nls } from '../messages';
import { SelectOrgForDisplay } from '../parameterGatherers/selectOrgForDisplay';
import { OrgInfo } from '../types/orgInfo';
import { getOrgInfo, orgInfoFromConnection } from '../util/orgDisplay';

/** Sensitive-info warning prepended to the org-details table; shared by the legacy executor and the Effect command. */
const ACCESS_WARNING = `Warning: This command will expose sensitive information that allows for subsequent activity using your current authenticated session.
Sharing this information is equivalent to logging someone in under the current credential, resulting in unintended access and escalation of privilege.
For additional information, please review the authorization section of the https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm.`;

class NoTargetOrgError extends Schema.TaggedError<NoTargetOrgError>()('NoTargetOrgError', {
  message: Schema.String
}) {}

const getTargetUsernameEffect = Effect.fn('getTargetUsernameEffect')(function* () {
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

class OrgDisplayExecutor extends LibraryCommandletExecutor<{ username?: string }> {
  private flag: string | undefined;

  constructor(flag?: string) {
    super(
      nls.localize(flag ? 'org_display_username_text' : 'org_display_default_text'),
      'org_display_library',
      OUTPUT_CHANNEL
    );
    this.flag = flag;
  }

  public async run(response: ContinueResponse<{ username?: string }>): Promise<boolean> {
    try {
      const { username } = response.data;
      const targetUsername =
        this.flag === '--target-org' && username
          ? username
          : await getOrgRuntime().runPromise(getTargetUsernameEffect());

      const orgInfo = await getOrgInfo(targetUsername);

      // Display warning about sensitive information
      channelService.appendLine(ACCESS_WARNING);
      channelService.appendLine('');

      // Display the org information
      const output = formatOrgInfoAsTable(orgInfo);
      channelService.appendLine(output);

      return true;
    } catch (error) {
      if (error instanceof Error) {
        channelService.appendLine(error.message);
      }
      throw error;
    }
  }
}

export async function orgDisplay(this: FlagParameter<string>) {
  const flag = this ? this.flag : undefined;
  const parameterGatherer = flag ? new SelectOrgForDisplay() : new EmptyParametersGatherer();
  const executor = new OrgDisplayExecutor(flag);
  const commandlet = new SfCommandlet(sfProjectPreconditionChecker, parameterGatherer, executor);
  await commandlet.run();
}

/**
 * Effect command for `sf.org.display.default`: display details for the default org.
 *
 * Resolves the default-org `Connection` via `ConnectionService.getConnection()` (no username
 * resolution — the connection carries the username), derives `OrgInfo` from it, and renders the
 * warning + table to the channel. The `.username` picker path stays on the legacy `orgDisplay`.
 */
export const orgDisplayDefaultCommand = Effect.fn('orgDisplayDefaultCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  yield* api.services.ProjectService.getSfProject();

  // resolves TARGET_ORG; fails typed NoTargetOrgConfiguredError (rendered by ErrorHandlerService)
  const conn = yield* api.services.ConnectionService.getConnection();
  const orgInfo = yield* orgInfoFromConnection(conn);

  const channel = yield* api.services.ChannelService;
  yield* channel.appendToChannel(ACCESS_WARNING);
  yield* channel.appendToChannel(formatOrgInfoAsTable(orgInfo));
  yield* channel.showChannel;
});
