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
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';
import * as vscode from 'vscode';

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
    const path = vscode.workspace.workspaceFolders![0].uri.path;
    process.chdir(path);
    const config = await Config.create(Config.getDefaultOptions());

    config.set(CONFIG_NAME, this.usernameOrAlias);
    this.responses.push({name: CONFIG_NAME, val: this.usernameOrAlias, success: String(true) });
    const title = 'Set Config'; // todo: localize
    await config.write();
    const table = new Table();
    const outputTable = table.createTable(
      this.responses,
      [
        { key: 'name', label: 'Name'},
        {key: 'val', label: 'Value'},
        {key: 'success', label: 'Success'}
      ], 
      title
    ); // todo: localize and potentially create helper function
    channelService.appendLine(outputTable);
    return true;
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
