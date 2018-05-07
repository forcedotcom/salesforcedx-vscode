/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SfdxCommandBuilder } from './commandBuilder';
import { CliCommandExecutor } from './commandExecutor';
import { CommandOutput } from './commandOutput';

export interface OrgInfo {
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
}

export class ForceOrgDisplay {
  public async getOrgInfo(projectPath: string): Promise<OrgInfo> {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:org:display')
        .withJson()
        .build(),
      { cwd: projectPath }
    ).execute();

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
