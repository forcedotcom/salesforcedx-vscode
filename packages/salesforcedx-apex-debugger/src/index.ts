/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export * from './constants';
export { SetExceptionBreakpointsArguments } from './adapter/apexDebug';

export enum VscodeDebuggerMessageType {
  Info,
  Warning,
  Error
}

export interface VscodeDebuggerMessage {
  type: VscodeDebuggerMessageType;
  message: string;
}

export interface WorkspaceSettings {
  proxyUrl: string;
  proxyStrictSSL: boolean;
  proxyAuth: string;
  connectionTimeoutMs: number;
  setBreakpointTimeoutMs: number;
}

// Define Metric object to be used for sending attributes to AppInsights telemetry
// NOTE: Refer to attribute names 'message' and 'eventName' defined in sendTelemetryEvent() in telemetryReporter.d.ts, which match the names in AppInsights telemetry
export interface Metric {
  message: string; // match 'subject' attribute in Event from messages.d.ts
  eventName: string; // match 'type' attribute in Event from messages.d.ts
}

// Type guard to check if the object conforms to Metric
export const isMetric = (input: unknown): input is Metric => {
  console.log('--- typeof(input) = ' + typeof input + '---');
  console.log('--- input = ' + String(input) + '---');
  console.log('!!input = ' + !!input);
  console.log(
    'Object.keys(input).every = ' +
      Object.keys(input as Object).every(key =>
        ['message', 'eventName'].includes(key)
      )
  );
  console.log(
    'Object.values(input).every = ' +
      Object.values(input as Object).every(value => typeof value === 'string')
  );
  return (
    !!input &&
    Object.keys(input).every(key => ['message', 'eventName'].includes(key)) &&
    Object.values(input).every(value => typeof value === 'string')
  );
};
