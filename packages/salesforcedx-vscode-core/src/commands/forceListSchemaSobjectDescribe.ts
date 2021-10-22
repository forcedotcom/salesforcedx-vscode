/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// *
// *
// *
// TODO: OrgBrowser: this file uses sfdx and should be replaced with SDR
// This file is only temporary and is here to be able to demo the functionality.
// *
// *
// *

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

export class ForceListSchemaSobjectDescribeExecutor extends SfdxCommandletExecutor<string> {
  private objectName: string;
  private defaultUsernameOrAlias: string;
  //private folder: string;

  public constructor(
    objectName: string,
    defaultUsernameOrAlias: string,
    //folder: string
  ) {
    super();
    this.objectName = objectName;
    this.defaultUsernameOrAlias = defaultUsernameOrAlias;
    //this.folder = folder;
  }

  public build(data: {}): Command {
    // sfdx force:mdapi:listmetadata -m CustomObject -u test1-org --json —loglevel fatal
    // sfdx force:schema:sobject:describe -s MyCustomObject__c -u test1-org --json —loglevel fatal

    // debugger;

    // const builder = new SfdxCommandBuilder()
    //   .withArg('force:mdapi:listmetadata')
    //   .withFlag('-m', this.objectName)
    //   .withFlag('-u', this.defaultUsernameOrAlias)
    //   .withLogName('force_mdapi_listmetadata')
    //   .withJson();

    // //if (this.folder) {
    //   //builder.withFlag('--folder', this.folder);
    // //}

    // const command = builder.build();
    // // sfdx force:mdapi:listmetadata -m CustomObject -u test1-org --json --loglevel fatal'

    // debugger;



    const builder = new SfdxCommandBuilder()
      .withArg('force:schema:sobject:describe')
      .withFlag('-s', this.objectName)
      // .withFlag('-s', 'MyCustomObject__c')
      .withFlag('-u', this.defaultUsernameOrAlias)
      //.withLogName('force_mdapi_listmetadata')
      .withJson();

    //if (this.folder) {
      //builder2.withFlag('--folder', this.folder);
    //}

    const command = builder.build();
    // sfdx force:schema:sobject:describe -s MyCustomObject__c -u test1-org --json --loglevel fatal'


    // debugger;



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
  outputPath: string,
  //folder: string
): Promise<string> {
  const forceListSchemaSobjectDescribeExecutor = new ForceListSchemaSobjectDescribeExecutor(
    objectName,
    defaultUsernameOrAlias,
    //folder
  );
  const execution = forceListSchemaSobjectDescribeExecutor.execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  fs.writeFileSync(outputPath, result);
  return result;
}
