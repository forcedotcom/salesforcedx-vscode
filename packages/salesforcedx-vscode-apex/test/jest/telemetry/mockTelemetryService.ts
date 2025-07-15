/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */

import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import {
  TelemetryServiceInterface,
  ActivationInfo,
  TelemetryData,
  Properties,
  Measurements,
  TelemetryReporter
} from '@salesforce/vscode-service-provider';
import { ExtensionContext, ExtensionMode } from 'vscode';

export class MockTelemetryService extends TelemetryService implements TelemetryServiceInterface {
  initializeService(extensionContext: ExtensionContext): Promise<void> {
    return Promise.resolve();
  }
  initializeServiceWithAttributes(
    name: string,
    apiKey?: string,
    version?: string,
    extensionMode?: ExtensionMode
  ): Promise<void> {
    return Promise.resolve();
  }
  getReporters(): TelemetryReporter[] {
    return [];
  }
  getTelemetryReporterName(): string {
    return 'mock-reporter';
  }
  isTelemetryEnabled(): Promise<boolean> {
    return Promise.resolve(true);
  }
  checkCliTelemetry(): Promise<boolean> {
    return Promise.resolve(true);
  }
  isTelemetryExtensionConfigurationEnabled(): boolean {
    return true;
  }
  setCliTelemetryEnabled(isEnabled: boolean): void {
    // No-op implementation
  }
  sendActivationEventInfo(activationInfo: ActivationInfo): void {
    // No-op implementation
  }
  sendExtensionActivationEvent(hrstart?: number, markEndTime?: number, telemetryData?: TelemetryData): void {
    // No-op implementation
  }
  sendExtensionDeactivationEvent(): void {
    // No-op implementation
  }
  sendCommandEvent(commandName?: string, hrstart?: number, properties?: Properties, measurements?: Measurements): void {
    // No-op implementation
  }
  sendException(name: string, message: string): void {
    // No-op implementation
  }
  sendEventData(eventName: string, properties?: { [key: string]: string }, measures?: { [key: string]: number }): void {
    // No-op implementation
  }
  getEndHRTime(hrstart: number): number {
    return 3.141; // Mock implementation returning a fixed value
  }
  dispose(): void {
    // No-op implementation
  }
}
