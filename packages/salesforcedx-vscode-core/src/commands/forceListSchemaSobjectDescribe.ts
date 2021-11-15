/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// TODO: OrgBrowser: this file uses sfdx and should be replaced with the code in
// PR https://github.com/forcedotcom/salesforcedx-vscode/pull/3645
// and this file will be deleted once PR 3645 is merged in.

import {
  CliCommandExecution,
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as fs from 'fs';
import { SfdxCommandletExecutor } from '../commands/util';
import { getRootWorkspacePath } from '../util';

export class ForceListSchemaSobjectDescribeExecutor extends SfdxCommandletExecutor<
  string
> {
  private objectName: string;
  private defaultUsernameOrAlias: string;

  public constructor(objectName: string, defaultUsernameOrAlias: string) {
    super();
    this.objectName = objectName;
    this.defaultUsernameOrAlias = defaultUsernameOrAlias;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withArg('force:schema:sobject:describe')
      .withFlag('-s', this.objectName)
      .withFlag('-u', this.defaultUsernameOrAlias)
      .withJson();

    const command = builder.build();
    return command;
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

export async function forceListSchemaSobjectDescribe(
  objectName: string,
  defaultUsernameOrAlias: string,
  outputPath: string
): Promise<string> {
  const forceListSchemaSobjectDescribeExecutor = new ForceListSchemaSobjectDescribeExecutor(
    objectName,
    defaultUsernameOrAlias
  );
  const execution = forceListSchemaSobjectDescribeExecutor.execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  fs.writeFileSync(outputPath, result);
  return result;
}
