/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogService } from '@salesforce/apex-node';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages, Org } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { buildDescription, colorLogs, logLevels } from '../../../../utils';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-apex', 'get');

export default class Get extends SfdxCommand {
  protected static requiresUsername = true;
  // Guaranteed by requires username
  protected org!: Org;

  public static description = buildDescription(
    messages.getMessage('commandDescription'),
    messages.getMessage('longDescription')
  );

  public static longDescription = messages.getMessage('longDescription');
  public static examples = [
    `$ sfdx force:apex:log:get -i <log id>`,
    `$ sfdx force:apex:log:get -i <log id> -u me@my.org`,
    `$ sfdx force:apex:log:get -n 2 -c`,
    `$ sfdx force:apex:log:get -d Users/Desktop/logs -n 2`
  ];

  protected static flagsConfig = {
    json: flags.boolean({
      description: messages.getMessage('jsonDescription')
    }),
    loglevel: flags.enum({
      description: messages.getMessage('logLevelDescription'),
      longDescription: messages.getMessage('logLevelLongDescription'),
      default: 'warn',
      options: logLevels
    }),
    apiversion: flags.builtin(),
    logid: flags.id({
      char: 'i',
      description: messages.getMessage('logIDDescription')
    }),
    number: flags.number({
      char: 'n',
      min: 1,
      max: 25,
      description: messages.getMessage('numberDescription')
    }),
    outputdir: flags.string({
      char: 'd',
      description: messages.getMessage('outputDirDescription'),
      longDescription: messages.getMessage('outputDirLongDescription')
    })
  };

  public async run(): Promise<AnyJson> {
    try {
      const conn = this.org.getConnection();
      const logService = new LogService(conn);

      if (!this.flags.logid && !this.flags.number) {
        this.flags.number = 1;
      }
      const logResults = await logService.getLogs({
        logId: this.flags.logid,
        numberOfLogs: this.flags.number,
        outputDir: this.flags.outputdir
      });

      if (logResults.length === 0) {
        this.ux.log(messages.getMessage('noResultsFound'));
        return [];
      }

      if (this.flags.outputdir) {
        this.ux.log(`Log files written to ${this.flags.outputdir}`);
        return logResults.map(logResult => logResult.log);
      }
      const parsedLogs = logResults.map(logResult => {
        const colored = colorLogs(logResult.log);
        this.ux.log(colored);
        return { log: logResult.log };
      });

      return parsedLogs;
    } catch (e) {
      return Promise.reject(e);
    }
  }
}
