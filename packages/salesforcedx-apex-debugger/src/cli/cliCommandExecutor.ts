/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as cross_spawn from 'cross-spawn';
import { SpawnOptions } from 'node:child_process';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/interval';
import { CancellationToken, CliCommandExecution } from './cliCommandExecution';
import { Command } from './command';

const TELEMETRY_HEADER = 'sfdx-vscode';

export class CliCommandExecutor {
  protected static patchEnv(options: SpawnOptions): SpawnOptions {
    // start with current process environment
    const env = Object.create(null);

    // inherit current process environment
    Object.assign(env, process.env);

    if (env) {
      env.SFDX_TOOL = TELEMETRY_HEADER;
    }

    // then specific environment from Spawn Options
    if (options.env !== undefined) {
      Object.assign(env, options.env);
    }

    options.env = env;
    return options;
  }

  private readonly command: Command;
  private readonly options: SpawnOptions;

  constructor(command: Command, options: SpawnOptions) {
    this.command = command;
    this.options = CliCommandExecutor.patchEnv(options);
  }

  public execute(cancellationToken?: CancellationToken): CliCommandExecution {
    const childProcess = cross_spawn(this.command.command, this.command.args, this.options);
    return new CliCommandExecution(this.command, childProcess, cancellationToken);
  }
}
