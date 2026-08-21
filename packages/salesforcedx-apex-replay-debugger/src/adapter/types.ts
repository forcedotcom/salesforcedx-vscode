/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DebugProtocol } from '@vscode/debugprotocol';
import { ApexExecutionOverlayResultCommandSuccess } from '../commands';

export type TraceCategory = 'all' | 'protocol' | 'logfile' | 'launch' | 'breakpoints';
export type Step = 'Over' | 'In' | 'Out' | 'Run';
export type ScopeType = 'local' | 'static' | 'global';

/** Overlay-result fetch outcome for a single heap dump, resolved host-side and passed to the adapter. */
export type HeapDumpResult = { heapDumpId: string } & (
  | { success: ApexExecutionOverlayResultCommandSuccess }
  | { error: string }
);

export type LaunchRequestArguments = DebugProtocol.LaunchRequestArguments & {
  logFileContents: string; // File contents (for web compatibility)
  logFilePath: string;
  logFileName: string;
  stopOnEntry?: boolean | true;
  trace?: boolean | string;
  lineBreakpointInfo?: import('@salesforce/salesforcedx-utils').LineBreakpointInfo[];
  heapDumpResults?: HeapDumpResult[];
} & (
    | {
        /** Path to Anonymous Apex script file. When set, frame lines use script line numbers directly; otherwise they map via debug log. */
        anonApexFilePath: string;
        /** 0-based line offset into anonApexFilePath where the executed selection starts. Added to script line numbers so breakpoints align with the source file. */
        anonApexLineOffset?: number;
      }
    | { anonApexFilePath?: never; anonApexLineOffset?: never }
  );
