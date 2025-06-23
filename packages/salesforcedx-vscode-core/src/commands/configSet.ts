/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core-bundle';
import {
  ConfigUtil,
  ContinueResponse,
  EmptyParametersGatherer,
  LibraryCommandletExecutor,
  Row,
  Table,
  TraceFlags
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import {
  APEX_CODE_DEBUG_LEVEL,
  CONFIG_SET_EXECUTOR,
  CONFIG_SET_NAME,
  TABLE_NAME_COL,
  TABLE_SUCCESS_COL,
  TABLE_VAL_COL,
  TARGET_ORG_KEY,
  TRACE_FLAG_EXPIRATION_KEY
} from '../constants';
import { nls } from '../messages';
import { SfCommandlet, SfWorkspaceChecker } from './util';

class ConfigSetExecutor extends LibraryCommandletExecutor<{}> {
  private usernameOrAlias: string;
  protected showChannelOutput = false;
  private outputTableRow: Row = {};
  // private extensionContext: vscode.ExtensionContext;

  constructor(usernameOrAlias: string, extensionContext: vscode.ExtensionContext) {
    super(nls.localize(CONFIG_SET_EXECUTOR), CONFIG_SET_EXECUTOR, OUTPUT_CHANNEL);
    this.usernameOrAlias = `${usernameOrAlias}`.split(',')[0];
    // this.extensionContext = extensionContext;
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

  // Verify that the config was actually set before attempting trace flag cleanup
  try {
    // Check if the target org was successfully set by reading it back
    const actualTargetOrg = await ConfigUtil.getTargetOrgOrAlias();
    if (!actualTargetOrg) {
      console.log('Config set operation did not complete successfully - no target org found');
      return;
    }

    console.log('Config set successful, target org is:', actualTargetOrg);

    // Get the actual username for the target org (in case actualTargetOrg is an alias)
    const username = await ConfigUtil.getUsernameFor(actualTargetOrg);
    console.log('Using username for connection:', username);

    // Create a connection directly using the actual username
    // This bypasses the WorkspaceContextUtil's caching which might not be updated yet
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username })
    });

    const traceFlags = new TraceFlags(connection);
    await traceFlags.handleTraceFlagCleanupAfterLogin(
      extensionContext,
      TRACE_FLAG_EXPIRATION_KEY,
      APEX_CODE_DEBUG_LEVEL
    );
  } catch (error) {
    // Silently handle connection errors - trace flag cleanup is not critical to config set success
    console.log('Failed to perform trace flag cleanup after setting target org:', error);
  }
};
