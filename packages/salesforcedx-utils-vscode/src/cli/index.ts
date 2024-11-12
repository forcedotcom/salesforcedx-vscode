/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type Command = {
  readonly command: string;
  readonly description?: string;
  readonly args: string[];
  readonly logName?: string;

  toString(): string;
  toCommand(): string;
};

export { CommandBuilder, SfCommandBuilder } from './commandBuilder';
export {
  CliCommandExecution,
  CliCommandExecutor,
  CommandExecution,
  CompositeCliCommandExecution,
  CompositeCliCommandExecutor,
  GlobalCliEnvironment
} from './commandExecutor';
export { CommandOutput } from './commandOutput';
export { DiffErrorResponse, DiffResultParser, DiffSuccessResponse } from './diffResultParser';
export { ConfigGet } from './configGet';
export { LocalCommandExecution } from './localCommandExecutor';
export { OrgCreateErrorResult, OrgCreateResultParser, OrgCreateSuccessResult } from './orgCreateResultParser';
export { OrgDisplay, OrgInfo } from './orgDisplay';
export { OrgOpenContainerResultParser, OrgOpenErrorResult, OrgOpenSuccessResult } from './orgOpenContainerResultParser';
export {
  ProjectRetrieveStartResultParser,
  ProjectRetrieveStartResult
} from './parsers/projectRetrieveStartResultParser';
export {
  CONFLICT_ERROR_NAME,
  ProjectDeployStartResultParser,
  ProjectDeployStartErrorResponse,
  ProjectDeployStartSuccessResponse,
  ProjectDeployStartResult
} from './parsers/projectDeployStartResultParser';
