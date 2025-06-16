/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DebugProtocol } from '@vscode/debugprotocol';

export type TraceCategory = 'all' | 'protocol' | 'logfile' | 'launch' | 'breakpoints';
export type Step = 'Over' | 'In' | 'Out' | 'Run';
export type ScopeType = 'local' | 'static' | 'global';

export type LaunchRequestArguments = DebugProtocol.LaunchRequestArguments & {
  logFile: string;
  stopOnEntry?: boolean | true;
  trace?: boolean | string;
  lineBreakpointInfo?: import('@salesforce/salesforcedx-utils').LineBreakpointInfo[];
  projectPath: string | undefined;
};
