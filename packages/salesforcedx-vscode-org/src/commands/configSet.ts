/*
 * Copyright (c) 2025, salesforce.com, inc.
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
  SfCommandlet,
  SfWorkspaceChecker,
  Table
} from '@salesforce/salesforcedx-utils-vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { nls } from '../messages';

const CONFIG_SET_EXECUTOR = 'config_set_executor';
const CONFIG_SET_NAME = 'config_set_name';
const TABLE_NAME_COL = 'table_header_name';
const TABLE_VAL_COL = 'table_header_value';
const TABLE_SUCCESS_COL = 'table_header_success';
const TARGET_ORG_KEY = 'target-org';

class ConfigSetExecutor extends LibraryCommandletExecutor<{}> {
  private usernameOrAlias: string;
  protected showChannelOutput = false;
  private outputTableRow: Row = {};

  constructor(usernameOrAlias: string) {
    super(nls.localize(CONFIG_SET_EXECUTOR), CONFIG_SET_EXECUTOR, OUTPUT_CHANNEL);
    this.usernameOrAlias = `${usernameOrAlias}`.split(',')[0];
  }

  public async run(_response: ContinueResponse<string>): Promise<boolean> {
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

export const configSet = async (usernameOrAlias: string): Promise<void> => {
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new EmptyParametersGatherer(),
    new ConfigSetExecutor(usernameOrAlias)
  );
  await commandlet.run();
};
