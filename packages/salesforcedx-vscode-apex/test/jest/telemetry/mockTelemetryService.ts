/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  TelemetryService,
  ActivationInfo,
  Measurements,
  Properties,
  TelemetryData,
  TelemetryReporter,
  TelemetryServiceInterface
} from '@salesforce/salesforcedx-utils-vscode';
import { ExtensionContext } from 'vscode';

export class MockTelemetryService extends TelemetryService implements TelemetryServiceInterface {
  public sentEvents: {
    eventName: string;
    properties?: { [key: string]: string };
    measurements?: { [key: string]: number };
  }[] = [];

  public sentExceptions: {
    exceptionName: string;
    exceptionMessage: string;
    measurements?: { [key: string]: number };
  }[] = [];

  public isTelemetryExtensionConfigurationEnabled(): boolean {
    return true;
  }

  public checkCliTelemetry(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public isTelemetryEnabled(): Promise<boolean> {
    return Promise.resolve(true);
  }

  public setCliTelemetryEnabled(_isEnabled: boolean): void {
    // Mock implementation
  }

  public getReporters(): TelemetryReporter[] {
    return [];
  }

  public getTelemetryReporterName(): string {
    return 'mockTelemetryReporter';
  }

  public sendActivationEventInfo(activationInfo: ActivationInfo): void {
    // Mock implementation - use local ActivationInfo type
  }

  public sendExtensionActivationEvent(hrstart?: number, markEndTime?: number, telemetryData?: TelemetryData): void {
    // Mock implementation - uses number instead of [number, number]
  }

  public sendExtensionDeactivationEvent(): void {
    // Mock implementation
  }

  public sendCommandEvent(
    commandName?: string,
    hrstart?: number,
    properties?: Properties,
    measurements?: Measurements
  ): void {
    // Mock implementation - uses number instead of [number, number]
  }

  public sendEventData(
    eventName: string,
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ): void {
    this.sentEvents.push({
      eventName,
      properties,
      measurements: measures
    });
  }

  public sendException(name: string, message: string): void {
    this.sentExceptions.push({
      exceptionName: name,
      exceptionMessage: message
    });
  }

  public getEndHRTime(hrstart: number): number {
    // Mock implementation - uses number instead of [number, number]
    return 100;
  }

  public dispose(): void {
    // Mock implementation
  }

  public initializeService(_extensionContext: ExtensionContext): Promise<void> {
    return Promise.resolve();
  }
}
