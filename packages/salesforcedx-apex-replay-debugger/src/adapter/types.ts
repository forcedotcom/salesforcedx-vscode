// Types for Apex Replay Debugger
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
