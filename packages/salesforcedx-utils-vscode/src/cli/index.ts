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
  CliCommandExecutor,
  CliCommandExecution,
  CommandExecution,
  CompositeCliCommandExecutor,
  CompositeCliCommandExecution,
  GlobalCliEnvironment
} from './commandExecutor';
export { CommandOutput } from './commandOutput';
export { ForceConfigGet } from './forceConfigGet';
export { ForceOrgDisplay, OrgInfo } from './forceOrgDisplay';
export { LocalCommandExecution } from './localCommandExecutor';
export {
  ForceDeployResultParser,
  ForceSourceDeployErrorResponse,
  ForceSourceDeploySuccessResponse,
  DeployResult,
  CONFLICT_ERROR_NAME
} from './deployResultParser';
export { TestRunner } from './testRunner';
export {
  OrgCreateSuccessResult,
  OrgCreateErrorResult,
  OrgCreateResultParser
} from './orgCreateResultParser';
export {
  OrgOpenSuccessResult,
  OrgOpenContainerResultParser,
  OrgOpenErrorResult
} from './orgOpenContainerResultParser';
export {
  DiffErrorResponse,
  DiffResultParser,
  DiffSuccessResponse
} from './diffResultParser';
