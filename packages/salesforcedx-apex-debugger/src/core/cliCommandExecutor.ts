/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TELEMETRY_HEADER, CancellationToken, Command } from '@salesforce/salesforcedx-utils';
import * as cross_spawn from 'cross-spawn';
import { SpawnOptions } from 'node:child_process';
import { CliCommandExecution } from './cliCommandExecution';

export class CliCommandExecutor {
  private readonly command: Command;
  private readonly options: SpawnOptions;

  constructor(command: Command, options: SpawnOptions) {
    this.command = command;
    // children inherit the extension host env; SFDX_TOOL attributes the invocation to these extensions
    // (@salesforce/plugin-telemetry reads it), and the caller's env wins over both.
    this.options = { ...options, env: { ...process.env, SFDX_TOOL: TELEMETRY_HEADER, ...options.env } };
  }

  public execute(cancellationToken?: CancellationToken): CliCommandExecution {
    const childProcess = cross_spawn(this.command.command, this.command.args, this.options);
    return new CliCommandExecution(this.command, childProcess, cancellationToken);
  }
}
