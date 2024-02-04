/* eslint-disable header/header */
/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as appInsights from 'applicationinsights';
import * as os from 'os';
import * as path from 'path';
import { Disposable, env, UIKind, version, workspace } from 'vscode';
import { WorkspaceContextUtil } from '../../context/workspaceContextUtil';
import { TelemetryReporter } from './telemetryReporter';

export class AppInsights extends Disposable implements TelemetryReporter {
  private appInsightsClient: appInsights.TelemetryClient | undefined;
  private userOptIn: boolean = false;
  private toDispose: Disposable[] = [];
  private uniqueUserMetrics: boolean = false;

  private static TELEMETRY_CONFIG_ID = 'telemetry';
  private static TELEMETRY_CONFIG_ENABLED_ID = 'enableTelemetry';

  constructor(
    private extensionId: string,
    private extensionVersion: string,
    key: string,
    enableUniqueMetrics?: boolean
  ) {
    super(() => this.toDispose.forEach(d => d && d.dispose()));
    let logFilePath = process.env['VSCODE_LOGS'] || '';
    if (
      logFilePath &&
      extensionId &&
      process.env['VSCODE_LOG_LEVEL'] === 'trace'
    ) {
      logFilePath = path.join(logFilePath, `${extensionId}.txt`);
    }
    if (enableUniqueMetrics) {
      this.uniqueUserMetrics = true;
    }
    this.updateUserOptIn(key);
    this.toDispose.push(
      workspace.onDidChangeConfiguration(() => this.updateUserOptIn(key))
    );
  }

  private updateUserOptIn(key: string): void {
    const config = workspace.getConfiguration(AppInsights.TELEMETRY_CONFIG_ID);
    if (
      this.userOptIn !==
      config.get<boolean>(AppInsights.TELEMETRY_CONFIG_ENABLED_ID, true)
    ) {
      this.userOptIn = config.get<boolean>(
        AppInsights.TELEMETRY_CONFIG_ENABLED_ID,
        true
      );
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

    this.appInsightsClient.commonProperties = this.getCommonProperties();
    if (this.uniqueUserMetrics && env) {
      this.appInsightsClient.context.tags['ai.user.id'] = env.machineId;
      this.appInsightsClient.context.tags['ai.session.id'] = env.sessionId;
      this.appInsightsClient.context.tags['ai.cloud.roleInstance'] =
        'DEPRECATED';
    }

    // check if it's an Asimov key to change the endpoint
    if (key && key.indexOf('AIF-') === 0) {
      this.appInsightsClient.config.endpointUrl =
        'https://vortex.data.microsoft.com/collect/v1';
    }
  }

  private getCommonProperties(): { [key: string]: string } {
    const commonProperties = Object.create(null);
    commonProperties['common.os'] = os.platform();
    commonProperties['common.platformversion'] = (os.release() || '').replace(
      /^(\d+)(\.\d+)?(\.\d+)?(.*)/,
      '$1$2$3'
    );
    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      commonProperties[
        'common.cpus'
      ] = `${cpus[0].model}(${cpus.length} x ${cpus[0].speed})`;
    }
    commonProperties['common.systemmemory'] = `${(
      os.totalmem() /
      (1024 * 1024 * 1024)
    ).toFixed(2)} GB`;
    commonProperties['common.extname'] = this.extensionId;
    commonProperties['common.extversion'] = this.extensionVersion;
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

  public sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    if (this.userOptIn && eventName && this.appInsightsClient) {
      const orgId = WorkspaceContextUtil.getInstance().orgId;
      if (orgId && properties) {
        properties.orgId = orgId;
      } else if (orgId) {
        properties = { orgId };
      }
      this.appInsightsClient.trackEvent({
        name: `${this.extensionId}/${eventName}`,
        // tslint:disable-next-line:object-literal-shorthand
        properties,
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
      const properties = { orgId };
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
    return Promise.all([flushEventsToAI]);
  }
}
