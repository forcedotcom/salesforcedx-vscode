/*
 * Copyright (c) 2017, salesforce.com, inc.
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
  EXCEPTION_BREAKPOINT_REQUEST
} from './constants';
export { SetExceptionBreakpointsArguments } from './adapter/apexDebug';
export { IsvContextUtil } from './context';
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
  setBreakpointTimeoutMs: number;
};

// Define Metric object to be used for sending attributes to AppInsights telemetry
// NOTE: Refer to attribute names 'message' and 'eventName' defined in sendTelemetryEvent() in telemetryReporter.d.ts, which match the names in AppInsights telemetry
type Metric = {
  message: string; // match 'subject' attribute in Event from messages.d.ts
  eventName: string; // match 'type' attribute in Event from messages.d.ts
};

// Type guard to check if the object conforms to Metric
export const isMetric = (input: unknown): input is Metric =>
  !!input &&
  Object.keys(input).every(key => ['subject', 'type'].includes(key)) &&
  Object.values(input).every(value => typeof value === 'string');
