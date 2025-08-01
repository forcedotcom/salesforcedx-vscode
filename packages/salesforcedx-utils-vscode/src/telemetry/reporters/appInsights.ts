/* eslint-disable header/header */
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as appInsights from 'applicationinsights';
import * as os from 'node:os';
import { Disposable, env, UIKind, version, workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../context/workspaceContextUtil';
import { TelemetryReporter } from '../../types';
import { isInternalHost } from '../utils/isInternal';
import { CommonProperties, InternalProperties } from './loggingProperties';

export class AppInsights extends Disposable implements TelemetryReporter {
  private appInsightsClient: appInsights.TelemetryClient | undefined;
  private userOptIn: boolean = false;
  private toDispose: Disposable[] = [];
  private uniqueUserMetrics: boolean = false;

  private static TELEMETRY_CONFIG_ID = 'telemetry';
  private static TELEMETRY_CONFIG_ENABLED_ID = 'enableTelemetry';

  // user defined tag to add to properties that is defined via setting
  private telemetryTag: string | undefined;

  constructor(
    private extensionId: string,
    private extensionVersion: string,
    key: string,
    private readonly userId: string,
    enableUniqueMetrics?: boolean
  ) {
    super(() => this.toDispose.forEach(d => d?.dispose()));
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
        this.createAppInsightsClient(key);
      } else {
        void this.dispose();
      }
    }
  }

  private createAppInsightsClient(key: string) {
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
      this.appInsightsClient.context.tags['ai.cloud.roleInstance'] = 'DEPRECATED';
    }

    // check if it's an Asimov key to change the endpoint
    if (key && key.indexOf('AIF-') === 0) {
      this.appInsightsClient.config.endpointUrl = 'https://vortex.data.microsoft.com/collect/v1';
    }
  }

  private getCommonProperties(): CommonProperties {
    const commonProperties: CommonProperties = {
      'common.os': os.platform(),
      'common.platformversion': (os.release() ?? '').replace(/^(\d+)(\.\d+)?(\.\d+)?(.*)/, '$1$2$3'),
      'common.systemmemory': `${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      'common.extname': this.extensionId,
      'common.extversion': this.extensionVersion
    };

    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      commonProperties['common.cpus'] = `${cpus[0].model}(${cpus.length} x ${cpus[0].speed})`;
    }

    if (env) {
      commonProperties['common.vscodemachineid'] = env.machineId;
      commonProperties['common.vscodesessionid'] = env.sessionId;
      commonProperties['common.vscodeversion'] = version;
      if (env.uiKind) {
        commonProperties['common.vscodeuikind'] = UIKind[env.uiKind];
      }
    }

    return commonProperties;
  }

  private getInternalProperties(): InternalProperties {
    return {
      'sfInternal.hostname': os.hostname(),
      'sfInternal.username': os.userInfo().username
    };
  }

  private aggregateLoggingProperties() {
    const commonProperties = this.getCommonProperties();
    return isInternalHost() ? { ...commonProperties, ...this.getInternalProperties() } : commonProperties;
  }

  public sendTelemetryEvent(
    eventName: string,
    properties: { [key: string]: string } = {},
    measurements?: { [key: string]: number }
  ): void {
    if (this.userOptIn && eventName && this.appInsightsClient) {
      const baseProps = getBaseProps();
      const finalProps = this.applyTelemetryTag({ ...baseProps, ...properties });

      this.appInsightsClient.trackEvent({
        name: `${this.extensionId}/${eventName}`,
        properties: finalProps,
        measurements
      });
    }
  }

  public sendExceptionEvent(
    exceptionName: string,
    exceptionMessage: string,
    measurements?: { [key: string]: number }
  ): void {
    if (this.userOptIn && exceptionMessage && this.appInsightsClient) {
      const error = new Error(exceptionMessage);
      error.name = `${this.extensionId}/${exceptionName}`;
      error.stack = 'DEPRECATED';
      const baseProps = getBaseProps();

      const finalProps = this.applyTelemetryTag(baseProps);
      this.appInsightsClient.trackException({
        exception: error,
        properties: finalProps,
        measurements
      });
    }
  }

  public dispose(): Promise<any> {
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
