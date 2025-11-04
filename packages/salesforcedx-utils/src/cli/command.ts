/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Command as CommandType } from '../types/command';
import { CommandBuilder } from './commandBuilder';

export class Command implements CommandType {
  public readonly command: string;
  public readonly description?: string;
  public readonly args: string[];
  public readonly logName?: string;

  constructor(builder: CommandBuilder) {
    this.command = builder.command;
    this.description = builder.description;
    this.args = builder.args;
    this.logName = builder.logName;
  }

  public toString(): string {
    return this.description ?? `${this.command} ${this.args.join(' ')}`;
  }

  public toCommand(): string {
    return `${this.command} ${this.args.join(' ')}`;
  }
}
