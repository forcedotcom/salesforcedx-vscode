/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TelemetryReporterWithModifiableUserProperties } from './telemetryReporterConfig';
import type { TelemetryReporter as TelemetryReporterInterface } from '@salesforce/vscode-service-provider';
import { TelemetryReporter } from '@vscode/extension-telemetry';
import { Disposable } from 'vscode';

/**
 * Web-compatible Application Insights reporter using @vscode/extension-telemetry
 * This works in browser environments where the Node.js applicationinsights SDK is not available
 */
export class WebAppInsights extends Disposable implements TelemetryReporterInterface, TelemetryReporterWithModifiableUserProperties {
  private reporter: TelemetryReporter;
  public userId: string;
  public webUserId: string;

  // Use the same connection string as services extension for consistency
  private static readonly DEFAULT_AI_CONNECTION_STRING =
    'InstrumentationKey=f5cbbeba-e06b-4657-b99c-62024c9d36bf;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=1485438c-5495-43dc-8c0a-b51e860b6cba';

  constructor(
    private extensionId: string,
    private extensionVersion: string,
    _key: string, // Ignored - we use connection string instead
    userId: string,
    webUserId: string,
    _enableUniqueMetrics?: boolean // Not applicable for web reporter
  ) {
    super(() => this.reporter.dispose());
    this.userId = userId;
    this.webUserId = webUserId;
    // Convert instrumentation key to connection string format
    // For now, use the default connection string (same as services extension)
    // TODO: Could convert aiKey to connection string if needed
    this.reporter = new TelemetryReporter(WebAppInsights.DEFAULT_AI_CONNECTION_STRING);
  }

  public sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    try {
      // Add extension metadata to properties
      const enrichedProperties = {
        ...properties,
        extensionId: this.extensionId,
        extensionVersion: this.extensionVersion,
        userId: this.userId,
        webUserId: this.webUserId
      };
      this.reporter.sendTelemetryEvent(eventName, enrichedProperties, measurements);
    } catch (error) {
      console.error('Failed to send telemetry event:', error);
    }
  }

  public sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: { [key: string]: number }
  ): void {
    try {
      const properties = {
        exceptionName,
        exceptionMessage,
        extensionId: this.extensionId,
        extensionVersion: this.extensionVersion,
        userId: this.userId,
        webUserId: this.webUserId
      };
      this.reporter.sendTelemetryErrorEvent(exceptionName, properties, measurements);
    } catch (error) {
      console.error('Failed to send exception event:', error);
    }
  }

  public dispose(): Promise<void> {
    return this.reporter.dispose();
  }
}
