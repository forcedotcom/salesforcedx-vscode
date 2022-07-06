/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Config } from '@salesforce/core';
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { Row, Table } from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/src/types';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';
import { getRootWorkspacePath } from '../util/rootWorkspace';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';

const CONFIG_SET_EXECUTOR = 'force_config_set_org_text';
const CONFIG_NAME = 'defaultusername'; // todo: localize

export class ForceConfigSetExecutor extends LibraryCommandletExecutor<{}> {
  private usernameOrAlias: string;
  protected showChannelOutput = false;
  private responses: Row[] = [];

  constructor(
    usernameOrAlias: string
  ) {
    super(nls.localize(CONFIG_SET_EXECUTOR), CONFIG_SET_EXECUTOR, OUTPUT_CHANNEL);
    this.usernameOrAlias = `${usernameOrAlias}`.split(',')[0];
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    // In order to correctly setup Config, the process directory needs to be set to the current workspace directory
    const path = getRootWorkspacePath(); // Get current workspace path
    process.chdir(path); // Set process directory

    const config = await Config.create(Config.getDefaultOptions());

    config.set(CONFIG_NAME, this.usernameOrAlias);
    await config.write();
    this.responses.push({ name: CONFIG_NAME, val: this.usernameOrAlias, success: String(true) });
    const outputTable = this.formatOutput(this.responses);
    channelService.appendLine(outputTable);
    return true;
  }

  public getUsernameOrAlias() {
    return this.usernameOrAlias;
  }

  private formatOutput(input: Row[]): string {
    const title = 'Set Config'; // todo: localize
    const table = new Table();
    const outputTable = table.createTable(
      input,
      [
        { key: 'name', label: 'Name' },
        { key: 'val', label: 'Value' },
        { key: 'success', label: 'Success' }
      ],
      title
    ); // todo: localize and potentially create helper function
    return outputTable;
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceConfigSet(usernameOrAlias: string) {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceConfigSetExecutor(usernameOrAlias)
  );
  await commandlet.run();
}
