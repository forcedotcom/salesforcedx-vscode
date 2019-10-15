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
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as fs from 'fs';
import * as path from 'path';
import { mkdir } from 'shelljs';
import { SfdxCommandletExecutor } from '../commands/util';
import { getRootWorkspacePath } from '../util';

export class ForceDescribeMetadataExecutor extends SfdxCommandletExecutor<
  string
> {
  public constructor() {
    super();
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withArg('force:mdapi:describemetadata')
      .withJson()
      .withLogName('force_mdapi_describemetadata')
      .build();
  }

  public execute(): CliCommandExecution {
    const startTime = process.hrtime();
    const execution = new CliCommandExecutor(this.build({}), {
      cwd: getRootWorkspacePath()
    }).execute();

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
    });
    return execution;
  }
}

export async function forceDescribeMetadata(
  outputFolder: string
): Promise<string> {
  const forceDescribeMetadataExecutor = new ForceDescribeMetadataExecutor();
  const execution = forceDescribeMetadataExecutor.execute();
  if (!fs.existsSync(outputFolder)) {
    mkdir('-p', outputFolder);
  }
  const filePath = path.join(outputFolder, 'metadataTypes.json');

  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  fs.writeFileSync(filePath, result);
  return result;
}
