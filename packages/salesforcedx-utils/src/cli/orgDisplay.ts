/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OrgInfo } from '../types';
import { CliCommandExecutor } from './cliCommandExecutor';
import { CommandOutput } from './commandOutput';
import { SfCommandBuilder } from './sfCommandBuilder';

export class OrgDisplay {
  public async getOrgInfo(projectPath: string): Promise<OrgInfo> {
    const execution = new CliCommandExecutor(new SfCommandBuilder().withArg('org:display').withJson().build(), {
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
