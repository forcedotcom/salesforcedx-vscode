/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command } from './command';

export const JSON_FLAG = '--json';
export const LOG_LEVEL_FLAG = '--loglevel';
export const FATAL = 'fatal';

export class CommandBuilder {
  public readonly command: string;
  public description?: string;
  public args: string[] = [];
  public logName?: string;

  public constructor(command: string) {
    this.command = command;
  }

  public withDescription(description: string): CommandBuilder {
    this.description = description;
    return this;
  }

  public withArg(arg: string): CommandBuilder {
    if (arg === JSON_FLAG) {
      this.withJson();
    } else {
      this.args.push(arg);
    }
    return this;
  }

  public withFlag(name: string, value: string): CommandBuilder {
    this.args.push(name, value);
    return this;
  }

  public withJson(): CommandBuilder {
    this.args.push(JSON_FLAG);
    this.args.push(LOG_LEVEL_FLAG, FATAL);
    return this;
  }

  public withLogName(logName: string): CommandBuilder {
    this.logName = logName;
    return this;
  }

  public build(): Command {
    return new Command(this);
  }
}
