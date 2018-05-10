/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export class Command {
  public readonly command: string;
  public readonly description?: string;
  public readonly args: string[];

  public constructor(builder: CommandBuilder) {
    this.command = builder.command;
    this.description = builder.description;
    this.args = builder.args;
  }

  public toString(): string {
    return this.description
      ? this.description
      : `${this.command} ${this.args.join(' ')}`;
  }

  public toCommand(): string {
    return `${this.command} ${this.args.join(' ')}`;
  }
}

export class CommandBuilder {
  public readonly command: string;
  public description?: string;
  public args: string[] = [];

  public constructor(command: string) {
    this.command = command;
  }

  public withDescription(description: string): CommandBuilder {
    this.description = description;
    return this;
  }

  public withArg(arg: string): CommandBuilder {
    if (arg === '--json') {
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
    this.args.push('--json');
    this.args.push('--loglevel', 'fatal');
    return this;
  }

  public build(): Command {
    return new Command(this);
  }
}

export class SfdxCommandBuilder extends CommandBuilder {
  public constructor() {
    super('sfdx');
  }
}
