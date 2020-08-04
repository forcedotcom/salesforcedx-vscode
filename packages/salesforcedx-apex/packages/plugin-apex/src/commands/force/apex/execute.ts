/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ApexExecuteOptions,
  ExecuteService,
  ExecuteAnonymousResponse
} from '@salesforce/apex-node';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import {
  buildDescription,
  colorSuccess,
  colorError,
  logLevels
} from '../../../utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-apex', 'execute');

export default class Execute extends SfdxCommand {
  public static description = buildDescription(
    messages.getMessage('commandDescription'),
    messages.getMessage('longDescription')
  );
  public static longDescription = messages.getMessage('longDescription');

  public static examples = [
    `$ sfdx force:apex:execute -u testusername@salesforce.org -f ~/test.apex`,
    `$ sfdx force:apex:execute -f ~/test.apex`,
    `$ sfdx force:apex:execute \nStart typing Apex code. Press the Enter key after each line, then press CTRL+D when finished.`
  ];
  protected static supportsUsername = true;

  protected static flagsConfig = {
    apexcodefile: flags.filepath({
      char: 'f',
      description: messages.getMessage('apexCodeFileDescription')
    }),
    loglevel: flags.enum({
      description: messages.getMessage('logLevelDescription'),
      longDescription: messages.getMessage('logLevelLongDescription'),
      default: 'warn',
      options: logLevels
    }),
    apiversion: flags.builtin()
  };

  public async run(): Promise<AnyJson> {
    try {
      if (!this.org) {
        return Promise.reject(
          new Error(messages.getMessage('missing_auth_error'))
        );
      }
      const conn = this.org.getConnection();
      //@ts-ignore
      const exec = new ExecuteService(conn);

      const execAnonOptions: ApexExecuteOptions = {
        ...(this.flags.apexcodefile
          ? { apexFilePath: this.flags.apexcodefile }
          : { userInput: true })
      };
      const result = await exec.executeAnonymous(execAnonOptions);
      this.ux.log(this.formatResult(result));
      return result.result;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  private formatResult(response: ExecuteAnonymousResponse): string {
    let outputText = '';
    if (response.result.compiled === true) {
      outputText += `${colorSuccess(
        messages.getMessage('execute_compile_success')
      )}\n`;
      if (response.result.success === true) {
        outputText += `${colorSuccess(
          messages.getMessage('execute_runtime_success')
        )}\n`;
      } else {
        outputText += colorError(
          `Error: ${response.result.exceptionMessage}\n`
        );
        outputText += colorError(
          `Error: ${response.result.exceptionStackTrace}\n`
        );
      }
      outputText += `\n${response.result.logs}`;
    } else {
      outputText += colorError(
        `Error: Line: ${response.result.line}, Column: ${response.result.column}\n`
      );

      outputText += colorError(`Error: ${response.result.compileProblem}\n`);
    }
    return outputText;
  }
}
