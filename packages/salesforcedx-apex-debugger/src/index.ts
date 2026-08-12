/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  DEBUGGER_LAUNCH_TYPE,
  DEBUGGER_TYPE,
  EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
  EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
  SHOW_MESSAGE_EVENT,
  SEND_METRIC_EVENT,
  LIVESHARE_DEBUGGER_TYPE,
  HOTSWAP_REQUEST,
  LIST_EXCEPTION_BREAKPOINTS_REQUEST,
  LIVESHARE_DEBUG_TYPE_REQUEST,
  EXCEPTION_BREAKPOINT_REQUEST,
  SF_CONFIG_ISV_DEBUGGER_SID,
  SF_CONFIG_ISV_DEBUGGER_URL
} from './constants';
export type { SetExceptionBreakpointsArguments } from './adapter/apexDebug';
export enum VscodeDebuggerMessageType {
  Info,
  Warning,
  Error
}

export type VscodeDebuggerMessage = {
  type: VscodeDebuggerMessageType;
  message: string;
};

export type WorkspaceSettings = {
  proxyUrl: string;
  proxyStrictSSL: boolean;
  proxyAuth: string;
  connectionTimeoutMs: number;
};

// Define the metric payload sent to the debugger extension.
type Metric = {
  subject: string;
  type: string;
};

// Type guard to check if the object conforms to Metric
export const isMetric = (input: unknown): input is Metric =>
  !!input &&
  Object.keys(input).every(key => ['subject', 'type'].includes(key)) &&
  Object.values(input).every(value => typeof value === 'string');
