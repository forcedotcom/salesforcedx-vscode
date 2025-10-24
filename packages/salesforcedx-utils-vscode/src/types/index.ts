/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  CLIENT_ID,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  ENV_SF_TARGET_ORG,
  ENV_SF_ORG_INSTANCE_URL,
  SF_CONFIG_ISV_DEBUGGER_SID,
  SF_CONFIG_ISV_DEBUGGER_URL
} from '@salesforce/salesforcedx-utils';
import { Event } from 'vscode';

export const TARGET_ORG_KEY = 'target-org';
export const SFDX_PROJECT_FILE = 'sfdx-project.json';
export const SFDX_FOLDER = '.sfdx';

// Precondition checking
////////////////////////
export type PreconditionChecker = {
  check(): Promise<boolean> | boolean;
};

export type PostconditionChecker<T> = {
  check(inputs: ContinueResponse<T> | CancelResponse): Promise<ContinueResponse<T> | CancelResponse>;
};

// Input gathering
//////////////////
export type ContinueResponse<T> = {
  type: 'CONTINUE';
  data: T;
};

export type CancelResponse = {
  type: 'CANCEL';
  msg?: string;
};

export type ParametersGatherer<T> = {
  gather(): Promise<CancelResponse | ContinueResponse<T>>;
};

// Execution
//////////////////
export type FlagParameter<T> = {
  flag: T;
};

export type CommandletExecutor<T> = {
  execute(response: ContinueResponse<T>): void | Promise<void>;
  readonly onDidFinishExecution?: Event<number>;
};

// Selection
////////////

export type DirFileNameSelection = {
  /**
   * Name of the component (FullName in the API)
   */
  fileName: string;

  /**
   * Relative workspace path to save the component
   */
  outputdir: string;

  /**
   * used for selecting the different apex unit test templates
   */
  template?: 'ApexUnitTest' | 'BasicUnitTest';

  /**
   * Used for selecting file extension type
   */
  extension?: 'JavaScript' | 'TypeScript';
};

/**
 * Representation of a metadata component to be written to the local workspace
 */
export type LocalComponent = DirFileNameSelection & {
  /**
   * The component's metadata type
   */
  type: string;

  /**
   * Optional suffix to overwrite in case metadata dictionary does not have it
   */
  suffix?: string;
};

export { MessageArgs } from '@salesforce/salesforcedx-utils';
export { CommandExecution } from './commandExecution';

// Re-export telemetry types from vscode-service-provider
export {
  TelemetryReporter,
  Measurements,
  Properties,
  TelemetryData,
  ExtensionInfo,
  ExtensionsInfo,
  ActivationInfo,
  TelemetryServiceInterface
} from '@salesforce/vscode-service-provider';
