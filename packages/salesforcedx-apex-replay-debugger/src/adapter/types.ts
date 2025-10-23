/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import { DebugProtocol } from '@vscode/debugprotocol';

export type TraceCategory = 'all' | 'protocol' | 'logfile' | 'launch' | 'breakpoints';
export type Step = 'Over' | 'In' | 'Out' | 'Run';
export type ScopeType = 'local' | 'static' | 'global';

export type LaunchRequestArguments = DebugProtocol.LaunchRequestArguments & {
  logFileContents: string; // File contents (for web compatibility)
  logFilePath: string;
  logFileName: string;
  stopOnEntry?: boolean;
  trace?: boolean | string;
  lineBreakpointInfo?: LineBreakpointInfo[];
  projectPath: string | undefined;
};
