/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionContext, ExtensionKind, ExtensionMode, Uri } from 'vscode';

/* eslint-disable header/header */
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

export interface TelemetryReporter {
  sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void;

  sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: { [key: string]: number }
  ): void;

  dispose(): Promise<any>;
}
// end of Copyright (C) Microsoft Corporation. All rights reserved.

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
  startActivateHrTime: [number, number];
  activateStartDate: Date;
  activateEndDate?: Date;
  extensionActivationTime: number;
  markEndTime?: number;
};

export interface TelemetryServiceInterface {
  /**
   * Initialize Telemetry Service during extension activation.
   * @param extensionContext extension context
   * @param extensionName extension name
   */
  initializeService(extensionContext: ExtensionContext): Promise<void>;
  /**
   * Initialize Telemetry Service with name, foo, version, and extensionMode.
   * @param name extension name
   * @param apiKey
   * @param version extension version
   * @param extensionMode extension mode
   */
  initializeServiceWithAttributes(name: string, apiKey?: string, version?: string, extensionMode?: ExtensionMode): Promise<void>;

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

  sendExtensionActivationEvent(
    hrstart: [number, number],
    markEndTime?: number,
    telemetryData?: TelemetryData
  ): void;

  sendExtensionDeactivationEvent(): void;

  sendCommandEvent(
    commandName?: string,
    hrstart?: [number, number],
    properties?: Properties,
    measurements?: Measurements
  ): void;

  sendException(name: string, message: string): void;

  sendEventData(
    eventName: string,
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ): void;

  dispose(): void;

  getEndHRTime(hrstart: [number, number]): number;

  hrTimeToMilliseconds(hrtime: [number, number]): number;
}
