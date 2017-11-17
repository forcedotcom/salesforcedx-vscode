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
