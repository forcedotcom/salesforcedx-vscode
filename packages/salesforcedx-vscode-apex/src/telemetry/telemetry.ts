/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as util from 'util';
import TelemetryReporter from 'vscode-extension-telemetry';

const EXTENSION_NAME = 'salesforcedx-vscode-apex';

interface ErrorMetric {
  extensionName: string;
  errorMessage: string;
  errorStack?: string;
}

export class TelemetryService {
  private static instance: TelemetryService;
  private reporter: TelemetryReporter | undefined;
  private isTelemetryEnabled: boolean;

  constructor() {
    this.isTelemetryEnabled = false;
  }

  public static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public initializeService(
    reporter: TelemetryReporter,
    isTelemetryEnabled: boolean
  ): void {
    this.isTelemetryEnabled = isTelemetryEnabled;
    this.reporter = reporter;
  }

  public sendExtensionActivationEvent(hrstart: [number, number]): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      const startupTime = this.getEndHRTime(hrstart);
      this.reporter.sendTelemetryEvent(
        'activationEvent',
        {
          extensionName: EXTENSION_NAME
        },
        { startupTime }
      );
    }
  }

  public sendExtensionDeactivationEvent(): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent('deactivationEvent', {
        extensionName: EXTENSION_NAME
      });
    }
  }

  public sendApexLSPActivationEvent(hrstart: [number, number]): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      const startupTime = this.getEndHRTime(hrstart);
      this.reporter.sendTelemetryEvent(
        'apexLSPStartup',
        {
          extensionName: EXTENSION_NAME
        },
        { startupTime }
      );
    }
  }

  public sendApexLSPError(errorMsg: string): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent('apexLSPError', {
        extensionName: EXTENSION_NAME,
        errorMsg
      });
    }
  }

  public sendApexLSPLog(
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent('apexLSPLog', properties, measures);
    }
  }

  public sendErrorEvent(
    error: { message: string; stack?: string },
    properties?: any,
    measurements?: any
  ): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      const baseTelemetry: ErrorMetric = {
        extensionName: EXTENSION_NAME,
        errorMessage: error.message,
        errorStack: error.stack
      };

      const aggregatedProps = Object.assign(baseTelemetry, properties);
      this.reporter.sendTelemetryEvent('error', aggregatedProps, measurements);
    }
  }

  public sendEventData(
    eventName: string,
    properties?: { [key: string]: string },
    measures?: { [key: string]: number }
  ): void {
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent(eventName, properties, measures);
    }
  }

  public getEndHRTime(hrstart: [number, number]): number {
    const hrend = process.hrtime(hrstart);
    return Number(util.format('%d%d', hrend[0], hrend[1] / 1000000));
  }
}
