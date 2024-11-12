/* eslint-disable header/header */
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import { TelemetryReporter } from '@salesforce/vscode-service-provider';
import * as appInsights from 'applicationinsights';
import * as os from 'os';
import { Disposable, env, UIKind, version, workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../context/workspaceContextUtil';
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
    readonly userId: string,
    enableUniqueMetrics?: boolean
  ) {
    super(() => this.toDispose.forEach(d => d && d.dispose()));
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
        // tslint:disable-next-line:no-floating-promises
        this.dispose();
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
      'common.platformversion': (os.release() || '').replace(/^(\d+)(\.\d+)?(\.\d+)?(.*)/, '$1$2$3'),
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
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    if (this.userOptIn && eventName && this.appInsightsClient) {
      const orgId = WorkspaceContextUtil.getInstance().orgId;
      const orgShape = WorkspaceContextUtil.getInstance().orgShape || '';
      const devHubId = WorkspaceContextUtil.getInstance().devHubId || '';
      let props = properties ? properties : {};
      props = this.applyTelemetryTag(orgId ? { ...props, orgId, orgShape, devHubId } : props);

      this.appInsightsClient.trackEvent({
        name: `${this.extensionId}/${eventName}`,
        // tslint:disable-next-line:object-literal-shorthand
        properties: props,
        // tslint:disable-next-line:object-literal-shorthand
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
      const error = new Error();
      error.name = `${this.extensionId}/${exceptionName}`;
      error.message = exceptionMessage;
      error.stack = 'DEPRECATED';

      const orgId = WorkspaceContextUtil.getInstance().orgId || '';
      const orgShape = WorkspaceContextUtil.getInstance().orgShape || '';
      const devHubId = WorkspaceContextUtil.getInstance().devHubId || '';
      const properties = this.applyTelemetryTag({ orgId, orgShape, devHubId });
      this.appInsightsClient.trackException({
        exception: error,
        properties,
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
    this.telemetryTag = config?.get('salesforcedx-vscode-core.telemetry-tag') || undefined;
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
