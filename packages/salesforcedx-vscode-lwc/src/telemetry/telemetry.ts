/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from 'util';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { waitForDX } from '../dxsupport/waitForDX';

const EXTENSION_NAME = 'salesforcedx-vscode-lwc';

export class TelemetryService {
  private static instance: TelemetryService;
  private reporter: TelemetryReporter | undefined;
  private isTelemetryEnabled: boolean;
  private setup: Promise<TelemetryService | undefined> | undefined;

  constructor() {
    this.isTelemetryEnabled = false;
  }

  public static getInstance() {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  public async setupVSCodeTelemetry() {
    const telemetryService = TelemetryService.getInstance();
    // if its already set up
    if (this.reporter) {
      return Promise.resolve(telemetryService);
    }
    if (!this.setup) {
      this.setup = waitForDX(true)
        .then((coreDependency: vscode.Extension<any>) => {
          coreDependency.exports.telemetryService.showTelemetryMessage();

          telemetryService.initializeService(
            coreDependency.exports.telemetryService.getReporter(),
            coreDependency.exports.telemetryService.isTelemetryEnabled()
          );
          return telemetryService;
        })
        .catch(err => {
          return undefined;
        });
    }
    return this.setup;
  }

  public initializeService(
    reporter: TelemetryReporter,
    isTelemetryEnabled: boolean
  ): void {
    this.isTelemetryEnabled = isTelemetryEnabled;
    this.reporter = reporter;
  }

  public async sendExtensionActivationEvent(
    hrstart: [number, number]
  ): Promise<void> {
    await this.setupVSCodeTelemetry();
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

  public async sendExtensionDeactivationEvent(): Promise<void> {
    await this.setupVSCodeTelemetry();
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      this.reporter.sendTelemetryEvent('deactivationEvent', {
        extensionName: EXTENSION_NAME
      });
    }
  }

  public async sendCommandEvent(
    commandName?: string,
    hrstart?: [number, number],
    properties?: any,
    measurements?: any
  ): Promise<void> {
    await this.setupVSCodeTelemetry();
    if (this.reporter !== undefined && this.isTelemetryEnabled && commandName) {
      const baseTelemetry = {
        extensionName: EXTENSION_NAME,
        commandName
      };
      const aggregatedProps = Object.assign(baseTelemetry, properties);

      let aggregatedMeasurements: any | undefined;
      if (hrstart || measurements) {
        aggregatedMeasurements = Object.assign({}, measurements);
        if (hrstart) {
          aggregatedMeasurements.executionTime = this.getEndHRTime(hrstart);
        }
      }
      this.reporter.sendTelemetryEvent(
        'commandExecution',
        aggregatedProps,
        aggregatedMeasurements
      );
    }
  }

  public async sendException(name: string, message: string): Promise<void> {
    await this.setupVSCodeTelemetry();
    if (this.reporter !== undefined && this.isTelemetryEnabled) {
      // @ts-ignore
      this.reporter.sendExceptionEvent(name, message);
    }
  }

  private getEndHRTime(hrstart: [number, number]): number {
    const hrend = process.hrtime(hrstart);
    return Number(util.format('%d%d', hrend[0], hrend[1] / 1000000));
  }
}
