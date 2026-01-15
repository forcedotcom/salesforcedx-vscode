/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

/**
 * Simple telemetry service that uses vscode's telemetry API.
 * Replaces TelemetryService from @salesforce/salesforcedx-utils-vscode
 */
class TelemetryService {
  private static instances: Map<string, TelemetryService> = new Map();
  private reporter: vscode.TelemetryLogger | undefined;

  private constructor(_extensionId: string) {
    // Initialize telemetry logger if available
    try {
      // Create a simple telemetry sender
      const sender: vscode.TelemetrySender = {
        sendEventData: (eventName: string, data?: Record<string, any>) => {
          if (process.env.ESBUILD_PLATFORM === 'web') {
            console.debug('[Telemetry]', eventName, data);
          }
        },
        sendErrorData: (error: Error, data?: Record<string, any>) => {
          if (process.env.ESBUILD_PLATFORM === 'web') {
            console.debug('[Telemetry Error]', error, data);
          }
        }
      };
      this.reporter = vscode.env.createTelemetryLogger(sender);
    } catch {
      // Telemetry not available (e.g., in web environment)
      this.reporter = undefined;
    }
  }

  public static getInstance(extensionId: string): TelemetryService {
    if (!this.instances.has(extensionId)) {
      this.instances.set(extensionId, new TelemetryService(extensionId));
    }
    return this.instances.get(extensionId)!;
  }

  public async initializeService(_context: vscode.ExtensionContext): Promise<void> {
    // Telemetry is initialized in constructor
  }

  public sendEventData(
    eventName: string,
    properties?: Record<string, string>,
    measures?: Record<string, number>
  ): void {
    if (this.reporter) {
      this.reporter.logUsage(eventName, { ...properties, ...measures });
    } else if (process.env.ESBUILD_PLATFORM === 'web') {
      // In web, just log to console for debugging
      console.debug('[Telemetry]', eventName, properties, measures);
    }
  }

  public sendExtensionDeactivationEvent(): void {
    if (this.reporter) {
      this.reporter.logUsage('extensionDeactivated', {});
    }
  }
}

// Lazy initialization to avoid module load-time errors in web mode
let _telemetryService: TelemetryService | undefined;
export const telemetryService = {
  getInstance(): TelemetryService {
    _telemetryService ??= TelemetryService.getInstance('salesforcedx-vscode-apex-testing');
    return _telemetryService;
  },
  async initializeService(context: vscode.ExtensionContext): Promise<void> {
    return this.getInstance().initializeService(context);
  },
  sendEventData(eventName: string, properties?: Record<string, string>, measures?: Record<string, number>): void {
    this.getInstance().sendEventData(eventName, properties, measures);
  },
  sendExtensionDeactivationEvent(): void {
    this.getInstance().sendExtensionDeactivationEvent();
  }
};
