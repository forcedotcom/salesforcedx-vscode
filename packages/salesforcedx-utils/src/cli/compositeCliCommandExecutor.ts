/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CancellationToken } from '../types';
import { Command } from './command';
import { CompositeCliCommandExecution } from './compositeCliCommandExecution';

export class CompositeCliCommandExecutor {
  private readonly command: Command;

  public constructor(commands: Command) {
    this.command = commands;
  }

  public execute(cancellationToken?: CancellationToken): CompositeCliCommandExecution {
    return new CompositeCliCommandExecution(this.command, cancellationToken);
  }
}
