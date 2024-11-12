/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfCommandBuilder } from './commandBuilder';
import { CliCommandExecutor } from './commandExecutor';
import { CommandOutput } from './commandOutput';

export const ORG_DISPLAY_COMMAND = 'org:display';
export type OrgInfo = {
  username: string;
  devHubId: string;
  id: string;
  createdBy: string;
  createdDate: string;
  expirationDate: string;
  status: string;
  edition: string;
  orgName: string;
  accessToken: string;
  instanceUrl: string;
  clientId: string;
};

export class OrgDisplay {
  public async getOrgInfo(projectPath: string): Promise<OrgInfo> {
    const execution = new CliCommandExecutor(new SfCommandBuilder().withArg(ORG_DISPLAY_COMMAND).withJson().build(), {
      cwd: projectPath
    }).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      const orgInfo = JSON.parse(result).result as OrgInfo;
      return Promise.resolve(orgInfo);
    } catch (e) {
      return Promise.reject(result);
    }
  }
}
