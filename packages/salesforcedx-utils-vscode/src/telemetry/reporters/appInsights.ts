/* eslint-disable header/header */
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import type { TelemetryReporterWithModifiableUserProperties } from './telemetryReporterConfig';
import type { TelemetryReporter } from '@salesforce/vscode-service-provider';
import { TelemetryReporter as VSCodeTelemetryReporter } from '@vscode/extension-telemetry';
import { Disposable, env, workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../context/workspaceContextUtil';
import { isInternalHost } from '../utils/isInternal';
import { getCommonProperties, getInternalProperties } from './telemetryUtils';

// Connection string for Application Insights
// Shared with salesforcedx-vscode-services for consistency
const DEFAULT_AI_CONNECTION_STRING =
  'InstrumentationKey=f5cbbeba-e06b-4657-b99c-62024c9d36bf;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=1485438c-5495-43dc-8c0a-b51e860b6cba';

// Conditionally import applicationinsights only in Node.js mode
let appInsights: typeof import('applicationinsights') | undefined;
if (process.env.ESBUILD_PLATFORM !== 'web') {
  appInsights = require('applicationinsights');
}

export class AppInsights
  extends Disposable
  implements TelemetryReporter, TelemetryReporterWithModifiableUserProperties
{
  private appInsightsClient: typeof appInsights extends undefined
    ? undefined
    : import('applicationinsights').TelemetryClient | undefined;
  private webReporter: VSCodeTelemetryReporter | undefined;
  private userOptIn: boolean = false;
  private toDispose: Disposable[] = [];
  private uniqueUserMetrics: boolean = false;
  private readonly isWebMode: boolean;

  private static TELEMETRY_CONFIG_ID = 'telemetry';
  private static TELEMETRY_CONFIG_ENABLED_ID = 'enableTelemetry';

  // user defined tag to add to properties that is defined via setting
  private telemetryTag: string | undefined;

  constructor(
    private extensionId: string,
    private extensionVersion: string,
    key: string,
    public userId: string,
    public webUserId: string,
    enableUniqueMetrics?: boolean
  ) {
    super(() => this.toDispose.forEach(d => d?.dispose()));
    this.isWebMode = process.env.ESBUILD_PLATFORM === 'web';
    if (enableUniqueMetrics) {
      this.uniqueUserMetrics = true;
    }
    this.setTelemetryTag();
    this.updateUserOptIn(key);
    this.toDispose.push(workspace.onDidChangeConfiguration(() => this.updateUserOptIn(key)));
  }

  private updateUserOptIn(key: string): void {
    const config = workspace.getConfiguration(AppInsights.TELEMETRY_CONFIG_ID);
    if (this.userOptIn !== config.get<boolean>(AppInsights.TELEMETRY_CONFIG_ENABLED_ID, true)) {
      this.userOptIn = config.get<boolean>(AppInsights.TELEMETRY_CONFIG_ENABLED_ID, true);
      if (this.userOptIn) {
        if (this.isWebMode) {
          this.createWebReporter();
        } else {
          this.createAppInsightsClient(key);
        }
      } else {
        void this.dispose();
      }
    }
  }

  private createWebReporter(): void {
    // In web mode, use @vscode/extension-telemetry which works in browsers
    this.webReporter = new VSCodeTelemetryReporter(DEFAULT_AI_CONNECTION_STRING);
  }

  private createAppInsightsClient(key: string) {
    if (!appInsights) {
      throw new Error('applicationinsights is not available in web mode');
    }
    // check if another instance is already initialized
    if (appInsights.defaultClient) {
      this.appInsightsClient = new appInsights.TelemetryClient(key);
      // no other way to enable offline mode
      this.appInsightsClient.channel.setUseDiskRetryCaching(true);
    } else {
      appInsights
        .setup(key)
        .setAutoCollectRequests(false)
        .setAutoCollectPerformance(false)
        .setAutoCollectExceptions(false)
        .setAutoCollectDependencies(false)
        .setAutoDependencyCorrelation(false)
        .setAutoCollectConsole(false)
        .setUseDiskRetryCaching(true)
        .start();
      this.appInsightsClient = appInsights.defaultClient;
    }
    this.appInsightsClient.commonProperties = this.aggregateLoggingProperties();

    if (this.uniqueUserMetrics && env) {
      this.appInsightsClient.context.tags['ai.user.id'] = this.userId;
      this.appInsightsClient.context.tags['ai.session.id'] = env.sessionId;
      this.appInsightsClient.context.tags['ai.application.ver'] = this.extensionVersion;
      this.appInsightsClient.context.tags['ai.cloud.roleInstance'] = 'DEPRECATED';
    }

    // check if it's an Asimov key to change the endpoint
    if (key && key.indexOf('AIF-') === 0) {
      this.appInsightsClient.config.endpointUrl = 'https://vortex.data.microsoft.com/collect/v1';
    }
  }

  private aggregateLoggingProperties() {
    const commonProperties = getCommonProperties(this.extensionId, this.extensionVersion);
    return isInternalHost()
      ? { ...commonProperties, ...getInternalProperties(), webUserId: this.webUserId }
      : { ...commonProperties, webUserId: this.webUserId };
  }

  public sendTelemetryEvent(
    eventName: string,
    properties: { [key: string]: string } = {},
    measurements?: { [key: string]: number }
  ): void {
    if (!this.userOptIn || !eventName) {
      return;
    }

    const baseProps = getBaseProps();
    const finalProps = this.applyTelemetryTag({ ...baseProps, ...properties, webUserId: this.webUserId });

    if (this.isWebMode) {
      if (this.webReporter) {
        try {
          // Add extension metadata to properties for web mode
          const enrichedProperties = {
            ...finalProps,
            extensionId: this.extensionId,
            extensionVersion: this.extensionVersion,
            userId: this.userId
          };
          this.webReporter.sendTelemetryEvent(eventName, enrichedProperties, measurements);
        } catch (error) {
          console.error('Failed to send telemetry event:', error);
        }
      }
    } else {
      if (this.appInsightsClient) {
        this.appInsightsClient.trackEvent({
          name: `${this.extensionId}/${eventName}`,
          properties: finalProps,
          measurements
        });
      }
    }
  }

  public sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: { [key: string]: number }
  ): void {
    if (!this.userOptIn || !exceptionMessage) {
      return;
    }

    const baseProps = getBaseProps();
    const finalProps = this.applyTelemetryTag({ ...baseProps, webUserId: this.webUserId });

    if (this.isWebMode) {
      if (this.webReporter) {
        try {
          const properties = {
            ...finalProps,
            exceptionName,
            exceptionMessage,
            extensionId: this.extensionId,
            extensionVersion: this.extensionVersion,
            userId: this.userId
          };
          this.webReporter.sendTelemetryErrorEvent(exceptionName, properties, measurements);
        } catch (error) {
          console.error('Failed to send exception event:', error);
        }
      }
    } else {
      if (this.appInsightsClient) {
        const error = new Error(exceptionMessage);
        error.name = `${this.extensionId}/${exceptionName}`;
        error.stack = 'DEPRECATED';

        this.appInsightsClient.trackException({
          exception: error,
          properties: finalProps,
          measurements
        });
      }
    }
  }

  public dispose(): Promise<any> {
    if (this.isWebMode) {
      if (this.webReporter) {
        this.webReporter = undefined;
        return Promise.resolve(void 0);
      }
      return Promise.resolve(void 0);
    }

    const flushEventsToAI = new Promise<any>(resolve => {
      if (this.appInsightsClient) {
        this.appInsightsClient.flush({
          callback: () => {
            // all data flushed
            this.appInsightsClient = undefined;
            resolve(void 0);
          }
        });
      } else {
        resolve(void 0);
      }
    });
    return flushEventsToAI;
  }

  /**
   * Helper to set reporter's telemetryTag from setting salesforcedx-vscode-core.telemetry-tag
   * @returns string | undefined
   */
  private setTelemetryTag(): void {
    const config = workspace.getConfiguration();
    this.telemetryTag = config?.get('salesforcedx-vscode-core.telemetry-tag');
  }

  /**
   * Helper to include telemetryTag in properties if it exists
   * if not, return properties as is
   *
   * @param properties
   * @returns
   */
  private applyTelemetryTag(properties: { [key: string]: string }): {
    [key: string]: string;
  } {
    return this.telemetryTag ? { ...properties, telemetryTag: this.telemetryTag } : properties;
  }
}

const getBaseProps = (): Record<string, string> => {
  const context = WorkspaceContextUtil.getInstance();
  const { orgId = '', orgShape = '', devHubId = '' } = context;
  return orgId ? { orgId, orgShape, devHubId } : {};
};
