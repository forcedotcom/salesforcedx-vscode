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
import * as path from 'path';
import { mkdir } from 'shelljs';
import { workspaceUtils } from '../util';
import { SfdxCommandletExecutor } from './util';

export class DescribeMetadataExecutor extends SfdxCommandletExecutor<string> {
  public constructor() {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withArg('org:list:metadata-types')
      .withJson()
      .withLogName('force_mdapi_describemetadata')
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

export const describeMetadata = async (
  outputFolder: string
): Promise<string> => {
  const describeMetadataExecutor = new DescribeMetadataExecutor();
  const execution = describeMetadataExecutor.execute();
  if (!fs.existsSync(outputFolder)) {
    mkdir('-p', outputFolder);
  }
  const filePath = path.join(outputFolder, 'metadataTypes.json');

  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  fs.writeFileSync(filePath, result);
  return result;
};
