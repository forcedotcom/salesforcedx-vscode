/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LogService } from '@salesforce/apex-node';
import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { buildDescription, logLevels } from '../../../../utils';
import { colorizeLog } from '../../../../legacyColorization';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/plugin-apex', 'tail');

export default class Tail extends SfdxCommand {
  protected static requiresUsername = true;

  public static description = buildDescription(
    messages.getMessage('commandDescription'),
    messages.getMessage('longDescription')
  );

  public static longDescription = messages.getMessage('longDescription');
  public static examples = [
    `$ sfdx force:apex:log:tail`,
    `$ sfdx force:apex:log:tail --debuglevel MyDebugLevel`,
    `$ sfdx force:apex:log:tail -c -s`
  ];

  public static readonly flagsConfig = {
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
    color: flags.boolean({
      char: 'c',
      description: messages.getMessage('colorDescription')
    }),
    debuglevel: flags.string({
      char: 'd',
      description: messages.getMessage('debugLevelDescription')
    }),
    skiptraceflag: flags.boolean({
      char: 's',
      description: messages.getMessage('skipTraceFlagDescription')
    })
  };

  public async run(): Promise<void> {
    try {
      if (this.org) {
        const conn = this.org.getConnection();
        const logService = new LogService(conn);

        if (!this.flags.skiptraceflag) {
          await logService.prepareTraceFlag(this.flags.debuglevel);
        }
        await logService.tail(this.org, this.logTailer.bind(this));
        this.ux.log(messages.getMessage('finishedTailing'));
      }
    } catch (e) {
      return Promise.reject(e);
    }
  }

  public async logTailer(fullLog: string): Promise<void> {
    if (fullLog) {
      if (this.flags.json) {
        this.ux.logJson({
          status: process.exitCode,
          result: fullLog
        });
      } else {
        const output = this.flags.color ? await colorizeLog(fullLog) : fullLog;
        this.ux.log(output);
      }
    }
  }
}
