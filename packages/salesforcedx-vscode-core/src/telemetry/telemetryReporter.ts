/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

'use strict';

import * as appInsights from 'applicationinsights';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

export default class TelemetryReporter extends vscode.Disposable {
  private appInsightsClient: appInsights.TelemetryClient | undefined;
  private userOptIn: boolean = false;
  private toDispose: vscode.Disposable[] = [];
  private uniqueUserMetrics: boolean = false;

  private static TELEMETRY_CONFIG_ID = 'telemetry';
  private static TELEMETRY_CONFIG_ENABLED_ID = 'enableTelemetry';

  private logStream: fs.WriteStream | undefined;

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
      this.logStream = fs.createWriteStream(logFilePath, {
        flags: 'a',
        encoding: 'utf8',
        autoClose: true
      });
    }
    if (enableUniqueMetrics) {
      this.uniqueUserMetrics = true;
    }
    this.updateUserOptIn(key);
    this.toDispose.push(
      vscode.workspace.onDidChangeConfiguration(() => this.updateUserOptIn(key))
    );
  }

  private updateUserOptIn(key: string): void {
    const config = vscode.workspace.getConfiguration(
      TelemetryReporter.TELEMETRY_CONFIG_ID
    );
    if (
      this.userOptIn !==
      config.get<boolean>(TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID, true)
    ) {
      this.userOptIn = config.get<boolean>(
        TelemetryReporter.TELEMETRY_CONFIG_ENABLED_ID,
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
    if (this.uniqueUserMetrics && vscode && vscode.env) {
      this.appInsightsClient.context.tags['ai.user.id'] = vscode.env.machineId;
      this.appInsightsClient.context.tags['ai.session.id'] =
        vscode.env.sessionId;
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
      commonProperties['common.cpus'] = `${cpus[0].model}(${cpus.length} x ${
        cpus[0].speed
      })`;
    }
    commonProperties['common.systemmemory'] = `${(
      os.totalmem() /
      (1024 * 1024 * 1024)
    ).toFixed(2)} GB`;
    commonProperties['common.extname'] = this.extensionId;
    commonProperties['common.extversion'] = this.extensionVersion;
    if (vscode && vscode.env) {
      commonProperties['common.vscodemachineid'] = vscode.env.machineId;
      commonProperties['common.vscodesessionid'] = vscode.env.sessionId;
      commonProperties['common.vscodeversion'] = vscode.version;
    }
    return commonProperties;
  }

  public sendTelemetryEvent(
    eventName: string,
    properties?: { [key: string]: string },
    measurements?: { [key: string]: number }
  ): void {
    if (this.userOptIn && eventName && this.appInsightsClient) {
      this.appInsightsClient.trackEvent({
        name: `${this.extensionId}/${eventName}`,
        // tslint:disable-next-line:object-literal-shorthand
        properties: properties,
        // tslint:disable-next-line:object-literal-shorthand
        measurements: measurements
      });

      if (this.logStream) {
        this.logStream.write(
          `telemetry/${eventName} ${JSON.stringify({
            properties,
            measurements
          })}\n`
        );
      }
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

      this.appInsightsClient.trackException({
        exception: error,
        measurements
      });

      if (this.logStream) {
        this.logStream.write(
          `telemetry/${exceptionName} ${JSON.stringify({
            measurements
          })}\n`
        );
      }
    }
  }

  public dispose(): Promise<any> {
    const flushEventsToLogger = new Promise<any>(resolve => {
      if (!this.logStream) {
        return resolve(void 0);
      }
      this.logStream.on('finish', resolve);
      this.logStream.end();
    });

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
    return Promise.all([flushEventsToAI, flushEventsToLogger]);
  }
}
