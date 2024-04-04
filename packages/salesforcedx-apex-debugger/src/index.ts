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

export interface Metric {
  subject: string;
  type: string;
}

// Type guard to check if the object conforms to Metric
export const isMetric = (object: any): object is Metric => (
  object !== null &&
  typeof object === 'object' &&
  Object.keys(object).length === 2 &&
  'subject' in object &&
  typeof object.subject === 'string' &&
  'type' in object &&
  typeof object.type === 'string'
);