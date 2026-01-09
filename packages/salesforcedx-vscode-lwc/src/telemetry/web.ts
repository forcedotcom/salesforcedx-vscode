/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TelemetryServiceInterface, TelemetryReporter } from '@salesforce/vscode-service-provider';
import type { ExtensionContext } from 'vscode';

/**
 * No-op telemetry service for web mode where applicationinsights is not available
 */
class NoOpTelemetryService implements TelemetryServiceInterface {
  public async initializeService(_extensionContext: ExtensionContext): Promise<void> {
    // No-op
  }

  public sendExtensionActivationEvent(): void {
    // No-op
  }

  public sendExtensionDeactivationEvent(): void {
    // No-op
  }

  public sendCommandEvent(): void {
    // No-op
  }

  public sendException(): void {
    // No-op
  }

  public sendEventData(): void {
    // No-op
  }

  public sendActivationEventInfo(): void {
    // No-op
  }

  public dispose(): void {
    // No-op
  }

  public isTelemetryExtensionConfigurationEnabled(): boolean {
    return false;
  }

  public checkCliTelemetry(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public isTelemetryEnabled(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public setCliTelemetryEnabled(): void {
    // No-op
  }

  public getReporters(): TelemetryReporter[] {
    return [];
  }

  public getTelemetryReporterName(): string {
    return 'no-op';
  }

  public hrTimeToMilliseconds(): number {
    return 0;
  }

  public getEndHRTime(): number {
    return 0;
  }
}

export const telemetryService = new NoOpTelemetryService();
