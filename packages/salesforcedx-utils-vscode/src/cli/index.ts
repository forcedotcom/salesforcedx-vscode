/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface Command {
  readonly command: string;
  readonly description?: string;
  readonly args: string[];

  toString(): string;
  toCommand(): string;
}

export { CommandBuilder, SfdxCommandBuilder } from './commandBuilder';
export {
  CliCommandExecutor,
  CliCommandExecution,
  CommandExecution,
  CompositeCliCommandExecutor
} from './commandExecutor';
export { CommandOutput } from './commandOutput';
export { LocalCommandExecution } from './localCommandExecutor';
