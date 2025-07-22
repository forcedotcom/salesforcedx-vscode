/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {
  SFDX_PROJECT_FILE,
  ENV_SF_TARGET_ORG,
  ENV_SF_ORG_INSTANCE_URL,
  SF_CONFIG_ISV_DEBUGGER_SID,
  SF_CONFIG_ISV_DEBUGGER_URL,
  TARGET_ORG_KEY,
  DEFAULT_CONNECTION_TIMEOUT_MS,
  CLIENT_ID,
  SFDX_FOLDER
} from './constants';
import { Event, ExtensionContext, Uri, ExtensionKind } from 'vscode';

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

// Telemetry types
//////////////////

export interface TelemetryReporter {
  sendTelemetryEvent(
    eventName: string,
    properties?: {
      [key: string]: string;
    },
    measurements?: {
      [key: string]: number;
    }
  ): void;
  sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: {
      [key: string]: number;
    }
  ): void;
  dispose(): Promise<void>;
}

export type Measurements = {
  [key: string]: number;
};

export type Properties = {
  [key: string]: string;
};

export type TelemetryData = {
  properties?: Properties;
  measurements?: Measurements;
};

export type ExtensionInfo = {
  isActive: boolean;
  path: string;
  kind: ExtensionKind;
  uri: Uri;
  loadStartDate: Date;
};

export type ExtensionsInfo = {
  [extensionId: string]: ExtensionInfo;
};

export type ActivationInfo = Partial<ExtensionInfo> & {
  startActivateHrTime: number; // Changed from [number, number] to number
  activateStartDate: Date;
  activateEndDate?: Date;
  extensionActivationTime: number;
  markEndTime?: number;
};

export interface TelemetryServiceInterface {
  /**
   * Initialize Telemetry Service during extension activation.
   * @param extensionContext extension context
   */
  initializeService(extensionContext: ExtensionContext): Promise<void>;
  /**
   * Helper to get the name for telemetryReporter
   * if the extension from extension pack, use salesforcedx-vscode
   * otherwise use the extension name
   * exported only for unit test
   */
  getTelemetryReporterName(): string;
  getReporters(): TelemetryReporter[];
  isTelemetryEnabled(): Promise<boolean>;
  checkCliTelemetry(): Promise<boolean>;
  isTelemetryExtensionConfigurationEnabled(): boolean;
  setCliTelemetryEnabled(isEnabled: boolean): void;
  sendActivationEventInfo(activationInfo: ActivationInfo): void;
  sendExtensionActivationEvent(startTime?: number, markEndTime?: number, telemetryData?: TelemetryData): void;
  sendExtensionDeactivationEvent(): void;
  sendCommandEvent(
    commandName?: string,
    startTime?: number,
    properties?: Properties,
    measurements?: Measurements
  ): void;
  sendException(name: string, message: string): void;
  sendEventData(
    eventName: string,
    properties?: {
      [key: string]: string;
    },
    measures?: {
      [key: string]: number;
    }
  ): void;
  dispose(): void;
}
