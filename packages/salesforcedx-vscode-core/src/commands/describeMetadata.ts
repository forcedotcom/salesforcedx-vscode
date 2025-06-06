/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Command, CommandOutput, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import { CliCommandExecution, CliCommandExecutor, workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SfCommandletExecutor } from './util';

class DescribeMetadataExecutor extends SfCommandletExecutor<string> {
  public constructor() {
    super();
  }

  public build(data: {}): Command {
    return new SfCommandBuilder()
      .withArg('org:list:metadata-types')
      .withJson()
      .withLogName('describe_metadata_types')
      .build();
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

export const describeMetadata = async (outputFolder: string): Promise<string> => {
  const describeMetadataExecutor = new DescribeMetadataExecutor();
  const execution = describeMetadataExecutor.execute();
  await fs.promises.mkdir(outputFolder, { recursive: true });

  const filePath = path.join(outputFolder, 'metadataTypes.json');

  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  fs.writeFileSync(filePath, result);
  return result;
};
