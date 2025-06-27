/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ConfigUtil,
  ContinueResponse,
  EmptyParametersGatherer,
  LibraryCommandletExecutor,
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import {
  CONFIG_SET_EXECUTOR,
  CONFIG_SET_NAME,
  TABLE_NAME_COL,
  TABLE_SUCCESS_COL,
  TABLE_VAL_COL,
  TARGET_ORG_KEY
} from '../constants';
import { nls } from '../messages';
import { SfCommandlet, SfWorkspaceChecker } from './util';

class ConfigSetExecutor extends LibraryCommandletExecutor<{}> {
  private usernameOrAlias: string;
  protected showChannelOutput = false;
  private outputTableRow: Row = {};

  constructor(usernameOrAlias: string, extensionContext: vscode.ExtensionContext) {
    super(nls.localize(CONFIG_SET_EXECUTOR), CONFIG_SET_EXECUTOR, OUTPUT_CHANNEL);
    this.usernameOrAlias = `${usernameOrAlias}`.split(',')[0];
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    let result: boolean;
    let message: string | undefined;
    try {
      result = true;
      await ConfigUtil.setTargetOrgOrAlias(this.usernameOrAlias);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
      result = false;
    }
    this.outputTableRow = {
      name: TARGET_ORG_KEY,
      val: this.usernameOrAlias,
      success: String(result)
    };
    const outputTable = this.formatOutput(this.outputTableRow);
    channelService.appendLine(outputTable);
    if (message) {
      channelService.appendLine(`Error: ${message}`);
      channelService.showChannelOutput();
    }

    return result;
  }

  private formatOutput(input: Row): string {
    const title = nls.localize(CONFIG_SET_NAME);
    const table = new Table();
    const outputTable = table.createTable(
      [input],
      [
        { key: 'name', label: nls.localize(TABLE_NAME_COL) },
        { key: 'val', label: nls.localize(TABLE_VAL_COL) },
        { key: 'success', label: nls.localize(TABLE_SUCCESS_COL) }
      ],
      title
    );
    return outputTable;
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export const configSet = async (usernameOrAlias: string, extensionContext: vscode.ExtensionContext): Promise<void> => {
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, new ConfigSetExecutor(usernameOrAlias, extensionContext));
  await commandlet.run();
};
