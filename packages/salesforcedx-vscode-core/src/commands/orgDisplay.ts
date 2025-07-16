/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgInfo, OrgDisplay } from '@salesforce/salesforcedx-utils';
import {
  EmptyParametersGatherer,
  LibraryCommandletExecutor,
  ContinueResponse,
  Table,
  Column,
  Row,
  SfWorkspaceChecker,
  getRootWorkspacePath
} from '@salesforce/salesforcedx-utils-vscode';

import { channelService, OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { OrgAuthInfo } from '../util';
import { FlagParameter, SelectUsername, SfCommandlet } from './util';

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
      let targetUsername: string;

      if (this.flag === '--target-org' && username) {
        targetUsername = await OrgAuthInfo.getUsername(username);
      } else {
        const targetOrgOrAlias = await OrgAuthInfo.getTargetOrgOrAlias(true);
        if (!targetOrgOrAlias) {
          throw new Error(nls.localize('error_no_target_org'));
        }
        targetUsername = await OrgAuthInfo.getUsername(targetOrgOrAlias);
      }

      // Use the shared OrgDisplay class from utils
      const orgDisplayUtil = new OrgDisplay(targetUsername);
      const projectPath = getRootWorkspacePath();
      const orgInfo = await orgDisplayUtil.getOrgInfo(projectPath);

      // Display warning about sensitive information
      const warning =
        'Warning: This command will expose sensitive information that allows for subsequent activity using your current authenticated session.\n' +
        'Sharing this information is equivalent to logging someone in under the current credential, resulting in unintended access and escalation of privilege.\n' +
        'For additional information, please review the authorization section of the https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_auth_web_flow.htm.';
      channelService.appendLine(warning);
      channelService.appendLine('');

      // Display the org information
      const output = this.formatOrgInfoAsTable(orgInfo);
      channelService.appendLine(output);

      return true;
    } catch (error) {
      if (error instanceof Error) {
        channelService.appendLine(error.message);
      }
      throw error;
    }
  }

  private formatOrgInfoAsTable(orgInfo: OrgInfo): string {
    const columns: Column[] = [
      { key: 'property', label: 'Key' },
      { key: 'value', label: 'Value' }
    ];
    const isScratchOrg = !!orgInfo.devHubId;

    const rows: Row[] = [
      { property: 'Access Token', value: orgInfo.accessToken },
      { property: 'Alias', value: orgInfo.alias },
      { property: 'API Version', value: orgInfo.apiVersion },
      { property: 'Client Id', value: orgInfo.clientId },
      { property: 'Connected Status', value: orgInfo.connectionStatus },
      { property: 'Instance Url', value: orgInfo.instanceUrl },
      { property: 'Org Id', value: orgInfo.id },
      { property: 'Username', value: orgInfo.username },
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
    ].sort((a, b) => String(a.property).localeCompare(String(b.property)));

    const table = new Table();
    return table.createTable(rows, columns, 'Org Description');
  }
}

export async function orgDisplay(this: FlagParameter<string>) {
  const flag = this ? this.flag : undefined;
  const parameterGatherer = flag ? new SelectUsername() : new EmptyParametersGatherer();
  const executor = new OrgDisplayExecutor(flag);
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), parameterGatherer, executor);
  await commandlet.run();
}
