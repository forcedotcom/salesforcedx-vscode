/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command } from './command';
import { CommandBuilderLike } from './types';

const SF_COMMAND = 'sf';
const JSON_FLAG = '--json';

export class SfCommandBuilder implements CommandBuilderLike {
  public readonly command: string;
  public description?: string;
  public args: string[] = [];
  public logName?: string;

  constructor() {
    this.command = SF_COMMAND;
  }

  public withArg(arg: string): SfCommandBuilder {
    if (arg === JSON_FLAG) {
      this.withJson();
    } else {
      this.args.push(arg);
    }
    return this;
  }

  public withFlag(name: string, value: string): SfCommandBuilder {
    this.args.push(name, value);
    return this;
  }

  public withJson(): SfCommandBuilder {
    this.args.push(JSON_FLAG);
    return this;
  }

  public build(): Command {
    return new Command(this);
  }
}
