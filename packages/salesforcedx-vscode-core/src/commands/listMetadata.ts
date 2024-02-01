/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecution,
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import { workspaceUtils } from '../util';
import { SfdxCommandletExecutor } from './util';

export class ListMetadataExecutor extends SfdxCommandletExecutor<string> {
  private metadataType: string;
  private defaultUsernameOrAlias: string;
  private folder?: string;

  public constructor(
    metadataType: string,
    defaultUsernameOrAlias: string,
    folder?: string
  ) {
    super();
    this.metadataType = metadataType;
    this.defaultUsernameOrAlias = defaultUsernameOrAlias;
    this.folder = folder;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withArg('org:list:metadata')
      .withFlag('-m', this.metadataType)
      .withLogName('list_metadata')
      .withJson(false);

    if (this.folder) {
      builder.withFlag('--folder', this.folder);
    }

    return builder.build();
  }

  public execute(): CliCommandExecution {
    const startTime = process.hrtime();
    const execution = new CliCommandExecutor(this.build({}), {
      cwd: workspaceUtils.getRootWorkspacePath()
    }).execute();

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });
    return execution;
  }
}

export const listMetadata = async (
  metadataType: string,
  defaultUsernameOrAlias: string,
  outputPath: string,
  folder?: string
): Promise<string> => {
  const listMetadataExecutor = new ListMetadataExecutor(
    metadataType,
    defaultUsernameOrAlias,
    folder
  );
  const execution = listMetadataExecutor.execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  fs.writeFileSync(outputPath, result);
  return result;
};
