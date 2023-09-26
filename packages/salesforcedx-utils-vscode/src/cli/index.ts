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
  readonly logName?: string;

  toString(): string;
  toCommand(): string;
}

export { CommandBuilder, SfdxCommandBuilder } from './commandBuilder';
export {
  CliCommandExecution,
  CliCommandExecutor,
  CommandExecution,
  CompositeCliCommandExecution,
  CompositeCliCommandExecutor,
  GlobalCliEnvironment
} from './commandExecutor';
export { CommandOutput } from './commandOutput';
export {
  DiffErrorResponse,
  DiffResultParser,
  DiffSuccessResponse
} from './diffResultParser';
export { ForceConfigGet } from './forceConfigGet';
export { LocalCommandExecution } from './localCommandExecutor';
export {
  OrgCreateErrorResult,
  OrgCreateResultParser,
  OrgCreateSuccessResult
} from './orgCreateResultParser';
export { OrgDisplay, OrgInfo } from './orgDisplay';
export {
  OrgOpenContainerResultParser,
  OrgOpenErrorResult,
  OrgOpenSuccessResult
} from './orgOpenContainerResultParser';
export { ForcePullResultParser, PullResult } from './parsers/pullResultParser';
export {
  CONFLICT_ERROR_NAME,
  ForcePushResultParser,
  ForceSourcePushErrorResponse,
  ForceSourcePushSuccessResponse,
  PushResult
} from './parsers/pushResultParser';
