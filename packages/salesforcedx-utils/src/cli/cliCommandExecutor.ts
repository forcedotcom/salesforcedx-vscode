/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SpawnOptions } from 'child_process';
import * as cross_spawn from 'cross-spawn';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/interval';

import { TELEMETRY_HEADER } from '../constants';
import { CancellationToken, Command } from '../types';
import { CliCommandExecution } from './cliCommandExecution';
import { GlobalCliEnvironment } from './globalCliEnvironment';

export class CliCommandExecutor {
  protected static patchEnv(
    options: SpawnOptions,
    baseEnvironment: Map<string, string>
  ): SpawnOptions {
    // start with current process environment
    const env = Object.create(null);

    // inherit current process environment
    Object.assign(env, process.env);

    // now push anything from global environment
    baseEnvironment.forEach((value, key) => {
      env[key] = value;
    });

    if (env) {
      env.SFDX_TOOL = TELEMETRY_HEADER;
    }

    // then specific environment from Spawn Options
    if (typeof options.env !== 'undefined') {
      Object.assign(env, options.env);
    }

    options.env = env;
    return options;
  }

  private readonly command: Command;
  private readonly options: SpawnOptions;

  public constructor(
    command: Command,
    options: SpawnOptions,
    inheritGlobalEnvironmentVariables = true
  ) {
    this.command = command;
    this.options = inheritGlobalEnvironmentVariables
      ? CliCommandExecutor.patchEnv(
          options,
          GlobalCliEnvironment.environmentVariables
        )
      : options;
  }

  public execute(cancellationToken?: CancellationToken): CliCommandExecution {
    const childProcess = cross_spawn(
      this.command.command,
      this.command.args,
      this.options
    );
    return new CliCommandExecution(
      this.command,
      childProcess,
      cancellationToken
    );
  }
}
