/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// import { isMetric } from '@salesforce/salesforcedx-apex-debugger/out/src';
import { isMetric } from '@salesforce/salesforcedx-apex-debugger/src';
import * as util from 'util';
import { DebugSessionCustomEvent } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

const EXTENSION_NAME = 'salesforcedx-vscode-apex-debugger';

export class TelemetryService {
  private static instance: TelemetryService;
  private reporters: TelemetryReporter[] | undefined;
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
    reporters: TelemetryReporter[],
    isTelemetryEnabled: boolean
  ): void {
    this.isTelemetryEnabled = isTelemetryEnabled;
    this.reporters = reporters;
  }

  public sendExtensionActivationEvent(hrstart: [number, number]): void {
    if (this.reporters !== undefined && this.isTelemetryEnabled) {
      const startupTime = this.getEndHRTime(hrstart);
      this.reporters.forEach(reporter => {
        reporter.sendTelemetryEvent(
          'activationEvent',
          {
            extensionName: EXTENSION_NAME
          },
          {
            startupTime
          }
        );
      });
    }
  }

  public sendExtensionDeactivationEvent(): void {
    if (this.reporters !== undefined && this.isTelemetryEnabled) {
      this.reporters.forEach(reporter => {
        reporter.sendTelemetryEvent('deactivationEvent', {
          extensionName: EXTENSION_NAME
        });
      });
    }
  }

  private getEndHRTime(hrstart: [number, number]): number {
    const hrend = process.hrtime(hrstart);
    return Number(util.format('%d%d', hrend[0], hrend[1] / 1000000));
  }

  public sendMetricEvent(event: DebugSessionCustomEvent): void {
    console.log('C');
    if (this.reporters !== undefined && this.isTelemetryEnabled) {
      console.log('D');
      this.reporters.forEach(reporter => {
        console.log('E');
        console.log('*** event.body = ' + JSON.stringify(event.body) + '***');
        console.log(
          '*** event.body.type = ' + event.body.type + '***'
        );
        console.log('*** event.body.subject = ' + event.body.subject + '***');
        console.log('*** typeof(event.body) = ' + typeof event.body + '***');
        if (isMetric(event.body)) { // The isMetric() type guard converts event.body to Metric
          console.log('F');
          const metricArgs = event.body;
          console.log('### metricArgs = ' + JSON.stringify(metricArgs));
          console.log('### metricArgs.eventName = ' + metricArgs.eventName);
          console.log('### metricArgs.message = ' + metricArgs.message);
          console.log('G');
          reporter.sendTelemetryEvent(metricArgs.eventName, {
            extensionName: EXTENSION_NAME,
            message: metricArgs.message
          });
          console.log('H');
        }
        console.log('I');
      });
      console.log('J');
    }
    console.log('K');
  }
}
